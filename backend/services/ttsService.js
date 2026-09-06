/**
 * Configurable TTS service abstraction.
 *
 * Supports any OpenAI-compatible TTS provider via environment variables:
 *   TTS_PROVIDER  — "openai" | "openai-compatible" | "browser" (default: "browser")
 *   TTS_API_KEY   — API key for the provider
 *   TTS_MODEL     — model name (e.g. "tts-1", "tts-1-hd")
 *   TTS_VOICE     — voice name (e.g. "alloy", "echo", "fable", "onyx", "nova", "shimmer")
 *   TTS_BASE_URL  — base URL for OpenAI-compatible providers
 *   TTS_SPEED     — speech speed (0.25–4.0, default: 1.0)
 *
 * If no provider is configured, the service returns null to signal
 * the frontend should use browser speechSynthesis as fallback.
 */

const crypto = require("crypto");
const MAX_TEXT_LENGTH = 4000;

const CACHE_MAX = 64;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function cacheKey(text, voice, speed, model) {
  return crypto
    .createHash("sha256")
    .update(`${text}|${voice}|${speed}|${model}`)
    .digest("hex");
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.audio;
}

function cacheSet(key, audio) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, { audio, ts: Date.now() });
}

function getProvider() {
  return (process.env.TTS_PROVIDER || "browser").toLowerCase();
}

function getConfig() {
  return {
    provider: getProvider(),
    apiKey: process.env.TTS_API_KEY || "",
    model: process.env.TTS_MODEL || "tts-1",
    voice: process.env.TTS_VOICE || "alloy",
    baseUrl: process.env.TTS_BASE_URL || "https://api.openai.com/v1",
    speed: parseFloat(process.env.TTS_SPEED) || 1.0,
  };
}

/**
 * Generate speech audio from text.
 *
 * @param {string} text — text to speak
 * @param {object} options — { voice, speed }
 * @returns {Promise<{ audio: Buffer, contentType: string, provider: string } | null>}
 *   Returns null if no AI TTS is configured (use browser fallback).
 */
async function generateSpeech(text, options = {}) {
  const config = getConfig();

  if (config.provider === "browser" || !config.apiKey) {
    return null;
  }

  const truncated = String(text || "").slice(0, MAX_TEXT_LENGTH);
  if (!truncated.trim()) return null;

  const voice = options.voice || config.voice;
  const speed = options.speed || config.speed;

  const key = cacheKey(truncated, voice, speed, config.model);
  const cached = cacheGet(key);
  if (cached) return { audio: cached, contentType: "audio/mpeg", provider: config.provider };

  try {
    let result = null;
    if (config.provider === "openai" || config.provider === "openai-compatible") {
      result = await callOpenAICompatible(truncated, { ...config, voice, speed });
    }
    if (result?.audio) {
      cacheSet(key, result.audio);
    }
    return result;
  } catch (err) {
    console.error("TTS provider error:", err.message);
    return null;
  }
}

/**
 * OpenAI-compatible TTS API call.
 */
async function callOpenAICompatible(text, config) {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/audio/speech`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: text,
      voice: config.voice,
      speed: config.speed,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`TTS API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { audio: buffer, contentType: "audio/mpeg", provider: config.provider };
}

/**
 * Check if AI TTS is configured and available.
 */
function isConfigured() {
  const config = getConfig();
  return config.provider !== "browser" && !!config.apiKey;
}

/**
 * Get TTS config status (safe for admin — no secrets).
 */
function getStatus() {
  const config = getConfig();
  return {
    configured: isConfigured(),
    provider: config.provider,
    voice: config.voice,
    speed: config.speed,
    model: config.model,
    cacheSize: cache.size,
  };
}

module.exports = { generateSpeech, isConfigured, getConfig, getStatus, MAX_TEXT_LENGTH };
