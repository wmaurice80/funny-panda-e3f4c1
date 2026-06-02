// Wrapper centralisé pour les appels API Anthropic.
// Gère le retry avec backoff exponentiel sur les erreurs 529 (overloaded) et 503.
// Gère aussi le quota mensuel d'analyses IA (100/mois) via Supabase.

import { supabase } from './supabaseClient';
import { getAiUsage, incrementAiUsage } from './supabaseDb';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-haiku-4-5-20251001';
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([529, 503]);

const UNLIMITED_USER_EMAIL = 'wmaurice.peroumal@gmail.com';

export const AI_QUOTA_LIMIT = 100;
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
 * Appelle Claude Haiku avec retry automatique sur surcharge.
 * Vérifie et incrémente le quota mensuel (30 analyses/mois) avant chaque appel.
 * @param {object} body  - Corps de la requête (messages, max_tokens, etc.)
 * @returns {Promise<object>} - Réponse JSON Anthropic parsée
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
      // Si Supabase est indisponible → fail gracefully, on ne bloque pas l'analyse
      console.warn('[claudeApi] Vérification quota échouée (Supabase indisponible), on continue :', err.message);
    }
  }

  // ── Appel Claude ─────────────────────────────────────────────────────────
  const payload = { model: MODEL, ...body };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();

      // ── Incrément du quota après succès ────────────────────────────────
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

    const errBody = await response.text();
    throw new Error(`API ${response.status}: ${errBody}`);
  }
}
