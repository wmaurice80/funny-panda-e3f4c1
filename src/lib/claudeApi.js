// Wrapper centralisé pour les appels API Anthropic.
// Gère le retry avec backoff exponentiel sur les erreurs 529 (overloaded) et 503.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-haiku-4-5-20251001';
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([529, 503]);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Appelle Claude Haiku avec retry automatique sur surcharge.
 * @param {object} body  - Corps de la requête (messages, max_tokens, etc.)
 * @returns {Promise<object>} - Réponse JSON Anthropic parsée
 */
export async function callClaude(body) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Clé API manquante (VITE_ANTHROPIC_API_KEY).');

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

    if (response.ok) return response.json();

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      await delay(waitMs);
      continue;
    }

    const errBody = await response.text();
    throw new Error(`API ${response.status}: ${errBody}`);
  }
}
