/**
 * AI TTS service — calls the backend for high-quality AI speech.
 * Falls back to browser speechSynthesis if backend TTS is unavailable.
 */

import api from './api';

let currentAudio = null;
let currentToken = 0;

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
 * Play audio from a URL. Returns a promise that resolves when playback ends.
 */
export function playAudio(url, { onEnd, onError } = {}) {
  stopAudio();
  const token = ++currentToken;
  const audio = new Audio(url);
  currentAudio = audio;

  audio.onended = () => {
    if (currentToken !== token) return;
    currentAudio = null;
    URL.revokeObjectURL(url);
    onEnd?.();
  };

  audio.onerror = () => {
    if (currentToken !== token) return;
    currentAudio = null;
    URL.revokeObjectURL(url);
    onError?.();
  };

  audio.play().catch(() => {
    if (currentToken !== token) return;
    currentAudio = null;
    URL.revokeObjectURL(url);
    onError?.();
  });
}

/**
 * Stop any currently playing AI TTS audio.
 */
export function stopAudio() {
  currentToken += 1;
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
