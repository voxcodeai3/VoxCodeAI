import { Trophy, CheckCircle, AlertTriangle, Target, MessageSquare, Code, BookOpen, X } from 'lucide-react';
import { useInterview } from '../../context/InterviewContext';

function ScoreCircle({ score, label, size = 48 }) {
  const pct = Math.max(0, Math.min(100, score || 0));
  const color = pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#f87171';
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold" style={{ color }}>
          {pct}
        </span>
      </div>
      <span className="text-[9px] text-white/30 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function InterviewResults() {
  const { session, setShowResults, clearInterview, setInterviewState } = useInterview();

  if (!session) return null;

  const fb = session.feedback || {};

  const handleClose = () => {
    clearInterview();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2">
        <Trophy className="h-8 w-8 text-amber-400 mx-auto" />
        <p className="text-sm font-medium text-white/80">INTERVIEW COMPLETE</p>
        <p className="text-[10px] text-white/30">
          {session.type} · {session.difficulty} · {session.language}
        </p>
      </div>

      {/* Overall score */}
      <div className="flex justify-center">
        <ScoreCircle score={session.score} label="Overall" size={72} />
      </div>

      {/* Breakdown */}
      <div className="flex justify-center gap-5">
        <ScoreCircle score={session.technicalScore} label="Technical" size={48} />
        <ScoreCircle score={session.problemSolvingScore} label="Problem Solving" size={48} />
        <ScoreCircle score={session.communicationScore} label="Communication" size={48} />
        <ScoreCircle score={session.codeQualityScore} label="Code Quality" size={48} />
      </div>

      {/* Strengths */}
      {fb.strengths?.length > 0 && (
        <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400/60" />
            <p className="text-[10px] text-emerald-300/70 uppercase tracking-wider font-medium">Strengths</p>
          </div>
          <ul className="space-y-1">
            {fb.strengths.map((s, i) => (
              <li key={i} className="text-[11px] text-white/50 flex items-start gap-1.5">
                <span className="text-emerald-400/40 mt-0.5">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas to improve */}
      {fb.areasToImprove?.length > 0 && (
        <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400/60" />
            <p className="text-[10px] text-amber-300/70 uppercase tracking-wider font-medium">Areas to Improve</p>
          </div>
          <ul className="space-y-1">
            {fb.areasToImprove.map((a, i) => (
              <li key={i} className="text-[11px] text-white/50 flex items-start gap-1.5">
                <span className="text-amber-400/40 mt-0.5">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Technical gaps */}
      {fb.technicalGaps?.length > 0 && (
        <div className="rounded-xl border border-red-400/10 bg-red-400/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-red-400/60" />
            <p className="text-[10px] text-red-300/70 uppercase tracking-wider font-medium">Technical Gaps</p>
          </div>
          <ul className="space-y-1">
            {fb.technicalGaps.map((g, i) => (
              <li key={i} className="text-[11px] text-white/50 flex items-start gap-1.5">
                <span className="text-red-400/40 mt-0.5">•</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Communication & Coding feedback */}
      {(fb.communicationFeedback || fb.codingFeedback) && (
        <div className="grid grid-cols-1 gap-3">
          {fb.communicationFeedback && (
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-blue-400/60" />
                <p className="text-[10px] text-blue-300/70 uppercase tracking-wider font-medium">Communication</p>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">{fb.communicationFeedback}</p>
            </div>
          )}
          {fb.codingFeedback && (
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Code className="h-3.5 w-3.5 text-violet-400/60" />
                <p className="text-[10px] text-violet-300/70 uppercase tracking-wider font-medium">Coding</p>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">{fb.codingFeedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Recommended topics */}
      {fb.recommendedTopics?.length > 0 && (
        <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-cyan-400/60" />
            <p className="text-[10px] text-cyan-300/70 uppercase tracking-wider font-medium">Recommended Practice</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fb.recommendedTopics.map((t, i) => (
              <span key={i} className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-2.5 py-1 text-[9px] text-cyan-300/60">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Close button */}
      <button
        type="button"
        onClick={handleClose}
        className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.12] transition-all"
      >
        Done
      </button>
    </div>
  );
}
