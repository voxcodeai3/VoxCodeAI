import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Mic, Send, Loader2, X, Clock, Pause, Play, Square,
  AlertCircle, ChevronRight, User, Bot,
} from 'lucide-react';
import { useInterview } from '../../context/InterviewContext';
import { useVoice } from '../../context/VoiceContext';
import { useAI } from '../../context/AIContext';
import InterviewResults from './InterviewResults';

const INTERVIEW_TYPES = [
  { id: 'frontend', label: 'Frontend', color: 'text-cyan-300' },
  { id: 'backend', label: 'Backend', color: 'text-emerald-300' },
  { id: 'fullstack', label: 'Fullstack', color: 'text-violet-300' },
  { id: 'javascript', label: 'JavaScript', color: 'text-amber-300' },
  { id: 'react', label: 'React', color: 'text-blue-300' },
  { id: 'node', label: 'Node.js', color: 'text-green-300' },
  { id: 'python', label: 'Python', color: 'text-yellow-300' },
  { id: 'database', label: 'Database', color: 'text-orange-300' },
  { id: 'algorithms', label: 'Algorithms', color: 'text-pink-300' },
  { id: 'data_structures', label: 'Data Structures', color: 'text-rose-300' },
  { id: 'system_design', label: 'System Design', color: 'text-indigo-300' },
  { id: 'general_software', label: 'General', color: 'text-white/50' },
];

const DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
];

const DURATIONS = [
  { min: 10, label: '10 min' },
  { min: 20, label: '20 min' },
  { min: 30, label: '30 min' },
  { min: 45, label: '45 min' },
];

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust', 'sql'];

