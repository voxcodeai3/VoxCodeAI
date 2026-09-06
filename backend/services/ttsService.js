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

const MAX_TEXT_LENGTH = 4000;

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
    return null; // signal frontend to use browser TTS
  }

  const truncated = String(text || "").slice(0, MAX_TEXT_LENGTH);
  if (!truncated.trim()) return null;

  const voice = options.voice || config.voice;
  const speed = options.speed || config.speed;

  try {
    if (config.provider === "openai" || config.provider === "openai-compatible") {
      return await callOpenAICompatible(truncated, { ...config, voice, speed });
    }
    // Unknown provider — fall back to browser
    return null;
  } catch (err) {
    console.error("TTS provider error:", err.message);
    return null; // graceful fallback
  }
}

/**
 * OpenAI-compatible TTS API call.
 * Works with OpenAI, OpenRouter, and any compatible endpoint.
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
  return {
    audio: buffer,
    contentType: "audio/mpeg",
    provider: config.provider,
  };
}

/**
 * Check if AI TTS is configured and available.
 */
function isConfigured() {
  const config = getConfig();
  return config.provider !== "browser" && !!config.apiKey;
}

module.exports = { generateSpeech, isConfigured, getConfig, MAX_TEXT_LENGTH };
