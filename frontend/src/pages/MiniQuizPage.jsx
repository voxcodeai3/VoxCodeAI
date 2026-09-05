import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Lightbulb, ArrowRight, RotateCcw, BookOpen } from 'lucide-react';
import * as quizApi from '../services/miniQuizApi';
import api from '../services/api';

function QuestionView({ q, value, onChange, disabled }) {
  const isMC = q.type === 'multiple_choice' || q.type === 'true_false';
  if (isMC && q.options?.length) {
    return (
      <div className="space-y-2">
        <p className="text-white/90 text-sm leading-relaxed">{q.question}</p>
        {q.code && <pre className="bg-black/30 border border-white/[0.06] rounded-lg p-3 text-xs text-cyan-300 overflow-x-auto whitespace-pre-wrap">{q.code}</pre>}
        <div className="space-y-1.5 mt-3">
          {q.options.map((opt, idx) => (
            <label key={idx} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${value === opt ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-200' : 'bg-white/[0.04] border-white/[0.08] text-white/70 hover:border-white/15'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <input type="radio" name={q.id} value={opt} checked={value === opt} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="accent-cyan-500" />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-white/90 text-sm leading-relaxed">{q.question}</p>
      {q.code && <pre className="bg-black/30 border border-white/[0.06] rounded-lg p-3 text-xs text-cyan-300 overflow-x-auto whitespace-pre-wrap">{q.code}</pre>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer..."
        disabled={disabled}
        className="w-full mt-3 min-h-[90px] rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/30 disabled:opacity-60"
      />
    </div>
  );
}

export default function MiniQuizPage() {
  const { quizId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [hint, setHint] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [finalResult, setFinalResult] = useState(null);

  // Load or start quiz
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        if (quizId) {
          const data = await quizApi.getQuiz(quizId);
          if (cancelled) return;
          setQuiz(data.quiz);
          if (data.quiz.status === 'completed') {
            setFinalResult({ percentage: data.quiz.percentage, passed: data.quiz.passed, score: data.quiz.score, total: data.quiz.total });
          } else {
            const map = {};
            (data.quiz.answers || []).forEach((a) => { map[a.questionId] = a.answer; });
            setAnswers(map);
            const idx = data.quiz.questions.findIndex((q) => !map[q.id]);
            setCurrentIdx(idx === -1 ? 0 : idx);
          }
        } else {
          const topicId = search.get('topicId');
          const learningPathId = search.get('pathId');
          const teachingSessionId = search.get('sessionId');
          if (!topicId && !teachingSessionId) {
            // Try to get current topic from learning state
            const state = await api.get('/learning/state').then((r) => r.data);
            const tid = state.currentTopic;
            const pid = state.activeLearningPath || state.activeLearningGoal?.learningPath;
            if (!tid || !pid) throw new Error('No topic to quiz. Start a teaching session first.');
            const data = await quizApi.startQuiz({ topicId: tid, learningPathId: pid });
            if (!cancelled) setQuiz(data.quiz);
          } else {
            const data = await quizApi.startQuiz({ topicId, learningPathId, teachingSessionId });
            if (!cancelled) setQuiz(data.quiz);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || e.message || 'Failed to load quiz');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [quizId, search]);

  const q = quiz?.questions?.[currentIdx];
  const total = quiz?.questions?.length || 0;

  const handleSubmit = async () => {
    if (!q) return;
    const ans = answers[q.id] || '';
    if (!String(ans).trim()) return;
    setSubmitting(true);
    setFeedback(null);
    setHint(null);
    try {
      const res = await quizApi.submitAnswer(quiz._id, q.id, String(ans));
      setFeedback(res.evaluation);
      setQuiz(res.quiz);
      // auto-advance after short delay if correct? For now keep manual next
    } catch (e) {
      setFeedback({ status: 'incorrect', explanation: e.response?.data?.message || 'Failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (!q) return;
    setHintLoading(true);
    try {
      const res = await quizApi.getHint(quiz._id, q.id);
      setHint(res.hint);
    } catch {
      setHint('Think about the core concept and try to recall the example.');
    } finally {
      setHintLoading(false);
    }
  };

  const handleNext = () => {
    setFeedback(null);
    setHint(null);
    if (currentIdx + 1 < total) setCurrentIdx((i) => i + 1);
  };

  const handlePrev = () => {
    setFeedback(null);
    setHint(null);
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const res = await quizApi.completeQuiz(quiz._id);
      setFinalResult(res.result);
      setQuiz(res.quiz);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to complete');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading quiz...</div>
      </div>
    );
  }

  if (error && !quiz) {
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

  if (finalResult || quiz?.status === 'completed') {
    const r = finalResult || { percentage: quiz.percentage, passed: quiz.passed, score: quiz.score, total: quiz.total };
    const isPass = r.passed || r.percentage >= 80;
    const needsReview = r.percentage < 60;
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h1 className="text-white font-semibold flex items-center gap-2">{isPass ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-amber-400" />} Quiz Complete</h1>
          <div className="mt-3 rounded-lg bg-white/[0.04] border border-white/[0.06] p-4">
            <p className="text-white/90 text-2xl font-bold">{r.score ?? '?'} / {r.total} <span className="text-white/40 text-sm">{r.percentage}%</span></p>
            <p className="text-white/50 text-xs mt-1">{isPass ? 'Topic understanding is strong — you can continue.' : needsReview ? 'Topic needs review — let’s revisit the weak areas.' : 'Mostly understood — review weak areas.'}</p>
          </div>
          {r.nextTopic && (
            <div className="mt-3 rounded-lg bg-cyan-500/10 border border-cyan-400/20 p-3">
              <p className="text-white/40 text-xs">Next up</p>
              <p className="text-cyan-200 text-sm">{r.nextTopic.title}</p>
            </div>
          )}
          <div className="flex gap-2 mt-5">
            <button onClick={() => navigate('/learn')} className="flex-1 rounded-lg bg-cyan-500/15 border border-cyan-400/20 px-4 py-2.5 text-sm text-cyan-200 hover:bg-cyan-500/20 flex items-center justify-center gap-2">Continue Learning <ArrowRight className="h-4 w-4" /></button>
            {needsReview && <button onClick={() => navigate(-1)} className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" /> Review Topic</button>}
            {!isPass && <button onClick={() => window.location.reload()} className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Retry</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="text-xs text-white/40 hover:text-white/60 mb-3">← Back</button>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-white font-semibold">Mini Quiz</h1>
          <span className="text-white/40 text-xs">Question {currentIdx + 1} of {total}</span>
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-5">
          <div className="h-full bg-cyan-400/60 transition-all" style={{ width: `${total ? ((currentIdx + 1) / total) * 100 : 0}%` }} />
        </div>

        {q ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <QuestionView q={q} value={answers[q.id] || ''} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} disabled={!!feedback} />
            {feedback && (
              <div className={`mt-3 rounded-lg border p-3 text-xs ${feedback.status === 'correct' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : feedback.status === 'partial' ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' : 'bg-rose-500/10 border-rose-500/20 text-rose-200'}`}>
                <p className="font-medium">{feedback.status === 'correct' ? 'Correct!' : feedback.status === 'partial' ? 'Partially correct' : 'Not quite'}</p>
                <p className="text-white/70 mt-1">{feedback.explanation}</p>
              </div>
            )}
            {hint && <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200">Hint: {hint}</div>}
            {error && <p className="text-rose-300/80 text-xs mt-3">{error}</p>}
            <div className="flex items-center justify-between mt-5">
              <div className="flex gap-2">
                <button onClick={handlePrev} disabled={currentIdx === 0} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs disabled:opacity-30">Previous</button>
                <button onClick={handleHint} disabled={hintLoading || !!feedback} className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 text-xs disabled:opacity-40 flex items-center gap-1">{hintLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />} Hint</button>
              </div>
              <div className="flex gap-2">
                {!feedback ? (
                  <button onClick={handleSubmit} disabled={!String(answers[q.id] || '').trim() || submitting} className="px-4 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/20 text-cyan-200 text-xs disabled:opacity-40 flex items-center gap-1.5">{submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Submit</button>
                ) : currentIdx + 1 < total ? (
                  <button onClick={handleNext} className="px-4 py-1.5 rounded-lg bg-white/10 text-white text-xs">Next</button>
                ) : (
                  <button onClick={handleComplete} disabled={submitting} className="px-4 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-200 text-xs flex items-center gap-1.5">{submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Complete Quiz</button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-sm">No questions.</p>
        )}
      </div>
    </div>
  );
}
