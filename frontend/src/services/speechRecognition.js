/**
 * Browser speech-to-text service (Web Speech API wrapper).
 *
 * Exposes a small, framework-agnostic API used by VoiceContext:
 *   isSpeechRecognitionSupported()
 *   createSpeechRecognition({ lang, onResult, onError, onEnd })
 *     -> { start, stop, abort }
 *
 * The recognizer never touches React state — the context translates its
 * events into interaction states (idle / listening / transcribing / error).
 */

const FRIENDLY_ERRORS = {
  'not-allowed': 'Microphone permission is required to use voice input.',
  'service-not-allowed': 'Microphone permission is required to use voice input.',
  'audio-capture': 'No microphone was found. Please connect one and try again.',
  'no-speech': "I didn't catch any speech. Tap the mic and try again.",
  network: 'A network error interrupted speech recognition. Please try again.',
  unsupported: "Voice input isn't supported in this browser. You can type your question instead.",
  stalled: 'Voice input stopped responding on this browser. Tap the mic and try again.',
};

export function friendlyRecognitionError(code) {
  return FRIENDLY_ERRORS[code] || 'Voice recognition ran into a problem. Please try again.';
}

export function isSpeechRecognitionSupported() {
  return (
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

/**
 * Create a recognition session.
 *
 * Callbacks:
 *  - onResult({ finalText, interimText }) — fires as speech is recognized.
 *    finalText is everything finalized so far; interimText is the in-flight words.
 *  - onError(code) — SpeechRecognition error code (e.g. 'not-allowed').
 *  - onEnd() — always fires exactly once when the session truly ends
 *    (naturally, after stop(), or after an error).
 */
export function createSpeechRecognition({
  lang = 'en-US',
  onResult = () => {},
  onError = () => {},
  onEnd = () => {},
  // When > 0, the session is torn down if the browser goes completely silent
  // (no start/result/error/end events) for this long. Mobile Safari can hang
  // forever after audio playback without ever firing an event.
  stallTimeoutMs = 0,
} = {}) {
  const SR = isSpeechRecognitionSupported()
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

  let recognition = null;
  let finalText = '';
  let stoppedByUser = false;
  let endedHandled = false;
  let stallTimer = 0;

  const clearStallTimer = () => {
    if (stallTimer) {
      clearTimeout(stallTimer);
      stallTimer = 0;
    }
  };

  const bumpStallTimer = () => {
    clearStallTimer();
    if (!stallTimeoutMs || endedHandled) return;
    stallTimer = setTimeout(() => {
      stallTimer = 0;
      if (stoppedByUser) {
        // User already tapped stop but onend never came — deliver what we have.
        handleEnd();
        return;
      }
      onError('stalled');
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          /* noop */
        }
      }
      handleEnd();
    }, stallTimeoutMs);
  };

  const handleEnd = () => {
    if (endedHandled) return;
    endedHandled = true;
    clearStallTimer();
    recognition = null;
    onEnd();
  };

  const start = () => {
    if (!SR) {
      onError('unsupported');
      handleEnd();
      return;
    }
    finalText = '';
    stoppedByUser = false;
    endedHandled = false;

    try {
      recognition = new SR();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = bumpStallTimer;
      recognition.onaudiostart = bumpStallTimer;

      recognition.onresult = (event) => {
        bumpStallTimer();
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += `${result[0].transcript} `;
          } else {
            interim += result[0].transcript;
          }
        }
        onResult({
          finalText: finalText.trim(),
          interimText: interim.trim(),
        });
      };

      recognition.onerror = (event) => {
        if (!stoppedByUser && event?.error && event.error !== 'aborted') {
          onError(event.error);
        }
      };

      recognition.onend = handleEnd;

      recognition.start();
      bumpStallTimer();
    } catch {
      // start() can throw synchronously if called while already started, etc.
      onError('unknown');
      handleEnd();
    }
  };

  /** Graceful stop — whatever was said so far gets delivered via onEnd. */
  const stop = () => {
    stoppedByUser = true;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        handleEnd();
      }
    } else {
      handleEnd();
    }
  };

  /** Silent cancel — nothing is delivered. */
  const abort = () => {
    stoppedByUser = true;
    clearStallTimer();
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        /* noop */
      }
    }
    handleEnd();
  };

  return { start, stop, abort };
}
