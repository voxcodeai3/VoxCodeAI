/**
 * Browser text-to-speech service (SpeechSynthesis wrapper).
 *
 * Guarantees:
 *  - Only ONE response can be spoken at a time. Starting a new speak()
 *    automatically stops the previous one.
 *  - Long responses are split into sentence-sized chunks and queued
 *    sequentially (avoids the Chrome ~15s utterance cutoff bug) while still
 *    behaving externally like a single speak() call.
 *
 * Exposed API: isTTSSupported(), speak(), stop(), pause(), resume().
 */

let currentToken = 0;
let activeToken = 0;
let chunkQueue = [];
let callbacksRef = {};

export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function synth() {
  return window.speechSynthesis;
}

/** Split text into speakable chunks at sentence boundaries (~<=180 chars). */
function chunkText(text) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?;:\n]+[.!?;:]*[\])'"”’]*\s*/g) || [clean];
  const chunks = [];
  let buffer = '';

  const pushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed) chunks.push(trimmed);
    buffer = '';
  };

  for (const sentence of sentences) {
    if (sentence.length > 180) {
      pushBuffer();
      // Break very long sentences on word boundaries.
      const words = sentence.split(' ');
      let line = '';
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 170) {
          if (line.trim()) chunks.push(line.trim());
          line = word;
        } else {
          line = `${line} ${word}`.trim();
        }
      }
      if (line.trim()) chunks.push(line.trim());
      continue;
    }
    if ((buffer + sentence).length > 175) pushBuffer();
    buffer += sentence;
  }
  pushBuffer();
  return chunks.length ? chunks : [clean];
}

function stopInternal() {
  activeToken += 1; // invalidates in-flight chunk callbacks
  chunkQueue = [];
  try {
    synth()?.cancel();
  } catch {
    /* noop */
  }
}

/**
 * Speak text aloud. Automatically cancels any speech already in progress.
 *
 * @returns token id (or -1 when unsupported)
 */
export function speak(text, { onStart, onEnd, onError } = {}) {
  if (!isTTSSupported()) {
    onError?.({ code: 'unsupported', message: "Text-to-speech isn't supported in this browser." });
    return -1;
  }

  stopInternal();
  const token = ++currentToken;
  activeToken = token;
  callbacksRef = { onStart, onEnd, onError };

  const finish = () => {
    if (activeToken !== token) return;
    activeToken += 1;
    chunkQueue = [];
    callbacksRef = {};
    onEnd?.();
  };

  chunkQueue = chunkText(text);
  if (!chunkQueue.length) {
    finish();
    return token;
  }

  let started = false;

  const speakNextChunk = () => {
    if (activeToken !== token) return;
    const chunk = chunkQueue.shift();
    if (chunk === undefined) {
      finish();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = 1.02;
    utterance.pitch = 1.05;

    utterance.onstart = () => {
      if (!started && activeToken === token) {
        started = true;
        onStart?.();
      }
    };
    utterance.onend = () => speakNextChunk();
    utterance.onerror = (event) => {
      const code = event?.error || 'error';
      if (activeToken !== token) return;
      if (code === 'interrupted' || code === 'canceled') {
        finish(); // we cancelled it ourselves — treat as normal end
        return;
      }
      activeToken += 1;
      chunkQueue = [];
      callbacksRef = {};
      onError?.({ code });
    };

    try {
      synth().speak(utterance);
    } catch {
      finish();
    }
  };

  speakNextChunk();
  return token;
}

export function stop() {
  stopInternal();
  const { onEnd } = callbacksRef;
  callbacksRef = {};
  onEnd?.();
}

export function pause() {
  try {
    synth()?.pause();
  } catch {
    /* noop */
  }
}

export function resume() {
  try {
    synth()?.resume();
  } catch {
    /* noop */
  }
}
