import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Clock, AlertTriangle, Send, Lightbulb, Eye, EyeOff } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';

const DifficultyBadge = ({ level }) => {
  const colors = {
    easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hard: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[level] || colors.medium}`}>
      {level}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const labels = {
    multiple_choice: 'MCQ',
    true_false: 'T/F',
    code_output: 'Output',
    debugging: 'Debug',
    code_completion: 'Complete',
    coding: 'Code',
    short_answer: 'Short',
    conceptual: 'Concept',
  };
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40">
      {labels[type] || type}
    </span>
  );
};

export default function AssessmentPlayer() {
  const navigate = useNavigate();
  const { attemptId } = useParams();
  const {
    currentAttempt, currentQuestion, fetchAttempt,
    submitAnswer, completeAttempt, loading,
  } = useAssessment();

  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    fetchAttempt(attemptId);
  }, [attemptId]);

  useEffect(() => {
    if (currentAttempt?.status === 'completed' || currentAttempt?.status === 'timed_out') {
      navigate(`/assessments/result/${attemptId}`);
      return;
    }
  }, [currentAttempt]);

  useEffect(() => {
    if (currentQuestion) {
      setAnswer('');
      setFeedback(null);
      setHintsUsed(0);
      setShowHints(false);
      setHintIndex(0);
      startTimeRef.current = Date.now();
    }
  }, [currentQuestion?._id]);

  useEffect(() => {
    if (currentAttempt?.status === 'in_progress') {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(currentAttempt.startedAt).getTime()) / 1000);
        const total = (currentAttempt.timeSpentSeconds || 0) + elapsed;
        setTimeLeft(total);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [currentAttempt?.status]);

  if (loading && !currentAttempt) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm font-mono">Loading assessment...</div>
      </div>
    );
  }

  if (!currentAttempt || !currentQuestion) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-center">
          <div className="text-white/40 text-sm mb-4">No active question</div>
          <button
            onClick={() => navigate('/assessments')}
            className="px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm"
          >
            Back to Assessments
          </button>
        </div>
      </div>
    );
  }

  const questionNum = currentAttempt.answers.length + 1;
  const totalQuestions = currentAttempt.totalQuestions;
  const progress = totalQuestions > 0 ? (currentAttempt.answers.length / totalQuestions) * 100 : 0;

  const handleSubmit = async () => {
    if (submitting || !answer.trim()) return;
    setSubmitting(true);
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    const result = await submitAnswer(attemptId, {
      questionId: currentQuestion._id,
      answer: answer.trim(),
      timeSpentSeconds: timeSpent,
      hintsUsed,
    });
    if (result) {
      setFeedback({
        correct: result.correct,
        score: result.score,
        explanation: result.explanation,
        correctAnswer: result.correctAnswer,
      });
    }
    setSubmitting(false);
  };

  const handleNext = async () => {
    if (!feedback) return;
    if (!currentQuestion) {
      await completeAttempt(attemptId);
      navigate(`/assessments/result/${attemptId}`);
    }
  };

  const handleHint = () => {
    setShowHints(true);
    setHintIndex((h) => Math.min(h + 1, 3));
    setHintsUsed((h) => h + 1);
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/assessments')}
            className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" /> Exit
          </button>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span>Question {questionNum} / {totalQuestions}</span>
            <DifficultyBadge level={currentAttempt.currentDifficulty} />
            <TypeBadge type={currentQuestion.type} />
          </div>
          {timeLeft !== null && (
            <div className="text-xs text-white/40 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-white/5 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-cyan-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Mode Badge */}
        <div className="mb-4">
          <span className={`text-xs px-3 py-1 rounded-full ${
            currentAttempt.mode === 'exam'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : currentAttempt.mode === 'practice'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
          }`}>
            {currentAttempt.mode === 'exam' ? 'ASSESSMENT MODE — AI ASSISTANCE DISABLED' :
             currentAttempt.mode === 'placement' ? 'PLACEMENT TEST' :
             'PRACTICE MODE — AI HINTS AVAILABLE'}
          </span>
        </div>

        {/* Question */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-white/30 capitalize">{currentQuestion.skill}</span>
          </div>
          <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap mb-4">
            {currentQuestion.prompt}
          </div>

          {currentQuestion.code && (
            <pre className="bg-black/40 border border-white/[0.06] rounded-lg p-4 overflow-x-auto mb-4">
              <code className="text-sm text-cyan-300 font-mono whitespace-pre">{currentQuestion.code}</code>
            </pre>
          )}

          {/* Answer Input */}
          {currentQuestion.type === 'multiple_choice' && (
            <div className="space-y-2">
              {currentQuestion.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => !feedback && setAnswer(opt)}
                  disabled={!!feedback}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                    answer === opt
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.04]'
                  } ${feedback ? 'cursor-default' : ''}`}
                >
                  <span className="text-white/30 mr-2">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'true_false' && (
            <div className="flex gap-3">
              {['true', 'false'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => !feedback && setAnswer(opt)}
                  disabled={!!feedback}
                  className={`flex-1 px-4 py-3 rounded-lg border text-sm capitalize transition-all ${
                    answer === opt
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {(currentQuestion.type === 'code_output' || currentQuestion.type === 'conceptual' ||
            currentQuestion.type === 'short_answer') && (
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !feedback && handleSubmit()}
              disabled={!!feedback}
              placeholder="Type your answer..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/30"
            />
          )}

          {(currentQuestion.type === 'coding' || currentQuestion.type === 'code_completion' ||
            currentQuestion.type === 'debugging') && (
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={!!feedback}
              placeholder="Write your code here..."
              rows={8}
              className="w-full bg-black/40 border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-cyan-300 font-mono placeholder-white/20 focus:outline-none focus:border-cyan-500/30 resize-none"
            />
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-xl p-4 mb-6 border ${
            feedback.correct
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className={`text-sm font-medium mb-2 ${feedback.correct ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback.correct ? '✓ Correct!' : '✗ Incorrect'}
            </div>
            {feedback.explanation && (
              <p className="text-sm text-white/60 mb-2">{feedback.explanation}</p>
            )}
            {!feedback.correct && feedback.correctAnswer && (
              <p className="text-xs text-white/40">Answer: {feedback.correctAnswer}</p>
            )}
          </div>
        )}

        {/* Hints */}
        {currentQuestion.hints?.length > 0 && !feedback && currentAttempt.mode !== 'exam' && (
          <div className="mb-6">
            <button
              onClick={handleHint}
              className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20 transition-colors flex items-center gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              {showHints ? `Hint ${hintIndex} of ${Math.min(3, currentQuestion.hints.length)}` : 'Need a hint?'}
            </button>
            {showHints && (
              <div className="mt-2 space-y-1">
                {currentQuestion.hints.slice(0, hintIndex).map((hint, i) => (
                  <div key={i} className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-sm text-amber-300/70">
                    Hint {i + 1}: {hint}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/30">
            {currentAttempt.recentWindow?.length > 0 && (
              <span>Recent: {currentAttempt.recentWindow.filter(Boolean).length}/{currentAttempt.recentWindow.length} correct</span>
            )}
          </div>
          <div className="flex gap-3">
            {!feedback ? (
              <button
                onClick={handleSubmit}
                disabled={submitting || !answer.trim()}
                className="px-5 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-5 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors"
              >
                {questionNum >= totalQuestions ? 'Finish' : 'Next Question'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
