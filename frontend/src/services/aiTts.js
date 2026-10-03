/**
 * AI TTS service — calls the backend for high-quality AI speech.
 * Falls back to browser speechSynthesis if backend TTS is unavailable.
 */

import api from './api';

let currentAudio = null;
let currentToken = 0;
let activeResolve = null;

/**
 * Request AI TTS audio from the backend.
 * Returns an audio Blob URL or null if unavailable.
 */
export async function fetchAiTts(text, { voice, speed } = {}) {
  try {
    const response = await api.post('/voice/tts', { text, voice, speed }, {
      responseType: 'blob',
      timeout: 30000,
    });
    if (response.data instanceof Blob && response.data.size > 0) {
      return URL.createObjectURL(response.data);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Play audio from a URL.
 * Resolves 'ended' | 'error' | 'cancelled' so callers can chain chunks.
 * onEnd/onError callbacks are kept for compatibility.
 */
export function playAudio(url, { onEnd, onError } = {}) {
  stopAudio();
  const token = ++currentToken;

  return new Promise((resolve) => {
    activeResolve = resolve;

    const settle = (result, cb) => {
      if (activeResolve === resolve) activeResolve = null;
      cb?.();
      resolve(result);
    };

    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      if (currentToken !== token) {
        settle('cancelled');
        return;
      }
      currentAudio = null;
      URL.revokeObjectURL(url);
      settle('ended', onEnd);
    };

    audio.onerror = () => {
      if (currentToken !== token) {
        settle('cancelled');
        return;
      }
      currentAudio = null;
      URL.revokeObjectURL(url);
      settle('error', onError);
    };

    audio.play().catch(() => {
      if (currentToken !== token) {
        settle('cancelled');
        return;
      }
      currentAudio = null;
      URL.revokeObjectURL(url);
      settle('error', onError);
    });
  });
}

/**
 * Stop any currently playing AI TTS audio.
 * Any pending playAudio() promise resolves with 'cancelled'.
 */
export function stopAudio() {
  currentToken += 1;
  if (activeResolve) {
    const resolve = activeResolve;
    activeResolve = null;
    resolve('cancelled');
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = '';
    } catch { /* noop */ }
    currentAudio = null;
  }
}

/**
 * Check if the backend has AI TTS configured.
 */
export async function checkAiTtsStatus() {
  try {
    const { data } = await api.get('/voice/tts/status');
    return data.configured === true;
  } catch {
    return false;
  }
}
