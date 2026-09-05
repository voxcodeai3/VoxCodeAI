import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import * as assessmentApi from '../services/initialAssessmentApi';

function QuestionCard({ q, value, onChange }) {
  const isMC = q.type === 'multiple_choice' || q.type === 'true_false';
  if (isMC && q.options?.length) {
    return (
      <div className="space-y-2">
        <p className="text-white/80 text-sm leading-relaxed">{q.question}</p>
        {q.code && <pre className="bg-black/30 border border-white/[0.06] rounded-lg p-3 text-xs text-cyan-300 overflow-x-auto whitespace-pre-wrap">{q.code}</pre>}
        <div className="space-y-1.5 mt-3">
          {q.options.map((opt, idx) => (
            <label key={idx} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${value === opt ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-200' : 'bg-white/[0.04] border-white/[0.08] text-white/70 hover:border-white/15'}`}>
              <input type="radio" name={q.id} value={opt} checked={value === opt} onChange={(e) => onChange(e.target.value)} className="accent-cyan-500" />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {q.topic && <p className="text-white/20 text-[11px] mt-2">Topic: {q.topic} {q.technology ? `· ${q.technology}` : ''}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-white/80 text-sm leading-relaxed">{q.question}</p>
      {q.code && <pre className="bg-black/30 border border-white/[0.06] rounded-lg p-3 text-xs text-cyan-300 overflow-x-auto whitespace-pre-wrap">{q.code}</pre>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer..."
        className="w-full mt-3 min-h-[90px] rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/30"
      />
      {q.topic && <p className="text-white/20 text-[11px]">Topic: {q.topic} {q.technology ? `· ${q.technology}` : ''}</p>}
    </div>
  );
}

export default function InitialAssessment() {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> answer string
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [result, setResult] = useState(null);
  const [pathInfo, setPathInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        // fetch path title for header
        try {
          const pr = await api.get(`/learning/paths/${pathId}`);
          if (!cancelled) setPathInfo(pr.data.path || pr.data);
        } catch {}
        // check existing assessment for this path
        const byPath = await assessmentApi.getByPath(pathId);
        if (cancelled) return;
        if (byPath.status === 'completed' && byPath.assessment) {
          setAssessment(byPath.assessment);
          // fetch full result via getAssessment to show strengths etc. if needed
          // but we have assessment with overallLevel etc.
          setResult({
            overallLevel: byPath.assessment.overallLevel,
            technologyLevels: byPath.assessment.technologyLevels,
            strengths: byPath.assessment.strengths,
            weaknesses: byPath.assessment.weaknesses,
            recommendedStartingTopic: byPath.assessment.recommendedStartingTopic,
          });
          setLoading(false);
          return;
        }
        if (byPath.status === 'active' && byPath.assessment) {
          const a = byPath.assessment;
          setAssessment(a);
          // restore answers
          const map = {};
          (a.answers || []).forEach((ans) => { map[ans.questionId] = ans.answer; });
          setAnswers(map);
          // set current idx to first unanswered
          const idx = a.questions.findIndex((q) => !map[q.id]);
          setCurrentIdx(idx === -1 ? 0 : idx);
          setLoading(false);
          return;
        }
        // none -> start new
        const started = await assessmentApi.startAssessment(pathId);
        if (cancelled) return;
        if (started.alreadyCompleted) {
          setAssessment(started.assessment);
          setResult({
            overallLevel: started.assessment.overallLevel,
            technologyLevels: started.assessment.technologyLevels,
            strengths: started.assessment.strengths,
            weaknesses: started.assessment.weaknesses,
          });
        } else {
          const a = started.assessment;
          setAssessment(a);
          const map = {};
          (a.answers || []).forEach((ans) => { map[ans.questionId] = ans.answer; });
          setAnswers(map);
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load assessment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [pathId]);

  const q = assessment?.questions?.[currentIdx];
  const total = assessment?.questions?.length || 0;
  const progress = total ? `${currentIdx + 1} / ${total}` : '';

  const handleNext = async () => {
    if (!q) return;
    const ans = answers[q.id] || '';
    if (!String(ans).trim()) return;
    setSubmitting(true);
    try {
      const updated = await assessmentApi.submitAnswer(assessment._id, q.id, String(ans));
      setAssessment(updated.assessment);
      if (currentIdx + 1 < total) setCurrentIdx((i) => i + 1);
      else {
        // auto complete when last question answered
        await handleComplete();
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  const handleComplete = async () => {
    // ensure current answer saved if not yet
    if (q && String(answers[q.id] || '').trim()) {
      try { await assessmentApi.submitAnswer(assessment._id, q.id, String(answers[q.id])); } catch {}
    }
    setCompleting(true);
    setError(null);
    try {
      const res = await assessmentApi.completeAssessment(assessment._id);
      setResult(res.result);
      setAssessment(res.assessment);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to complete assessment');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading assessment...</div>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border border-rose-400/20 bg-rose-400/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto mb-3" />
          <p className="text-rose-200/80 text-sm mb-4">{error}</p>
          <button onClick={() => navigate('/learn')} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm">Back to Learn</button>
        </div>
      </div>
    );
  }

  // Completed view
  if (result || assessment?.status === 'completed') {
    const lvl = result?.overallLevel || assessment?.overallLevel || 'beginner';
    const techs = result?.technologyLevels || assessment?.technologyLevels || [];
    const strengths = result?.strengths || assessment?.strengths || [];
    const weaknesses = result?.weaknesses || assessment?.weaknesses || [];
    const recTitle = result?.recommendedStartingTopicTitle || '';
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <h1 className="text-white font-semibold">Assessment complete</h1>
          </div>
          <p className="text-white/50 text-sm mb-4">We’ve estimated where to begin for <span className="text-white/80">{pathInfo?.title || 'your selected path'}</span>.</p>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3">
              <p className="text-white/40 text-xs">Your starting level</p>
              <p className="text-white font-medium capitalize">{lvl}</p>
            </div>
            {techs.length > 0 && (
              <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3">
                <p className="text-white/40 text-xs mb-1">Technology levels</p>
                <div className="flex flex-wrap gap-1.5">
                  {techs.map((t) => (
                    <span key={t.technology} className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">{t.technology}: <span className="capitalize">{t.level}</span></span>
                  ))}
                </div>
              </div>
            )}
            {recTitle && (
              <div className="rounded-lg bg-cyan-500/10 border border-cyan-400/20 p-3">
                <p className="text-white/40 text-xs">We’ll begin with</p>
                <p className="text-cyan-200 font-medium">{recTitle}</p>
              </div>
            )}
            {strengths.length > 0 && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3">
                <p className="text-white/40 text-xs">You already seem comfortable with</p>
                <p className="text-white/70 text-xs">{strengths.join(', ')}</p>
              </div>
            )}
            {weaknesses.length > 0 && (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
                <p className="text-white/40 text-xs">We’ll spend more time on</p>
                <p className="text-white/70 text-xs">{weaknesses.map((w) => w.topic || w.topicName).join(', ')}</p>
              </div>
            )}
          </div>
          <button onClick={() => navigate('/learn')} className="mt-5 w-full rounded-lg bg-cyan-500/15 border border-cyan-400/20 px-4 py-2.5 text-sm text-cyan-200 hover:bg-cyan-500/20 flex items-center justify-center gap-2">
            Start Learning <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Active question view
  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button onClick={() => navigate('/learn')} className="text-xs text-white/40 hover:text-white/60 mb-3">← Back</button>
          <h1 className="text-white font-semibold">Let’s understand what you already know</h1>
          <p className="text-white/40 text-sm">{pathInfo?.title || 'Assessment'} · Question {progress}</p>
          <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-cyan-400/60 transition-all" style={{ width: `${total ? ((currentIdx + 1) / total) * 100 : 0}%` }} />
          </div>
        </div>

        {q ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <QuestionCard q={q} value={answers[q.id] || ''} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
            {error && <p className="text-rose-300/80 text-xs mt-3">{error}</p>}
            <div className="flex items-center justify-between mt-5">
              <button onClick={handlePrev} disabled={currentIdx === 0 || submitting} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs disabled:opacity-30">Previous</button>
              <div className="flex items-center gap-2">
                {currentIdx + 1 < total ? (
                  <button onClick={handleNext} disabled={!String(answers[q.id] || '').trim() || submitting} className="px-4 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/20 text-cyan-200 text-xs flex items-center gap-1.5 disabled:opacity-40">
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Next
                  </button>
                ) : (
                  <button onClick={handleComplete} disabled={!String(answers[q.id] || '').trim() || completing} className="px-4 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-200 text-xs flex items-center gap-1.5 disabled:opacity-40">
                    {completing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-sm">No questions available.</p>
        )}
      </div>
    </div>
  );
}
