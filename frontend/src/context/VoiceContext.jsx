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
import * as tts from '../services/textToSpeech';

/**
 * Central interaction state machine shared by VoiceWeave, the microphone
 * button, the conversation console, AI status and the composer.
 *
 * idle → listening → transcribing → thinking → speaking → idle
 *                ↘ error ↗ (recovers on next interaction)
 */

const VoiceContext = createContext(null);

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

  // recognition session refs
  const recognizerRef = useRef(null);
  const finalTextRef = useRef('');
  const gotResultRef = useRef(false);
  const endingRef = useRef(false);
  const hasErrorRef = useRef(false);

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
      setTranscript('');
      setInteractionState((s) => (s === 'listening' || s === 'transcribing' ? 'idle' : s));
      return;
    }

    const said = (finalTextRef.current || '').trim();
    finalTextRef.current = '';
    setTranscript(said);

    if (!said && !gotResultRef.current && !hasErrorRef.current) {
      setErrorMessage(friendlyRecognitionError('no-speech'));
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

    tts.stop(); // never let speech synthesis overlap a listening session
    setSpokenMessageId(null);
    setTranscript('');
    setErrorMessage('');
    hasErrorRef.current = false;
    finalTextRef.current = '';
    gotResultRef.current = false;
    setInteractionState('listening');

    attachStream();

    recognizerRef.current = createSpeechRecognition({
      lang: 'en-US',
      onResult: ({ finalText, interimText }) => {
        gotResultRef.current = true;
        finalTextRef.current = finalText;
        setTranscript(`${finalText} ${interimText}`.trim());
        setInteractionState((s) => (s === 'listening' ? 'transcribing' : s));
      },
      onError: (evt) => {
        const code = typeof evt === 'string' ? evt : evt?.error || evt?.code || evt?.type || 'unknown';
        const msg = friendlyRecognitionError(code);
        hasErrorRef.current = true;
        try { recognizerRef.current?.abort?.(); } catch {}
        setErrorMessage(msg);
        setInteractionState('error');
      },
      onEnd: () => {
        finalizeSession({ deliver: true });
      },
    });

    recognizerRef.current.start();
  }, [attachStream, finalizeSession]);

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

  const speakResponse = useCallback((text, messageId = null) => {
    if (!voiceEnabled) return; // muted — skip speech
    const content = (text || '').trim();
    if (!content) {
      setInteractionState('idle');
      return;
    }
    setSpokenMessageId(messageId);
    setInteractionState('speaking');
    tts.speak(content, {
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
  }, [voiceEnabled]);

  const stopSpeaking = useCallback(() => {
    tts.stop();
    setSpokenMessageId(null);
    setInteractionState((s) => (s === 'speaking' ? 'idle' : s));
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) tts.stop(); // turning off — stop any current speech
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
      tts.stop();
      loopingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detachStream();
      try {
        audioCtxRef.current?.close?.();
      } catch {
        /* noop */
      }
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
      frequencyData: freqDataRef.current, // stable buffer, mutated per frame
      support: {
        speech: isSpeechRecognitionSupported(),
        tts: tts.isTTSSupported(),
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
