import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createSpeechRecognition,
  friendlyRecognitionError,
  isSpeechRecognitionSupported,
} from '../services/speechRecognition';
import * as browserTts from '../services/textToSpeech';
import * as aiTts from '../services/aiTts';

/**
 * Central interaction state machine shared by VoiceWeave, the microphone
 * button, the conversation console, AI status and the composer.
 *
 * idle → listening → transcribing → thinking → speaking → idle
 *                ↘ error ↗ (recovers on next interaction)
 */

const VoiceContext = createContext(null);

/**
 * On Android Chrome, holding a getUserMedia stream while SpeechRecognition
 * runs makes recognition hear nothing (Chromium bug 41403126) — it works on
 * desktop, which is why it went unnoticed. Mobile browsers keep the
 * visualizer stream closed during a recognition session instead.
 */
const isMobileBrowser = () =>
  typeof navigator !== 'undefined' &&
  /\b(Android|iPhone|iPad|iPod)\b/i.test(navigator.userAgent || '');

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used inside <VoiceProvider>');
  return ctx;
}

export const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'thinking',
  SPEAKING: 'speaking',
  ERROR: 'error',
};

export function VoiceProvider({ children }) {
  const [interactionState, setInteractionState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [spokenMessageId, setSpokenMessageId] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [aiTtsAvailable, setAiTtsAvailable] = useState(false);

  // recognition session refs
  const recognizerRef = useRef(null);
  const finalTextRef = useRef('');
  const interimTextRef = useRef('');
  const gotResultRef = useRef(false);
  const endingRef = useRef(false);
  const hasErrorRef = useRef(false);
  // Guards stale callbacks from a replaced session (silent auto-retry).
  const sessionSeqRef = useRef(0);
  const audioStartedRef = useRef(false);
  const retriedRef = useRef(false);
  const beepCtxRef = useRef(null);

  // handler registered by AIContext — receives finalized voice transcripts
  const finalHandlerRef = useRef(null);

  // ── audio analysis (visualizer feed) ────────────────────────────────────
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const freqDataRef = useRef(new Uint8Array(128));
  const rafRef = useRef(0);
  const loopingRef = useRef(false);

  const setFinalTranscriptHandler = useCallback((fn) => {
    finalHandlerRef.current = typeof fn === 'function' ? fn : null;
  }, []);

  const ensureAudioGraph = useCallback(() => {
    if (analyserRef.current) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      /* visualizers will simply stay flat */
    }
  }, []);

  const attachStream = useCallback(async () => {
    ensureAudioGraph();
    if (!analyserRef.current || !navigator.mediaDevices?.getUserMedia) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          /* noop */
        }
      }
      sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
    } catch {
      /* mic reserved or denied — recognition may still work; visuals stay flat */
    }
  }, [ensureAudioGraph]);

  const detachStream = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        /* noop */
      }
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Short tone played when mic capture is actually live. Android's
  // recognizer takes 1-2s to boot; speech given before it is lost.
  const playReadyBeep = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!beepCtxRef.current) beepCtxRef.current = new AC();
      const ctx = beepCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      /* beep is best-effort */
    }
  }, []);

  const startLoop = useCallback(() => {
    if (loopingRef.current) return;
    loopingRef.current = true;
    const tick = () => {
      if (!loopingRef.current) return;
      if (analyserRef.current && freqDataRef.current) {
        analyserRef.current.getByteFrequencyData(freqDataRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopLoop = useCallback(() => {
    loopingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  // Keep the analysis loop alive through listening/transcribing/speaking and
  // release the microphone whenever we return to a quiet state.
  useEffect(() => {
    if (
      interactionState === 'listening' ||
      interactionState === 'transcribing' ||
      interactionState === 'speaking'
    ) {
      startLoop();
    } else {
      stopLoop();
      if (interactionState === 'idle' || interactionState === 'error') {
        detachStream();
      }
    }
  }, [interactionState, startLoop, stopLoop, detachStream]);

  // Check AI TTS availability on mount
  useEffect(() => {
    aiTts.checkAiTtsStatus().then(setAiTtsAvailable).catch(() => {});
  }, []);

  // ── recognition lifecycle ───────────────────────────────────────────────

  /** Route a finished recognition session to the message pipeline. */
  const finalizeSession = useCallback(({ deliver }) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setTimeout(() => {
      endingRef.current = false;
    }, 200);

    const rec = recognizerRef.current;
    recognizerRef.current = null;
    try {
      rec?.abort?.();
    } catch {
      /* noop */
    }

    if (!deliver) {
      finalTextRef.current = '';
      interimTextRef.current = '';
      setTranscript('');
      setInteractionState((s) => (s === 'listening' || s === 'transcribing' ? 'idle' : s));
      return;
    }

    // Prefer final results; fall back to interim text — some mobile sessions
    // end before the browser finalizes what it heard.
    const said = `${finalTextRef.current || ''} ${interimTextRef.current || ''}`.trim();
    finalTextRef.current = '';
    interimTextRef.current = '';
    setTranscript(said);

    if (!said && !gotResultRef.current && !hasErrorRef.current) {
      setErrorMessage(
        isMobileBrowser()
          ? "I didn't catch any speech. Tap the mic, wait for the ready beep, then speak."
          : friendlyRecognitionError('no-speech'),
      );
      setInteractionState('error');
      return;
    }
    if (hasErrorRef.current) {
      hasErrorRef.current = false;
      return;
    }

    if (said && finalHandlerRef.current) {
      // AIContext takes over: thinking → API → speaking/idle
      finalHandlerRef.current(said);
      return;
    }

    setInteractionState('idle');
  }, []);

  const startListening = useCallback(async () => {
    if (!isSpeechRecognitionSupported()) {
      setErrorMessage(
        "Voice input isn't supported in this browser. You can type your question instead.",
      );
      setInteractionState('error');
      return;
    }

    browserTts.stop(); // never let speech synthesis overlap a listening session
    aiTts.stopAudio(); // an active <audio> element breaks recognition on iOS Safari
    setSpokenMessageId(null);
    setTranscript('');
    setErrorMessage('');
    hasErrorRef.current = false;
    finalTextRef.current = '';
    interimTextRef.current = '';
    gotResultRef.current = false;
    audioStartedRef.current = false;
    retriedRef.current = false;
    const seq = ++sessionSeqRef.current;
    setInteractionState('listening');

    const mobile = isMobileBrowser();
    if (!mobile) {
      attachStream();
    } else if (!beepCtxRef.current) {
      // Create the beep context inside the tap gesture — mobile browsers
      // refuse to start audio created outside one.
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) beepCtxRef.current = new AC();
      } catch {
        /* no beep, recognition still works */
      }
    }

    const spawn = () => {
      recognizerRef.current = createSpeechRecognition({
        lang: 'en-US',
        stallTimeoutMs: mobile ? 12000 : 0,
        onAudioStart: () => {
          if (seq !== sessionSeqRef.current) return;
          audioStartedRef.current = true;
          if (mobile) playReadyBeep();
        },
        onResult: ({ finalText, interimText }) => {
          if (seq !== sessionSeqRef.current) return;
          gotResultRef.current = true;
          finalTextRef.current = finalText;
          interimTextRef.current = interimText;
          setTranscript(`${finalText} ${interimText}`.trim());
          setInteractionState((s) => (s === 'listening' ? 'transcribing' : s));
        },
        onError: (evt) => {
          if (seq !== sessionSeqRef.current) return;
          const code =
            typeof evt === 'string' ? evt : evt?.error || evt?.code || evt?.type || 'unknown';
          // Android can hit its no-speech timeout before mic capture ever
          // boots — restart once, silently, instead of blaming the user.
          if (code === 'no-speech' && mobile && !audioStartedRef.current && !retriedRef.current) {
            retriedRef.current = true;
            try {
              recognizerRef.current?.abort?.();
            } catch {
              /* noop */
            }
            spawn();
            return;
          }
          const msg =
            mobile && code === 'no-speech'
              ? "I didn't catch any speech. Tap the mic, wait for the ready beep, then speak."
              : friendlyRecognitionError(code);
          hasErrorRef.current = true;
          try {
            recognizerRef.current?.abort?.();
          } catch {
            /* noop */
          }
          setErrorMessage(msg);
          setInteractionState('error');
        },
        onEnd: () => {
          if (seq !== sessionSeqRef.current) return;
          finalizeSession({ deliver: true });
        },
      });
      recognizerRef.current.start();
    };

    spawn();
  }, [attachStream, finalizeSession, playReadyBeep]);

  /** User taps stop — whatever was said so far becomes the user's message. */
  const stopListening = useCallback(() => {
    const rec = recognizerRef.current;
    if (rec) {
      rec.stop(); // natural onend → finalizeSession(deliver: true)
    } else {
      finalizeSession({ deliver: true });
    }
  }, [finalizeSession]);

  // ── text-to-speech lifecycle ────────────────────────────────────────────

  const speakResponse = useCallback(async (text, messageId = null) => {
    if (!voiceEnabled) return; // muted — skip speech
    const content = (text || '').trim();
    if (!content) {
      setInteractionState('idle');
      return;
    }
    setSpokenMessageId(messageId);
    setInteractionState('speaking');

    // Try AI TTS first
    if (aiTtsAvailable) {
      const audioUrl = await aiTts.fetchAiTts(content);
      if (audioUrl) {
        aiTts.playAudio(audioUrl, {
          onEnd: () => {
            setSpokenMessageId(null);
            setInteractionState((s) => (s === 'speaking' ? 'idle' : s));
          },
          onError: () => {
            // Fall back to browser TTS
            speakBrowser(content, messageId);
          },
        });
        return;
      }
    }

    // Fallback to browser TTS
    speakBrowser(content, messageId);
  }, [voiceEnabled, aiTtsAvailable]);

  function speakBrowser(content, messageId) {
    browserTts.speak(content, {
      onStart: null,
      onEnd: () => {
        setSpokenMessageId(null);
        setInteractionState((s) => (s === 'speaking' ? 'idle' : s));
      },
      onError: () => {
        setSpokenMessageId(null);
        setInteractionState((s) => (s === 'speaking' ? 'idle' : s));
      },
    });
  }

  const stopSpeaking = useCallback(() => {
    aiTts.stopAudio();
    browserTts.stop();
    setSpokenMessageId(null);
    setInteractionState((s) => (s === 'speaking' ? 'idle' : s));
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) {
        aiTts.stopAudio();
        browserTts.stop();
      }
      return !prev;
    });
  }, []);

  // ── state transitions driven by AIContext ───────────────────────────────
  const setThinking = useCallback(() => setInteractionState('thinking'), []);
  const setIdle = useCallback(
    () =>
      setInteractionState((s) =>
        s === 'thinking' || s === 'listening' || s === 'transcribing' ? 'idle' : s,
      ),
    [],
  );

  // Unmount cleanup — never leave the mic hot or speech running.
  useEffect(
    () => () => {
      try {
        recognizerRef.current?.abort?.();
      } catch {
        /* noop */
      }
      recognizerRef.current = null;
      aiTts.stopAudio();
      browserTts.stop();
      loopingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detachStream();
      try {
        audioCtxRef.current?.close?.();
      } catch {
        /* noop */
      }
      try {
        beepCtxRef.current?.close?.();
      } catch {
        /* noop */
      }
      beepCtxRef.current = null;
    },
    [detachStream],
  );

  const value = useMemo(() => {
    const isListening =
      interactionState === 'listening' || interactionState === 'transcribing';
    const isThinking = interactionState === 'thinking';
    const isSpeaking = interactionState === 'speaking';

    return {
      // state
      interactionState,
      isListening,
      isThinking,
      isSpeaking,
      transcript,
      errorMessage,
      spokenMessageId,
      voiceEnabled,
      aiTtsAvailable,
      frequencyData: freqDataRef.current, // stable buffer, mutated per frame
      support: {
        speech: isSpeechRecognitionSupported(),
        tts: browserTts.isTTSSupported() || aiTtsAvailable,
      },
      // actions
      startListening,
      stopListening,
      speakResponse,
      stopSpeaking,
      toggleVoice,
      setThinking,
      setIdle,
      setFinalTranscriptHandler,
    };
  }, [
    interactionState,
    transcript,
    errorMessage,
    spokenMessageId,
    voiceEnabled,
    aiTtsAvailable,
    startListening,
    stopListening,
    speakResponse,
    stopSpeaking,
    toggleVoice,
    setThinking,
    setIdle,
    setFinalTranscriptHandler,
  ]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
