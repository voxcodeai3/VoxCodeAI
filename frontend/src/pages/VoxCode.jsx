import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, LogOut } from 'lucide-react';
import VoiceWeave from '../components/voice/VoiceWeave';
import HorizontalWaveform from '../components/voice/HorizontalWaveform';
import StarField from '../components/voice/StarField';
import TextConsole from '../components/conversation/TextConsole';
import { useAuth } from '../context/AuthContext';

const STATUS_MAP = {
  idle:      { title: 'READY WHEN YOU ARE', subtitle: 'How can I help you today?', dots: false },
  listening: { title: "I'M LISTENING",       subtitle: 'Listening for your command...', dots: true },
  thinking:  { title: 'THINKING...',         subtitle: 'Processing your request...', dots: false },
  speaking:  { title: 'SPEAKING...',         subtitle: 'VoxCode is speaking...', dots: false },
};

const RESPONSES = [
  'Great question! In JavaScript you can reverse a string by splitting it into an array, calling reverse, then joining it back together.',
  'Sure. Think of a loop like a circle that repeats until a condition is met — let me walk you through a simple for loop example step by step.',
  'A good way to debug this is to add a console log right before the failing line and inspect the values of your variables at that point.',
  'Functions are reusable blocks of code. Let me show you how to define one with parameters and return a value.',
  'In React, state is data that can change over time. When state updates, the component re-renders automatically.',
];

const SIMULATED_TRANSCRIPTS = [
  'how do i reverse a string in javascript',
  'explain for loops to me',
  'how do i debug my code',
];

function HoloRings({ active }) {
  const boost = active ? 1 : 0;
  return (
    <>
      <div
        className="absolute rounded-full border border-[#5b7fff]/10 transition-shadow duration-700"
        style={{ inset: '-4%', boxShadow: active ? '0 0 34px -6px rgba(90,110,255,0.28)' : 'none' }}
      />
      <div
        className="vox-ring-arc absolute rounded-full"
        style={{
          inset: '-8%',
          backgroundImage: 'conic-gradient(from 0deg, transparent 0deg, rgba(110,130,255,0.6) 46deg, rgba(160,90,255,0.3) 88deg, transparent 130deg)',
          opacity: 0.5 + boost * 0.3,
          animation: 'vox-arc-spin 34s linear infinite',
          transition: 'opacity 0.8s ease',
        }}
      />
      <div
        className="vox-ring-arc absolute rounded-full"
        style={{
          inset: '-12.5%',
          backgroundImage: 'conic-gradient(from 200deg, transparent 0deg, rgba(210,90,255,0.45) 38deg, transparent 92deg)',
          opacity: 0.42 + boost * 0.3,
          animation: 'vox-arc-spin-rev 47s linear infinite',
          transition: 'opacity 0.8s ease',
        }}
      />
      <div className="absolute rounded-full border border-[#8a6cff]/[0.07]" style={{ inset: '-15%' }} />
      <div className="absolute rounded-full border border-[#4a6cd8]/[0.05]" style={{ inset: '-21%' }} />
    </>
  );
}