function formatTime(ms) {
  if (ms == null || ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function ConfigPanel({ onStart }) {
  const [type, setType] = useState('frontend');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [language, setLanguage] = useState('javascript');
  const [duration, setDuration] = useState(20);
  const [focusArea, setFocusArea] = useState('');
  const [creating, setCreating] = useState(false);

  const handleStart = async () => {
    setCreating(true);
    try {
      await onStart({ type, difficulty, language, durationMinutes: duration, focusArea: focusArea || null });
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-5">
      {/* Type */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Interview Type</p>
        <div className="grid grid-cols-3 gap-1.5">
          {INTERVIEW_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`rounded-lg border px-2 py-1.5 text-[10px] transition-all ${
                type === t.id
                  ? 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-300'
                  : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Difficulty</p>
        <div className="flex gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] transition-all ${
                difficulty === d.id
                  ? 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-300'
                  : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Language + Duration */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Language</p>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white/70 focus:border-cyan-400/30 focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l} className="bg-[#0a0f1a] text-white/70">{l}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Duration</p>
          <div className="flex gap-1">
            {DURATIONS.map((d) => (
              <button
                key={d.min}
                type="button"
                onClick={() => setDuration(d.min)}
                className={`flex-1 rounded-lg border px-1.5 py-1.5 text-[9px] transition-all ${
                  duration === d.min
                    ? 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Focus area */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Focus Area (optional)</p>
        <input
          value={focusArea}
          onChange={(e) => setFocusArea(e.target.value)}
          placeholder="e.g. React hooks, REST APIs, SQL optimization..."
          className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white/70 placeholder:text-white/20 focus:border-cyan-400/30 focus:outline-none"
        />
      </div>

      {/* Start */}
      <button
        type="button"
        onClick={handleStart}
        disabled={creating}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-3 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-all disabled:opacity-40"
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
        {creating ? 'Starting...' : 'Start Interview'}
      </button>
    </div>
  );
}

function Transcript({ transcript }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  if (!transcript?.length) return null;

  return (
    <div ref={scrollRef} className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
      {transcript.map((entry, i) => (
        <div key={i} className={`flex gap-2.5 ${entry.role === 'candidate' ? 'flex-row-reverse' : ''}`}>
          <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${
            entry.role === 'interviewer'
              ? 'bg-cyan-400/10 border border-cyan-400/20'
              : 'bg-violet-400/10 border border-violet-400/20'
          }`}>
            {entry.role === 'interviewer'
              ? <Bot className="h-3 w-3 text-cyan-400/60" />
              : <User className="h-3 w-3 text-violet-400/60" />
            }
          </div>
          <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
            entry.role === 'interviewer'
              ? 'bg-white/[0.03] border border-white/[0.04] text-white/70'
              : 'bg-cyan-400/[0.06] border border-cyan-400/10 text-cyan-200/80'
          }`}>
            <p>{entry.content}</p>
            <p className="text-[9px] text-white/20 mt-1">
              {entry.role === 'interviewer' ? 'Interviewer' : 'You'}
              {entry.inputMode === 'voice' ? ' 🎙' : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Timer({ timeRemaining, durationMinutes }) {
  if (timeRemaining == null || !durationMinutes) return null;
  const pct = durationMinutes ? (timeRemaining / (durationMinutes * 60 * 1000)) * 100 : 100;
  const urgent = pct < 15;

  return (
    <div className="flex items-center gap-2">
      <Clock className={`h-3 w-3 ${urgent ? 'text-red-400' : 'text-white/30'}`} />
      <span className={`text-[10px] font-mono ${urgent ? 'text-red-400' : 'text-white/30'}`}>
        {formatTime(timeRemaining)} remaining
      </span>
    </div>
  );
}

function ActiveInterview() {
  const {
    session, interviewState, setInterviewState,
    generating, submitAnswer: submitAnswerCtx,
    completeInterview, pauseInterview, resumeInterview,
    timeRemaining, error, setError,
  } = useInterview();
  const { isListening, startListening, stopListening, speakResponse, support } = useVoice();

  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const inputRef = useRef(null);

  const currentQ = session?.questions?.[session.currentQuestionIndex];
  const isPaused = interviewState === 'paused';
  const isIdle = interviewState === 'idle';
  const isAsking = interviewState === 'asking' || interviewState === 'follow_up';
  const isEvaluating = interviewState === 'evaluating';

  const handleSubmit = useCallback(async () => {
    const text = answer.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    const result = await submitAnswerCtx(text, 'text');
    if (result) {
      setAnswer('');
    }
    setSubmitting(false);
  }, [answer, submitting, submitAnswerCtx]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const handleEndConfirm = useCallback(async (action) => {
    setShowEndConfirm(false);
    await completeInterview(action);
  }, [completeInterview]);

  return (
    <div className="space-y-4">
      {/* Header with timer and controls */}
      <div className="flex items-center justify-between">
        <Timer timeRemaining={timeRemaining} durationMinutes={session?.durationMinutes} />
        <div className="flex items-center gap-1.5">
          {isPaused ? (
            <button
              type="button"
              onClick={resumeInterview}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1.5 text-[10px] text-emerald-300 hover:bg-emerald-400/[0.12] transition-all"
            >
              <Play className="h-3 w-3" />
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={pauseInterview}
              disabled={isIdle}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition-all disabled:opacity-30"
            >
              <Pause className="h-3 w-3" />
              Pause
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowEndConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/15 bg-red-400/[0.04] px-2.5 py-1.5 text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
          >
            <Square className="h-3 w-3" />
            End
          </button>
        </div>
      </div>

      {/* Paused overlay */}
      {isPaused && (
        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-center space-y-2">
          <p className="text-xs text-amber-300/70 font-medium">INTERVIEW PAUSED</p>
          <p className="text-[10px] text-white/30">Your progress is saved. Resume when ready.</p>
        </div>
      )}

      {/* Transcript */}
      <Transcript transcript={session?.transcript} />

      {/* Idle state — generate first question */}
      {isIdle && !currentQ && !generating && (
        <div className="text-center py-4">
          <button
            type="button"
            onClick={() => { setInterviewState('starting'); }}
            className="flex items-center justify-center gap-2 mx-auto rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-3 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-all"
          >
            <ChevronRight className="h-4 w-4" />
            Begin Interview
          </button>
        </div>
      )}

      {/* Evaluating indicator */}
      {isEvaluating && (
        <div className="flex items-center justify-center gap-2 py-3 text-white/30">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[10px]">Evaluating your response...</span>
        </div>
      )}

      {/* Error retry button */}
      {error && !isEvaluating && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (!currentQ) {
                setInterviewState('starting');
              }
            }}
            className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Answer input — always show when there's a session and not paused/completed */}
      {!isPaused && interviewState !== 'completed' && session && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={answer}
              onChange={(e) => { setAnswer(e.target.value); if (error) setError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              rows={2}
              className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-xs text-white/80 placeholder:text-white/20 focus:border-cyan-400/30 focus:outline-none resize-none"
              disabled={submitting}
            />
            <div className="flex flex-col gap-1.5">
              {support.speech && (
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={`flex items-center justify-center h-10 w-10 rounded-xl border transition-all ${
                    isListening
                      ? 'border-red-400/30 bg-red-400/[0.08] text-red-400'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                  }`}
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!answer.trim() || submitting}
                className="flex items-center justify-center h-10 w-10 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300 hover:bg-cyan-400/[0.15] transition-all disabled:opacity-30"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="text-[9px] text-white/20 text-center">
            Press Enter to submit · Shift+Enter for new line
          </p>
        </div>
      )}

      {/* End confirmation dialog */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEndConfirm(false)} />
          <div className="relative w-[90vw] max-w-[340px] rounded-2xl border border-white/[0.08] bg-[#080e1a] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-medium text-white/80">End this interview?</p>
            </div>
            <p className="text-[11px] text-white/40">Your progress will be saved and you'll receive a detailed evaluation.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleEndConfirm('complete')}
                className="flex-1 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2.5 text-[10px] text-cyan-300 hover:bg-cyan-400/[0.15] transition-all"
              >
                End Interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewWorkspace({ isOpen, onClose }) {
  const {
    session, interviewState, setInterviewState,
    showResults, setShowResults, showConfig, setShowConfig,
    createSession, generateQuestion, generating, error, setError,
    clearInterview,
  } = useInterview();

  // Auto-start question generation when interview starts.
  useEffect(() => {
    if (!isOpen || !session || session.status === 'completed' || showResults) return;
    if (interviewState === 'starting') {
      generateQuestion();
    }
  }, [isOpen, session?.id, interviewState, showResults]);

  const handleConfigStart = useCallback(async (config) => {
    const sess = await createSession(config);
    if (sess) {
      setInterviewState('starting');
    }
  }, [createSession, setInterviewState]);

  const handleClose = useCallback(() => {
    clearInterview();
    onClose();
  }, [clearInterview, onClose]);

  if (!isOpen && !showResults) return null;

  const typeConfig = INTERVIEW_TYPES.find((t) => t.id === session?.type) || INTERVIEW_TYPES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-[90vw] max-w-[600px] max-h-[85vh] rounded-3xl border border-cyan-400/15 bg-[#060c18]/95 backdrop-blur-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] flex items-center justify-center">
              <Mic className="h-3 w-3 text-cyan-400/60" />
            </div>
            <span className="text-xs font-medium text-white/70">INTERVIEW</span>
            {session?.type && (
              <span className={`text-[10px] ${typeConfig.color}`}>{typeConfig.label}</span>
            )}
            {session?.difficulty && (
              <span className="text-[10px] text-white/20">· {session.difficulty}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-b border-red-400/10 bg-red-400/[0.04] px-5 py-2 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400/60" />
            <p className="text-[10px] text-red-400/60">{error}</p>
            <button type="button" onClick={() => setError(null)} className="ml-auto text-red-400/40 hover:text-red-400/60">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {showResults ? (
            <InterviewResults />
          ) : !session || showConfig ? (
            <ConfigPanel onStart={handleConfigStart} />
          ) : generating && !session.questions?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <Loader2 className="h-5 w-5 animate-spin mb-3" />
              <p className="text-xs">Preparing your interview...</p>
            </div>
          ) : (
            <ActiveInterview />
          )}
        </div>
      </div>
    </div>
  );
}
