import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, Square, LogOut, Code2, BarChart3 } from 'lucide-react';
import VoiceWeave from '../components/voice/VoiceWeave';
import HorizontalWaveform from '../components/voice/HorizontalWaveform';
import StarField from '../components/voice/StarField';
import QuickActions from '../components/voice/QuickActions';
import TextConsole from '../components/conversation/TextConsole';
import CodeWorkspace from '../components/editor/CodeWorkspace';
import HistoryButton from '../components/history/HistoryButton';
import HistoryDrawer from '../components/history/HistoryDrawer';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { useAI } from '../context/AIContext';
import { useInterview } from '../context/InterviewContext';

const STATUS_MAP = {
  idle:         { title: 'READY WHEN YOU ARE', subtitle: 'How can I help you today?', dots: false },
  listening:    { title: "I'M LISTENING",      subtitle: 'Listening for your command...', dots: true },
  transcribing: { title: "I'M LISTENING",      subtitle: '', dots: true },
  thinking:     { title: 'THINKING...',        subtitle: 'Processing your request...', dots: false },
  speaking:     { title: 'SPEAKING...',        subtitle: 'VoxCode is speaking...', dots: false },
  error:        { title: 'HMM, TRY AGAIN',     subtitle: '', dots: false },
};

const INTERVIEW_STATUS_MAP = {
  idle:         { title: 'READY WHEN YOU ARE', subtitle: 'Start an interview when ready.', dots: false },
  starting:     { title: 'PREPARING...',       subtitle: 'Getting your interview ready...', dots: true },
  asking:       { title: 'INTERVIEWER',        subtitle: 'Listening to the question...', dots: false },
  listening:    { title: "I'M LISTENING",      subtitle: 'Listening for your answer...', dots: true },
  evaluating:   { title: 'EVALUATING...',      subtitle: 'Analyzing your response...', dots: true },
  follow_up:    { title: 'INTERVIEWER',        subtitle: 'Follow-up question...', dots: false },
  coding:       { title: 'CODING CHALLENGE',   subtitle: 'Write your solution...', dots: false },
  completed:    { title: 'INTERVIEW COMPLETE',  subtitle: 'Great effort!', dots: false },
  paused:       { title: 'INTERVIEW PAUSED',   subtitle: 'Resume when ready.', dots: false },
  error:        { title: 'HMM, TRY AGAIN',     subtitle: '', dots: false },
};

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
  const navigate = useNavigate();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const {
    interactionState,
    isListening,
    isSpeaking,
    isThinking,
    transcript,
    errorMessage,
    frequencyData,
    support,
    startListening,
    stopListening,
  } = useVoice();
  const { activeAction, triggerQuickAction } = useAI();
  const { interviewState, viewInterview } = useInterview();
  const [searchParams] = useSearchParams();
  const actionProcessedRef = useRef(false);

  useEffect(() => {
    const action = searchParams.get('action');
    if ((action === 'practice' || action === 'quiz') && !actionProcessedRef.current) {
      actionProcessedRef.current = true;
      triggerQuickAction(action);
      navigate('/voxcode', { replace: true });
    }
  }, [searchParams, triggerQuickAction, navigate]);

  const isInInterview = interviewState && interviewState !== 'idle';
  const baseMap = isInInterview ? INTERVIEW_STATUS_MAP : STATUS_MAP;
  const stateConfig = isInInterview
    ? (INTERVIEW_STATUS_MAP[interviewState] || STATUS_MAP.idle)
    : (STATUS_MAP[interactionState] || STATUS_MAP.idle);

  let subtitle = stateConfig.subtitle;
  if ((isListening || interactionState === 'transcribing') && transcript) {
    subtitle = `"${transcript}"`;
  } else if (interactionState === 'error' && errorMessage) {
    subtitle = errorMessage;
  }

  // Tap to start / tap to finalize what you said.
  const toggleVoice = () => {
    if (isListening) stopListening();
    else if (!isThinking && !isSpeaking) startListening();
  };

  const voiceUnavailable = !support.speech;

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

      {/* ── history (left) ── */}
      <div className="absolute left-4 top-4 z-30">
        <HistoryButton onClick={() => setIsHistoryOpen(true)} />
      </div>

      {/* ── logout (right) ── */}
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
            state={interactionState}
            frequencyData={frequencyData}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[min(26vw,170px)] w-[96vw] -translate-x-1/2 -translate-y-1/2 opacity-90"
          />

          {/* layer 3 — thin concentric holo-rings with scanning arcs */}
          <HoloRings active={isListening || isSpeaking} />

          {/* layers 4 + 5 — circular audio waveform + organic AI energy core */}
          <VoiceWeave
            state={interactionState}
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
            className={`mt-3 max-w-[90vw] text-center text-xs font-light sm:text-sm md:mt-3.5 md:text-base ${transcript && isListening ? '' : 'truncate'}`}
            style={{ color: 'rgba(110,160,235,0.55)', letterSpacing: '0.08em', minHeight: '1.25rem' }}
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
            disabled={isThinking || isSpeaking || voiceUnavailable}
            aria-label={isListening ? 'Stop listening' : interactionState === 'idle' ? 'Start speaking' : stateConfig.title}
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
            {isListening
              ? 'Listening · tap to stop'
              : isThinking
                ? 'Processing'
                : isSpeaking
                  ? 'Speaking'
                  : voiceUnavailable
                    ? 'Use the text console below'
                    : 'Tap mic to start'}
          </p>
        </div>

        {/* ── quick actions — set teaching mode & kick off a conversation ── */}
        <QuickActions
          selected={activeAction}
          onSelect={triggerQuickAction}
          className="mt-5 justify-center"
        />
      </main>

      {!isWorkspaceOpen && <TextConsole />}

      {/* Bottom-left buttons */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsWorkspaceOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-white/30 hover:text-white/50 hover:border-white/[0.1] transition-all"
        >
          <Code2 className="h-3 w-3" />
          <span>CODE</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/learning')}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-white/30 hover:text-white/50 hover:border-white/[0.1] transition-all"
        >
          <BarChart3 className="h-3 w-3" />
          <span>PROGRESS</span>
        </button>
      </div>

      <CodeWorkspace isOpen={isWorkspaceOpen} onClose={() => setIsWorkspaceOpen(false)} />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectConversation={() => {}}
        onSelectInterview={(interview) => viewInterview(interview.id)}
      />
    </div>
  );
}