export default function VoxCode() {
  const { logout } = useAuth();
  const [voiceState, setVoiceState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [subtitleOverride, setSubtitleOverride] = useState('');

  const recognitionRef = useRef(null);
  const timersRef = useRef([]);
  const spokenTokenRef = useRef(0);
  const finishingRef = useRef(false);

  // Audio analysis refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const speechSourceRef = useRef(null);
  const frequencyDataRef = useRef(new Uint8Array(128));
  const animationFrameRef = useRef(0);
  const isAnalysingRef = useRef(false);

  const addTimer = (id) => { timersRef.current.push(id); return id; };
  const clearTimers = () => { timersRef.current.forEach((id) => clearTimeout(id)); timersRef.current = []; };

  // Initialize AudioContext and Analyser
  const initAudioAnalysis = useCallback(async () => {
    if (audioContextRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      console.warn('AudioContext not available:', e);
    }
  }, []);

  // Connect microphone stream to analyser
  const connectMicToAnalyser = useCallback(async (stream) => {
    if (!audioContextRef.current || !analyserRef.current) await initAudioAnalysis();
    if (!audioContextRef.current || !analyserRef.current) return;

    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      micStreamRef.current = stream;
      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
      }
      mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      mediaStreamSourceRef.current.connect(analyserRef.current);
    } catch (e) {
      console.warn('Failed to connect mic to analyser:', e);
    }
  }, [initAudioAnalysis]);

  // Disconnect microphone
  const disconnectMic = useCallback(() => {
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  // Start analysis loop
  const startAnalysis = useCallback(() => {
    if (isAnalysingRef.current) return;
    isAnalysingRef.current = true;
    const analyse = () => {
      if (!isAnalysingRef.current || !analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
      animationFrameRef.current = requestAnimationFrame(analyse);
    };
    analyse();
  }, []);

  // Stop analysis loop
  const stopAnalysis = useCallback(() => {
    isAnalysingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
  }, []);

  // speechSynthesis audio cannot be tapped directly — the speaking state drives
  // a synchronized waveform animation inside the visualizers instead.
  const speakWithAnalysis = useCallback((text, onEnd) => {
    if (!('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1.05;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.speak(utterance);
  }, []);

  const respond = useCallback((said) => {
    const reply = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    setSubtitleOverride(reply);
    setVoiceState('speaking');
    const token = ++spokenTokenRef.current;

    let spoke = false;
    const finish = () => {
      if (spokenTokenRef.current !== token || spoke) return;
      spoke = true;
      setVoiceState('idle');
      setSubtitleOverride('');
    };

    speakWithAnalysis(reply, finish);
    addTimer(setTimeout(finish, Math.max(3000, reply.split(' ').length * 420)));
  }, [speakWithAnalysis]);

  const handleSpeechEnd = useCallback((text) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearTimers();
    const said = (text || '').trim();
    setTimeout(() => { finishingRef.current = false; }, 100);
    if (!said) { setVoiceState('idle'); return; }
    setTranscript(said);
    setSubtitleOverride(`"${said}"`);
    setVoiceState('thinking');
    addTimer(setTimeout(() => respond(said), 1600 + Math.random() * 800));
  }, [respond]);

  const stopEverything = useCallback(() => {
    clearTimers();
    try { recognitionRef.current?.abort?.(); } catch { /* noop */ }
    recognitionRef.current = null;
    try { window.speechSynthesis?.cancel?.(); } catch { /* noop */ }
    spokenTokenRef.current += 1;
    disconnectMic();
  }, [disconnectMic]);

  useEffect(() => stopEverything, [stopEverything]);

  // Start/stop analysis based on voice state
  useEffect(() => {
    if (voiceState === 'listening' || voiceState === 'speaking') {
      startAnalysis();
    } else {
      stopAnalysis();
    }
    return () => stopAnalysis();
  }, [voiceState, startAnalysis, stopAnalysis]);

  const startListening = useCallback(async () => {
    setTranscript('');
    setSubtitleOverride('');
    setVoiceState('listening');

    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (SR) {
      try {
        const recognition = new SR();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        let finalText = '';
        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) finalText += res[0].transcript;
            else interim += res[0].transcript;
          }
          setTranscript((finalText + interim).trim());
        };
        recognition.onend = () => { recognitionRef.current = null; handleSpeechEnd(finalText); };
        recognition.onerror = () => { recognitionRef.current = null; handleSpeechEnd(finalText); };
        recognitionRef.current = recognition;

        // Get microphone stream and connect to analyser
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          connectMicToAnalyser(stream);
          recognition.start();
          return;
        } catch (e) {
          console.warn('Microphone access denied:', e);
        }
      } catch { recognitionRef.current = null; }
    }
    // Fallback simulation
    const fake = SIMULATED_TRANSCRIPTS[Math.floor(Math.random() * SIMULATED_TRANSCRIPTS.length)];
    let i = 0;
    const typeSim = () => { i += 1; setTranscript(fake.slice(0, i)); if (i < fake.length) addTimer(setTimeout(typeSim, 55)); };
    addTimer(setTimeout(typeSim, 400));
    addTimer(setTimeout(() => handleSpeechEnd(fake), 3400));
  }, [handleSpeechEnd, connectMicToAnalyser]);

  const toggleVoice = useCallback(() => {
    if (voiceState === 'listening') {
      stopEverything();
      setVoiceState('idle');
      setTranscript('');
      setSubtitleOverride('');
      return;
    }
    if (voiceState === 'idle') startListening();
  }, [voiceState, startListening, stopEverything]);

  const stateConfig = STATUS_MAP[voiceState] || STATUS_MAP.idle;

  const subtitle =
    voiceState === 'listening' && transcript ? `"${transcript}"`
      : voiceState === 'speaking' && subtitleOverride ? subtitleOverride
        : voiceState === 'thinking' && subtitleOverride ? subtitleOverride
          : stateConfig.subtitle;

  const isListening = voiceState === 'listening';
  const isSpeaking = voiceState === 'speaking';

  // Get frequency data for visualizers (stable ref contents, mutated per frame)
  const frequencyData = frequencyDataRef.current;

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-[#010208] text-white">

      {/* ── background layers ── */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 80% 65% at 50% 42%, rgba(15,8,35,0.7) 0%, rgba(1,2,8,1) 50%)',
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 50% 45% at 50% 50%, rgba(30,10,70,0.25), transparent 60%)',
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at 50% 48%, rgba(60,25,130,0.1), transparent 50%)',
      }} />

      {/* faint blue grid at edges */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(30,80,180,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(30,80,180,0.06) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 85% 80% at 50% 45%, transparent 20%, black 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 80% at 50% 45%, transparent 20%, black 50%, transparent 100%)',
        }}
      />

      <StarField />

      {/* vignette */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(ellipse 90% 90% at 50% 48%, transparent 30%, rgba(0,0,5,0.98) 100%)',
      }} />

      {/* ── header ── */}
      <header className="absolute inset-x-0 top-0 z-20 flex flex-col items-center pt-5 md:pt-7">
        <h1 className="font-futuristic text-[10px] font-bold tracking-[0.65em] text-[#60a0e0]/70 md:text-xs">
          VOXCODE
        </h1>
        <p className="mt-1 font-futuristic text-[7px] font-light tracking-[0.55em] text-[#4070a0]/30 md:text-[8px]">
          AI CODING TEACHER
        </p>
      </header>

      {/* ── logout ── */}
      <button
        type="button"
        onClick={logout}
        aria-label="Logout"
        className="absolute right-4 top-4 z-30 rounded-full border border-[#305080]/20 bg-[#050814]/50 p-2.5 text-[#60a0e0]/30 backdrop-blur-md transition-all duration-300 hover:border-[#5080c0]/40 hover:text-[#80c0ff]/80 hover:shadow-[0_0_20px_-4px_rgba(50,100,200,0.35)] active:scale-95"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>

      <main className="relative z-10 flex h-full flex-col items-center justify-center px-4">

        {/* ═══ MAIN VISUALIZER — hero element, all layers share its center ═══ */}
        <div
          className="relative shrink-0"
          style={{ width: 'min(88vw, 56dvh, 600px)', height: 'min(88vw, 56dvh, 600px)' }}
        >
          {/* layer 2 — horizontal signal passing behind the core,
              anchored to this container's exact vertical center */}
          <HorizontalWaveform
            state={voiceState}
            frequencyData={frequencyData}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[min(26vw,170px)] w-[96vw] -translate-x-1/2 -translate-y-1/2 opacity-90"
          />

          {/* layer 3 — thin concentric holo-rings with scanning arcs */}
          <HoloRings active={isListening || isSpeaking} />

          {/* layers 4 + 5 — circular audio waveform + organic AI energy core */}
          <VoiceWeave
            state={voiceState}
            frequencyData={frequencyData}
            className="absolute inset-0"
          />

          {/* layer 6 — VoxCode, locked to the exact center of the core */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span
              className="vox-core-title vox-gradient-text"
              style={{ fontSize: 'min(9vw, 40px)' }}
            >
              VoxCode
            </span>
          </div>
        </div>

        {/* ── status block ── */}
        <div className="-mt-2 flex flex-col items-center sm:-mt-3" role="status" aria-live="polite">
          <div className="flex items-center gap-3 sm:gap-4">
            {stateConfig.dots && [0, 1, 2].map((i) => (
              <span
                key={`l${i}`}
                className="h-1.5 w-1.5 rounded-full md:h-2 md:w-2"
                style={{
                  background: '#5ec8ff',
                  boxShadow: '0 0 8px 2px rgba(80,200,255,0.8)',
                  animation: 'dot-pulse 2.4s ease-in-out infinite',
                  animationDelay: `${i * 0.25}s`,
                }}
              />
            ))}
            <h2
              className={`font-futuristic text-[11px] font-medium uppercase tracking-[0.42em] sm:text-sm md:text-base vox-gradient-text ${isListening ? 'vox-status-listening' : 'vox-status-title'}`}
            >
              {stateConfig.title}
            </h2>
            {stateConfig.dots && [0, 1, 2].map((i) => (
              <span
                key={`r${i}`}
                className="h-1.5 w-1.5 rounded-full md:h-2 md:w-2"
                style={{
                  background: '#5ec8ff',
                  boxShadow: '0 0 8px 2px rgba(80,200,255,0.8)',
                  animation: 'dot-pulse 2.4s ease-in-out infinite',
                  animationDelay: `${0.6 + i * 0.25}s`,
                }}
              />
            ))}
          </div>

          <p
            className="mt-3 max-w-[90vw] truncate text-center text-xs font-light sm:text-sm md:mt-3.5 md:text-base"
            style={{ color: 'rgba(110,160,235,0.55)', letterSpacing: '0.08em' }}
          >
            {subtitle}
          </p>

          {/* divider */}
          <div className="relative mt-6 h-px w-52 md:w-80">
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to right, transparent, rgba(120,110,255,0.35), transparent)',
            }} />
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: '9px',
                height: '9px',
                background: isListening ? '#7d8dff' : 'rgba(110,110,255,0.45)',
                boxShadow: isListening ? '0 0 16px 4px rgba(125,141,255,0.85)' : '0 0 10px 3px rgba(110,110,255,0.35)',
                animation: isListening ? 'dot-pulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
          </div>

          {/* microphone button */}
          <button
            type="button"
            onClick={toggleVoice}
            disabled={voiceState === 'thinking' || voiceState === 'speaking'}
            aria-label={isListening ? 'Stop listening' : voiceState === 'idle' ? 'Start speaking' : stateConfig.title}
            className={`group relative mt-7 flex h-16 w-16 items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-500 hover:scale-[1.06] active:scale-95 disabled:pointer-events-none disabled:opacity-40 md:h-[72px] md:w-[72px] ${isListening ? 'border-[#7f97ff]/60' : 'border-[#5a67df]/30 hover:border-[#8b93ff]/60'}`}
            style={{
              background: 'rgba(8,12,28,0.55)',
              boxShadow: isListening
                ? '0 0 0 1px rgba(120,140,255,0.22), 0 0 44px -6px rgba(95,135,255,0.75), 0 18px 44px -16px rgba(40,60,190,0.8)'
                : '0 0 0 1px rgba(100,110,240,0.08), 0 0 26px -8px rgba(95,115,255,0.35), 0 16px 38px -16px rgba(30,50,160,0.7)',
            }}
          >
            {isListening && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full border border-[#6f86ff]/40" />
                <span
                  className="absolute -inset-2.5 rounded-full bg-[#4a5eff]/10 blur-md"
                  style={{ animation: 'dot-pulse 1.8s ease-in-out infinite' }}
                />
              </>
            )}
            <div
              className="absolute inset-1.5 rounded-full border transition-all duration-500"
              style={{
                borderColor: isListening ? 'rgba(130,150,255,0.35)' : 'rgba(100,110,240,0.16)',
                backgroundColor: isListening ? 'rgba(60,80,220,0.12)' : 'transparent',
              }}
            />
            <div className="relative z-10">
              {isListening ? (
                <Square className="h-6 w-6 fill-[#a5b8ff] text-[#a5b8ff] drop-shadow-[0_0_12px_rgba(120,140,255,0.8)] md:h-7 md:w-7" />
              ) : (
                <Mic className="h-6 w-6 text-[#8fb0e8] drop-shadow-[0_0_10px_rgba(80,110,230,0.5)] transition-all duration-300 group-hover:scale-110 group-hover:text-[#aebfff] md:h-7 md:w-7" />
              )}
            </div>
          </button>

          <p
            className="mt-3.5 text-[9px] font-light uppercase md:text-[10px]"
            style={{ color: 'rgba(90,130,210,0.45)', letterSpacing: '0.35em' }}
          >
            {isListening ? 'Listening · tap to stop' : voiceState === 'thinking' ? 'Processing' : voiceState === 'speaking' ? 'Speaking' : 'Tap mic to start'}
          </p>
        </div>
      </main>

      <TextConsole />
    </div>
  );
}
