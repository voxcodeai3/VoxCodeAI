/**
 * Configurable TTS service abstraction.
 *
 * Supports OpenAI-compatible TTS providers and Fish Audio via env vars:
 *   TTS_PROVIDER  — "openai" | "openai-compatible" | "fish" | "browser" (default: "browser")
 *   TTS_API_KEY   — API key for the provider
 *   TTS_MODEL     — model name (OpenAI: "tts-1"; Fish: "s2-pro" | "s1" | "s2.1-pro" | "s2.1-pro-free")
 *   TTS_VOICE     — voice name (OpenAI: "alloy", ...; Fish: the voice/model reference_id from the playground)
 *   TTS_BASE_URL  — base URL (OpenAI-compatible providers; Fish default: https://api.fish.audio)
 *   TTS_SPEED     — speech speed (OpenAI 0.25–4.0; Fish prosody 0.5–2.0, clamped; default: 1.0)
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
    const baseLower = String(config.baseUrl || "").toLowerCase();
    const isFish = config.provider === "fish" || config.provider === "fish-audio" || config.provider === "fish.audio"
      // Tolerate a generic provider label when the URL clearly points at Fish Audio.
      || baseLower.includes("fish.audio");
    if (config.provider === "openai" || config.provider === "openai-compatible") {
      result = await callOpenAICompatible(truncated, { ...config, voice, speed });
    } else if (isFish) {
      if (config.provider !== "fish" && config.provider !== "fish-audio" && config.provider !== "fish.audio") {
        console.log(`TTS: routing provider "${config.provider}" to Fish Audio based on base URL (set TTS_PROVIDER=fish to silence this).`);
      }
      result = await callFishAudio(truncated, { ...config, voice, speed });
    } else {
      // Unknown provider name — never pretend it worked. Returning null lets
      // the frontend fall back to browser speech (and logs why below).
      console.error(`TTS misconfigured: unknown TTS_PROVIDER "${config.provider}". Use "openai", "openai-compatible", "fish", or "browser".`);
      return null;
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
 * Fish Audio TTS API call — POST {base}/v1/tts with a voice reference_id.
 * TTS_VOICE must be the voice/model ID from the Fish Audio playground.
 */
async function callFishAudio(text, config) {
  const root = (config.baseUrl || "https://api.fish.audio").replace(/\/+$/, "");
  const url = root.endsWith("/v1/tts") ? root : `${root}/v1/tts`;
  // Fish prosody speed range is 0.5–2.0; clamp our generic speed into it.
  const speed = Math.min(2.0, Math.max(0.5, Number(config.speed) || 1.0));
  // Accept OpenRouter-style slugs ("fish-audio/s2.1-pro-free:free") by extracting the engine label.
  const rawModel = String(config.model || "");
  const engine = ["s2.1-pro-free", "s2.1-pro", "s2-pro", "s1"].find((m) => rawModel.toLowerCase().includes(m)) || "s2-pro";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      model: engine,
    },
    body: JSON.stringify({
      text,
      reference_id: config.voice,
      format: "mp3",
      normalize: true,
      prosody: { speed },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Fish Audio API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error("Fish Audio returned empty audio");
  return { audio: buffer, contentType: "audio/mpeg", provider: "fish" };
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
