import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import * as assessmentApi from '../../../services/initialAssessmentApi';
import api from '../../../services/api';

export default function AssessmentFlow({ pathId, onComplete }) {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [pathInfo, setPathInfo] = useState(null);

  useEffect(() => {
    if (!pathId) return;
    let cancelled = false;
    (async () => {
      try {
        const [pathRes, existing] = await Promise.all([
          api.get(`/learning/paths/${pathId}`),
          assessmentApi.getByPath(pathId),
        ]);
        if (cancelled) return;
        setPathInfo(pathRes.data);

        if (existing.status === 'completed') {
          setResult(existing.assessment);
          onComplete?.(existing.assessment);
          return;
        }

        if (existing.assessment) {
          setAssessment(existing.assessment);
        } else {
          const r = await assessmentApi.startAssessment(pathId);
          setAssessment(r.assessment);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pathId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mb-3" />
        <span className="text-sm text-white/50">Preparing your assessment...</span>
      </div>
    );
  }

  if (result) return <AssessmentResult result={result} pathInfo={pathInfo} />;

  if (!assessment) {
    return (
      <div className="text-center py-12 text-sm text-white/40">
        Could not start assessment. <button onClick={() => onComplete?.()} className="text-cyan-400 hover:underline">Skip</button>
      </div>
    );
  }

  const questions = assessment.questions || [];
  const q = questions[currentIdx];
  if (!q) return null;
  const total = questions.length;
  const progress = ((currentIdx + 1) / total) * 100;

  const handleAnswer = (answer) => {
    setAnswers(prev => ({ ...prev, [q.id]: answer }));
  };

  const handleSubmit = async () => {
    const answer = answers[q.id];
    if (!answer || submitting) return;
    setSubmitting(true);
    try {
      await assessmentApi.submitAnswer(assessment._id, q.id, answer);
      if (currentIdx < total - 1) {
        setCurrentIdx(prev => prev + 1);
      } else {
        const r = await assessmentApi.completeAssessment(assessment._id);
        setResult(r.assessment);
        onComplete?.(r.assessment);
      }
    } catch {}
    setSubmitting(false);
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="mb-4">
        <div className="text-xs text-white/40 mb-1">Placement Assessment</div>
        <div className="text-sm font-medium text-white/80">{pathInfo?.title || 'Learning Path'}</div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40">Question {currentIdx + 1} of {total}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mb-5">
        <div className="h-full rounded-full bg-cyan-400/60 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {q.code && (
        <pre className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 text-xs text-white/70 font-mono mb-4 overflow-x-auto">{q.code}</pre>
      )}

      <div className="text-sm text-white/80 mb-4 leading-relaxed">{q.question}</div>

      {(q.type === 'multiple_choice' || q.type === 'true_false') && q.options ? (
        <div className="space-y-2 mb-4">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                answers[q.id] === opt
                  ? 'bg-cyan-500/15 border-cyan-400/30 text-white'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <textarea
          value={answers[q.id] || ''}
          onChange={e => handleAnswer(e.target.value)}
          placeholder="Type your answer..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/15 mb-4 resize-none"
          rows={3}
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={!answers[q.id] || submitting}
        className="w-full px-4 py-2.5 rounded-lg bg-cyan-500/15 text-cyan-400 text-sm font-medium hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : currentIdx === total - 1 ? 'Complete Assessment' : 'Next'}
      </button>
    </div>
  );
}

function AssessmentResult({ result, pathInfo }) {
  const level = result.overallLevel || 'beginner';
  const strengths = result.strengths || [];
  const weaknesses = result.weaknesses || [];
  const recommended = result.recommendedStartingTopicTitle || result.recommendedStartingTopic;

  return (
    <div className="max-w-lg mx-auto p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-cyan-400/15 mx-auto mb-4 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-cyan-400" />
      </div>
      <div className="text-lg font-semibold text-white mb-1">Assessment Complete</div>
      <div className="text-sm text-white/50 mb-4">{pathInfo?.title || 'Learning Path'}</div>

      <div className="inline-block px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-sm text-white/80 mb-4">
        Level: <span className="font-medium capitalize">{level}</span>
      </div>

      {strengths.length > 0 && (
        <div className="mb-3 text-left">
          <div className="text-[11px] tracking-widest text-white/40 mb-1.5">STRENGTHS</div>
          <div className="flex flex-wrap gap-1.5">
            {strengths.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">{s}</span>
            ))}
          </div>
        </div>
      )}

      {weaknesses.length > 0 && (
        <div className="mb-4 text-left">
          <div className="text-[11px] tracking-widest text-white/40 mb-1.5">AREAS TO FOCUS</div>
          <div className="flex flex-wrap gap-1.5">
            {weaknesses.map((w, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">{w.topicName || w.topic}</span>
            ))}
          </div>
        </div>
      )}

      {recommended && (
        <div className="text-xs text-white/40 mb-4">Starting at: <span className="text-white/60">{typeof recommended === 'string' ? recommended : 'Recommended topic'}</span></div>
      )}

      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 text-sm font-medium hover:bg-cyan-500/25 inline-flex items-center gap-2"
      >
        Start Learning <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
