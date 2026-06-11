// Wrapper centralisé pour les appels API IA.
// Route tous les appels vers la Supabase Edge Function `ai-proxy` (clés côté serveur).
// Gère le retry avec backoff exponentiel sur les erreurs 529 / 503.
// Fallback automatique Claude → Gemini si Claude est indisponible.
// Fallback local si l'Edge Function est inaccessible et que les clés VITE_ sont présentes
// (compatibilité backward, ex. dev local sans Edge Function déployée).

import { supabase } from './supabase';
import { getAiUsage, incrementAiUsage } from './supabaseDb';

const MODEL       = 'claude-haiku-4-5-20251001';
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([529, 503]);

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const UNLIMITED_USER_EMAIL = 'wmaurice.peroumal@gmail.com';

export const AI_QUOTA_LIMIT             = 100;
export const AI_QUOTA_WARNING_THRESHOLD = 80;

export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0';

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

// ── Helpers pour le fallback local ────────────────────────────────────────────

async function callAnthropicDirect(body) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Clé API manquante (VITE_ANTHROPIC_API_KEY).');

  const payload = { model: MODEL, ...body };
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw Object.assign(new Error(`Claude API ${response.status}: ${errBody}`), { status: response.status });
  }

  return response.json();
}

async function callGeminiDirect(body) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Clé Gemini manquante (VITE_GEMINI_API_KEY).');

  const geminiBody = translateToGemini(body);
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
  return { content: [{ text }], _provider: 'gemini' };
}

/**
 * Traduit un body au format Anthropic → format Gemini (corps de la requête).
 * Supporté : messages texte simple et messages vision avec image+texte.
 */
function translateToGemini(body) {
  const userMsg = body.messages?.[0];
  if (!userMsg) throw new Error('[Gemini] Aucun message fourni.');

  const parts = [];

  if (typeof userMsg.content === 'string') {
    parts.push({ text: userMsg.content });
  } else if (Array.isArray(userMsg.content)) {
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

  return {
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: body.max_tokens ?? 1024,
      temperature: 0.2,
    },
  };
}

// ── Appel via Edge Function ────────────────────────────────────────────────────

/**
 * Appelle l'Edge Function ai-proxy pour un provider donné.
 * Retourne { data, error } dans le style supabase.functions.invoke.
 * Lève une erreur avec `.status` si la réponse n'est pas ok.
 */
async function invokeProxy(provider, body, session) {
  const headers = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { provider, body },
    headers,
  });

  if (error) throw error;
  return data;
}

// ── Appel Claude via Edge Function avec retry + fallback Gemini ───────────────

async function callClaudeViaProxy(body, session) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await invokeProxy('claude', body, session);
      return data;
    } catch (err) {
      lastError = err;
      const status = err?.status ?? err?.context?.status;
      if (RETRYABLE_STATUSES.has(status) && attempt < MAX_RETRIES) {
        const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        await delay(waitMs);
        continue;
      }
      break;
    }
  }

  // Fallback Gemini via proxy
  console.warn('[claudeApi] Claude indisponible via proxy, fallback Gemini :', lastError?.message);
  try {
    const geminiBody = translateToGemini(body);
    const data = await invokeProxy('gemini', geminiBody, session);
    // Normalise la réponse Gemini au format Claude-compatible
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { content: [{ text }], _provider: 'gemini' };
  } catch (geminiErr) {
    throw lastError ?? geminiErr;
  }
}

// ── Fallback local (dev / backward compat) ─────────────────────────────────────

async function callClaudeLocal(body) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callAnthropicDirect(body);
    } catch (err) {
      lastError = err;
      const status = err?.status;
      if (RETRYABLE_STATUSES.has(status) && attempt < MAX_RETRIES) {
        const waitMs = 1000 * Math.pow(2, attempt);
        await delay(waitMs);
        continue;
      }
      break;
    }
  }

  // Fallback Gemini local
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    console.warn('[claudeApi] Claude local indisponible, fallback Gemini local :', lastError?.message);
    return await callGeminiDirect(body);
  }

  throw lastError ?? new Error('Claude API : échec inconnu');
}

// ── Point d'entrée public ──────────────────────────────────────────────────────

/**
 * Appelle Claude Haiku (via Edge Function ai-proxy) avec retry automatique sur surcharge.
 * Si Claude est épuisé → fallback Gemini 2.0 Flash.
 * Vérifie et incrémente le quota mensuel avant chaque appel.
 * @param {object} body  - Corps de la requête (messages, max_tokens, etc.)
 * @returns {Promise<object>} - Réponse JSON compatible format Anthropic
 */
export async function callClaude(body) {
  // ── Récupération de la session JWT ─────────────────────────────────────────
  let session = null;
  let isUnlimitedUser = false;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session ?? null;
    if (session?.user?.email === UNLIMITED_USER_EMAIL) {
      isUnlimitedUser = true;
    }
  } catch (err) {
    console.warn('[claudeApi] Récupération session échouée :', err.message);
  }

  // ── Vérification du quota ──────────────────────────────────────────────────
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

  // ── Appel IA ───────────────────────────────────────────────────────────────
  let result;
  try {
    result = await callClaudeViaProxy(body, session);
  } catch (proxyErr) {
    // Fallback local UNIQUEMENT en développement (jamais en production/APK).
    // IMPORTANT : s'assurer que VITE_ANTHROPIC_API_KEY est ABSENT des variables
    // de build Netlify et du bundle APK release pour que ce fallback ne s'active jamais
    // en production (sinon la clé serait exposée dans le bundle).
    const isDev = import.meta.env.DEV === true;
    if (isDev && import.meta.env.VITE_ANTHROPIC_API_KEY) {
      console.warn('[claudeApi] Edge Function indisponible, fallback local (DEV uniquement) :', proxyErr?.message);
      result = await callClaudeLocal(body);
    } else {
      throw proxyErr;
    }
  }

  // ── Incrément du quota après succès ───────────────────────────────────────
  if (!isUnlimitedUser) {
    incrementAiUsage().catch(err =>
      console.warn('[claudeApi] Incrément quota échoué :', err.message)
    );
  }

  return result;
}
