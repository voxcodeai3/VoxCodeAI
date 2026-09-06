import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import * as quizApi from '../../../services/miniQuizApi';

export default function InlineQuiz({ quizId, onComplete, onBack }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [hint, setHint] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);

  useEffect(() => {
    if (!quizId) { setLoading(false); return; }
    setLoading(true);
    quizApi.getQuiz(quizId)
      .then(r => { setQuiz(r.quiz); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [quizId]);

  if (!quizId) return <div className="text-sm text-white/40 p-4">No quiz available.</div>;
  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-white/40 animate-spin" /></div>;
  if (!quiz) return <div className="text-sm text-white/40 p-4">Quiz not found.</div>;
  if (result) return <QuizResult result={result} quiz={quiz} onComplete={onComplete} onBack={onBack} />;

  const questions = quiz.questions || [];
  const q = questions[currentIdx];
  if (!q) return null;
  const total = questions.length;
  const progress = ((currentIdx + 1) / total) * 100;

  const handleAnswer = (answer) => {
    setAnswers(prev => ({ ...prev, [q.id]: answer }));
    setFeedback(null);
    setHint(null);
  };

  const handleSubmit = async () => {
    const answer = answers[q.id];
    if (!answer || submitting) return;
    setSubmitting(true);
    try {
      const r = await quizApi.submitAnswer(quizId, q.id, answer);
      setFeedback(r.evaluation);
      if (currentIdx < total - 1) {
        setTimeout(() => {
          setCurrentIdx(prev => prev + 1);
          setFeedback(null);
          setHint(null);
        }, 1500);
      } else {
        const comp = await quizApi.completeQuiz(quizId);
        setResult(comp.result);
        onComplete?.(comp.result);
      }
    } catch {
      setFeedback({ status: 'error', explanation: 'Failed to submit. Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (hintLoading) return;
    setHintLoading(true);
    try {
      const r = await quizApi.getHint(quizId, q.id);
      setHint(r.hint);
    } catch {}
    setHintLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-white/40">Question {currentIdx + 1} of {total}</span>
        <button onClick={onBack} className="text-xs text-white/40 hover:text-white/60">Back to teacher</button>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mb-5">
        <div className="h-full rounded-full bg-cyan-400/60 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {q.code && (
        <pre className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 text-xs text-white/70 font-mono mb-4 overflow-x-auto">{q.code}</pre>
      )}

      <div className="text-sm text-white/80 mb-4 leading-relaxed">{q.question}</div>

      {q.type === 'multiple_choice' || q.type === 'true_false' ? (
        <div className="space-y-2 mb-4">
          {(q.options || []).map((opt, i) => (
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

      {hint && (
        <div className="mb-3 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-xs text-amber-300">{hint}</div>
      )}

      {feedback && (
        <div className={`mb-3 p-3 rounded-lg text-xs ${
          feedback.status === 'correct'
            ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-300'
            : 'bg-rose-400/10 border border-rose-400/20 text-rose-300'
        }`}>
          {feedback.explanation}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleHint}
          disabled={hintLoading || !!feedback}
          className="px-3 py-2 rounded-lg border border-white/[0.08] text-xs text-white/50 hover:text-white/70 disabled:opacity-30"
        >
          {hintLoading ? '...' : 'Hint'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!answers[q.id] || submitting || !!feedback}
          className="flex-1 px-3 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 text-sm font-medium hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : currentIdx === total - 1 ? 'Complete' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

function QuizResult({ result, quiz, onComplete, onBack }) {
  const pct = result.percentage || 0;
  const passed = result.passed;
  const label = pct >= 80 ? 'Strong understanding' : pct >= 60 ? 'Good progress — a few areas to review' : 'Let\'s review this topic';

  return (
    <div className="max-w-lg mx-auto p-6 text-center">
      <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
        passed ? 'bg-emerald-400/15' : 'bg-amber-400/15'
      }`}>
        {passed
          ? <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          : <XCircle className="w-8 h-8 text-amber-400" />
        }
      </div>
      <div className="text-3xl font-bold text-white mb-1">{result.score}/{result.total}</div>
      <div className="text-sm text-white/50 mb-1">{pct}%</div>
      <div className={`text-sm mb-6 ${passed ? 'text-emerald-400' : 'text-amber-400'}`}>{label}</div>

      <div className="flex gap-3 justify-center">
        {!passed && (
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-white/60 hover:text-white/80 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Review Topic
          </button>
        )}
        <button
          onClick={() => onComplete?.(result)}
          className="px-4 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 text-sm font-medium hover:bg-cyan-500/25 flex items-center gap-2"
        >
          {passed ? 'Continue Learning' : 'Try Again'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
