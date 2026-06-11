// Wrapper centralisé pour les appels API Anthropic.
// Gère le retry avec backoff exponentiel sur les erreurs 529 (overloaded) et 503.
// Gère aussi le quota mensuel d'analyses IA (100/mois) via Supabase.
// Fallback automatique sur Gemini 2.0 Flash si Claude est indisponible.

import { supabase } from './supabase';
import { getAiUsage, incrementAiUsage } from './supabaseDb';

const API_URL     = 'https://api.anthropic.com/v1/messages';
const MODEL       = 'claude-haiku-4-5-20251001';
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([529, 503]);

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const UNLIMITED_USER_EMAIL = 'wmaurice.peroumal@gmail.com';

export const AI_QUOTA_LIMIT             = 100;
export const AI_QUOTA_WARNING_THRESHOLD = 80;

// Erreur spécifique pour le dépassement de quota
export class QuotaExceededError extends Error {
  constructor() {
    super('QUOTA_EXCEEDED');
    this.name = 'QuotaExceededError';
    this.code = 'QUOTA_EXCEEDED';
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Traduit un body au format Anthropic → format Gemini et appelle l'API.
 * Retourne une réponse au format Claude ({content: [{text}]}) pour
 * que les callers n'aient pas à changer.
 *
 * Supporte :
 *  - messages texte simple : { role, content: "string" }
 *  - messages vision       : { role, content: [{type:'image', source:...}, {type:'text', text:...}] }
 */
async function callGemini(body) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Clé Gemini manquante (VITE_GEMINI_API_KEY).');

  // ── Traduction format Anthropic → Gemini ──────────────────────────────────
  const userMsg = body.messages?.[0];
  if (!userMsg) throw new Error('[Gemini] Aucun message fourni.');

  const parts = [];

  if (typeof userMsg.content === 'string') {
    // Texte pur (Aliments, AnalyseResult)
    parts.push({ text: userMsg.content });
  } else if (Array.isArray(userMsg.content)) {
    // Vision (Repas) : image + texte
    for (const block of userMsg.content) {
      if (block.type === 'image') {
        parts.push({
          inline_data: {
            mime_type: block.source.media_type,
            data: block.source.data,
          },
        });
      } else if (block.type === 'text') {
        parts.push({ text: block.text });
      }
    }
  }

  const geminiBody = {
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: body.max_tokens ?? 1024,
      temperature: 0.2,
    },
  };

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(geminiBody),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errBody}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Retourne un objet compatible format Claude
  return { content: [{ text }], _provider: 'gemini' };
}

/**
 * Appelle Claude Haiku avec retry automatique sur surcharge.
 * Si Claude est épuisé après tous les retries → fallback Gemini 2.0 Flash.
 * Vérifie et incrémente le quota mensuel avant chaque appel.
 * @param {object} body  - Corps de la requête (messages, max_tokens, etc.)
 * @returns {Promise<object>} - Réponse JSON compatible format Anthropic
 */
export async function callClaude(body) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Clé API manquante (VITE_ANTHROPIC_API_KEY).');

  // ── Bypass quota pour l'utilisateur illimité ────────────────────────────
  let isUnlimitedUser = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email === UNLIMITED_USER_EMAIL) {
      isUnlimitedUser = true;
    }
  } catch (err) {
    console.warn('[claudeApi] Récupération utilisateur échouée :', err.message);
  }

  // ── Vérification du quota ────────────────────────────────────────────────
  if (!isUnlimitedUser) {
    try {
      const currentCount = await getAiUsage();
      if (currentCount >= AI_QUOTA_LIMIT) {
        throw new QuotaExceededError();
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) throw err;
      console.warn('[claudeApi] Vérification quota échouée (Supabase indisponible), on continue :', err.message);
    }
  }

  // ── Appel Claude avec retries ─────────────────────────────────────────────
  const payload = { model: MODEL, ...body };
  let lastError  = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      // Erreur réseau (offline, DNS…)
      lastError = networkErr;
      break;
    }

    if (response.ok) {
      const result = await response.json();

      // ── Incrément du quota après succès ──────────────────────────────────
      if (!isUnlimitedUser) {
        incrementAiUsage().catch(err =>
          console.warn('[claudeApi] Incrément quota échoué :', err.message)
        );
      }

      return result;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      await delay(waitMs);
      continue;
    }

    // Erreur non-retryable ou retries épuisés
    const errBody = await response.text();
    lastError = new Error(`Claude API ${response.status}: ${errBody}`);
    break;
  }

  // ── Fallback Gemini 2.0 Flash ─────────────────────────────────────────────
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    console.warn('[claudeApi] Claude indisponible, fallback Gemini Flash :', lastError?.message);
    return await callGemini(body);
  }

  throw lastError ?? new Error('Claude API : échec inconnu');
}
