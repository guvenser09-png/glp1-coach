// ── AI proxy client ───────────────────────────────────────────────────────────
// SECURITY (report A1): the OpenAI API key must NEVER live in the app bundle.
// This client talks to OUR backend proxy (server/api/ai.js), which holds the
// secret key in SERVER-side env and forwards chat completions to OpenAI.
//
// The proxy URL comes from app config (`extra.aiProxyUrl`) or an Expo public
// env var. When no proxy URL is configured, or the request fails, this throws
// an Error with `.code === 'AI_UNAVAILABLE'` so every call site can fall back to
// its existing OFFLINE behavior (local food DB estimate / local coach reply).
import Constants from 'expo-constants';
import { aiProxyUrl } from '../config';

// 20s request budget, then abort (report C2: timeout + abort + one retry).
const REQUEST_TIMEOUT_MS = 20000;

function getProxyUrl() {
  return (
    aiProxyUrl ||
    Constants.expoConfig?.extra?.aiProxyUrl ||
    process.env.EXPO_PUBLIC_AI_PROXY_URL ||
    ''
  );
}

function aiUnavailable(message) {
  const err = new Error(message || 'AI proxy is not available');
  err.code = 'AI_UNAVAILABLE';
  return err;
}

// Single POST attempt with an AbortController timeout.
async function postOnce(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AI proxy error: ${response.status} — ${text}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * callAIChat — the single entry point for all AI chat/vision completions.
 *
 * @param {Object}  args
 * @param {Array}   args.messages       OpenAI-style chat messages (required).
 * @param {number}  [args.maxTokens=300]
 * @param {number}  [args.temperature=0.7]
 * @param {Object}  [args.responseFormat]  e.g. { type: 'json_object' }.
 * @param {string}  [args.model]           optional model override.
 * @returns {Promise<string>} the assistant message content (trimmed).
 * @throws  {Error} with `.code === 'AI_UNAVAILABLE'` when no proxy is
 *          configured or the request fails (network / timeout / bad status).
 */
export async function callAIChat({
  messages,
  maxTokens = 300,
  temperature = 0.7,
  responseFormat,
  model,
} = {}) {
  const url = getProxyUrl();
  if (!url) {
    throw aiUnavailable('No AI proxy URL configured (extra.aiProxyUrl).');
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw aiUnavailable('callAIChat requires a non-empty messages array.');
  }

  const payload = {
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (model) payload.model = model;
  if (responseFormat) payload.response_format = responseFormat;

  let lastError;
  // One initial try + one retry (report C2). Two attempts total.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await postOnce(url, payload);
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('AI proxy returned an unexpected response shape.');
      }
      return content.trim();
    } catch (e) {
      lastError = e;
      // Retry once on transient failures (timeout/network/5xx). On the last
      // attempt we fall through to AI_UNAVAILABLE below.
    }
  }

  throw aiUnavailable(
    lastError ? `AI request failed: ${lastError.message}` : 'AI request failed.'
  );
}

// Whether an AI proxy is configured at all. Call sites can use this to decide
// up-front whether to even attempt an AI call (e.g. photo analysis that has no
// offline path), instead of inspecting a key.
export function isAIConfigured() {
  return Boolean(getProxyUrl());
}
