import { useState, useCallback, useEffect } from 'react';
import {
  Play, Lightbulb, CheckCircle, XCircle, ArrowRight,
  Trophy, Target, Zap, Loader2, X, RotateCcw,
} from 'lucide-react';
import { useLearning } from '../../context/LearningContext';
import { useAI } from '../../context/AIContext';

const TYPE_LABELS = {
  practice: { label: 'Practice', icon: Target, color: 'text-cyan-300' },
  quiz: { label: 'Quiz', icon: Zap, color: 'text-amber-300' },
  challenge: { label: 'Challenge', icon: Trophy, color: 'text-violet-300' },
  interview: { label: 'Interview', icon: Target, color: 'text-emerald-300' },
};

const DIFFICULTY_COLORS = {
  easy: 'text-emerald-400 bg-emerald-400/[0.08] border-emerald-400/20',
  medium: 'text-amber-400 bg-amber-400/[0.08] border-amber-400/20',
  hard: 'text-red-400 bg-red-400/[0.08] border-red-400/20',
};

function ProgressBar({ current, total }) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-white/30">
        <span>Question {current + 1} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MultipleChoice({ options, onSelect, disabled }) {
  const labels = ['A', 'B', 'C', 'D'];
  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(opt)}
          disabled={disabled}
          className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left text-xs text-white/70 hover:border-cyan-400/20 hover:bg-cyan-400/[0.04] transition-all disabled:opacity-40"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-[10px] text-white/40">
            {labels[i]}
          </span>
          <span>{opt}</span>
        </button>
      ))}
    </div>
  );
}

function ResultsPanel({ session, onClose }) {
  const score = session.score || 0;
  const total = session.totalPossible || session.questions.length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const correctCount = session.answers?.filter((a) => a.result === 'correct').length || 0;
  const hintsUsed = session.hintsUsedTotal || 0;

  return (
    <div className="space-y-4 p-4">
      <div className="text-center space-y-2">
        <Trophy className="h-8 w-8 text-amber-400 mx-auto" />
        <p className="text-sm font-medium text-white/80">
          {session.type === 'quiz' ? 'QUIZ' : 'PRACTICE'} COMPLETE
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
          <p className="text-lg font-semibold text-cyan-300">{correctCount}/{total}</p>
          <p className="text-[10px] text-white/30">Score</p>
        </div>
        <div className="text-center rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
          <p className="text-lg font-semibold text-emerald-300">{pct}%</p>
          <p className="text-[10px] text-white/30">Accuracy</p>
        </div>
        <div className="text-center rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
          <p className="text-lg font-semibold text-amber-300">{hintsUsed}</p>
          <p className="text-[10px] text-white/30">Hints Used</p>
        </div>
      </div>

      {session.topic && (
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
          <p className="text-[10px] text-white/30 mb-1">Topic</p>
          <p className="text-xs text-white/60">{session.topic}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.12] transition-all"
      >
        Close
      </button>
    </div>
  );
}

export default function LearningWorkspace({ isOpen, onClose }) {
  const { session, addQuestion, submitAnswer, requestHint, completeSession, generating, setGenerating } = useLearning();
  const { sendMessage } = useAI();

  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [currentHint, setCurrentHint] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);

  const currentQ = session?.questions?.[session.currentQuestion];
  const isComplete = session?.status === 'completed' || showResults;
  const isMultipleChoice = currentQ?.type === 'multiple_choice' || currentQ?.type === 'true_false';

  // Generate first question when session starts with no questions.
  useEffect(() => {
    if (!isOpen || !session || session.questions.length > 0 || generating) return;
    generateQuestion();
  }, [isOpen, session?.id]);

  const generateQuestion = useCallback(async () => {
    if (!session) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/ai/chat', {
        message: `Generate a ${session.difficulty} ${session.type} question about ${session.topic || 'programming'} in ${session.language || 'javascript'}. Return ONLY the JSON with question, type, options, hints, solution, explanation, code fields.`,
        teachingMode: session.type,
        language: session.language,
        codingContext: { action: 'generate_question', topic: session.topic, difficulty: session.difficulty, type: session.type },
      });

      // Parse the AI response for the question.
      let questionData;
      try {
        const raw = data.message || '';
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        questionData = JSON.parse(raw.slice(start, end + 1));
      } catch {
        questionData = {
          question: data.message || 'Describe a coding concept.',
          type: 'conceptual',
          options: [],
          hints: [],
          solution: data.code || null,
          explanation: null,
          code: null,
          expectedConcepts: [],
        };
      }

      await addQuestion({
        question: questionData.question,
        type: ['multiple_choice', 'coding', 'debugging', 'output_prediction', 'conceptual', 'true_false'].includes(questionData.type) ? questionData.type : 'conceptual',
        options: questionData.options || [],
        hints: questionData.hints || [],
        solution: questionData.solution || null,
        explanation: questionData.explanation || null,
        code: questionData.code || null,
        expectedConcepts: questionData.expectedConcepts || [],
        topic: session.topic,
        language: session.language,
        difficulty: session.difficulty,
      });
    } catch (err) {
      console.error('Failed to generate question:', err);
    } finally {
      setGenerating(false);
    }
  }, [session, addQuestion, setGenerating]);

  const handleHint = useCallback(async () => {
    if (!session || !currentQ) return;
    try {
      const data = await requestHint(hintIndex);
      setCurrentHint(data.hint);
      setHintIndex((i) => i + 1);
    } catch { /* noop */ }
  }, [session, currentQ, hintIndex, requestHint]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!session || !currentQ) return;
    const userAnswer = isMultipleChoice ? selectedOption : answer;
    if (!userAnswer) return;

    setGenerating(true);
    try {
      // Send to AI for evaluation via the chat endpoint.
      const { data } = await api.post('/ai/chat', {
        message: `Evaluate this answer to the question: "${currentQ.question}"\n\nExpected concepts: ${(currentQ.expectedConcepts || []).join(', ')}\n${currentQ.solution ? `Solution: ${currentQ.solution}` : ''}\nStudent answer: ${userAnswer}\n\nReturn JSON: {"result":"correct|partially_correct|incorrect","score":0.0-1.0,"feedback":"...","explanation":"..."}`,
        teachingMode: 'practice',
        language: session.language,
      });

      let evalResult;
      try {
        const raw = data.message || '';
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        evalResult = JSON.parse(raw.slice(start, end + 1));
      } catch {
        evalResult = { result: 'incorrect', score: 0, feedback: 'Could not evaluate.', explanation: null };
      }

      const result = {
        answer: userAnswer,
        result: evalResult.result || 'incorrect',
        score: typeof evalResult.score === 'number' ? evalResult.score : (evalResult.result === 'correct' ? 1 : 0),
        feedback: evalResult.feedback || 'No feedback.',
        hintsUsed: hintIndex,
      };

      await submitAnswer(result);
      setFeedback(evalResult);
      setAnswerResult(result);
    } catch (err) {
      console.error('Failed to evaluate:', err);
    } finally {
      setGenerating(false);
    }
  }, [session, currentQ, answer, selectedOption, isMultipleChoice, hintIndex, submitAnswer]);

  const handleNext = useCallback(async () => {
    setAnswer('');
    setSelectedOption(null);
    setCurrentHint(null);
    setFeedback(null);
    setAnswerResult(null);
    setHintIndex(0);

    if (session && session.currentQuestion >= session.questions.length - 1) {
      await completeSession('complete');
      setShowResults(true);
    } else {
      await generateQuestion();
    }
  }, [session, completeSession, generateQuestion]);

  const handleClose = useCallback(() => {
    setShowResults(false);
    setAnswer('');
    setSelectedOption(null);
    setCurrentHint(null);
    setFeedback(null);
    setAnswerResult(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const typeConfig = TYPE_LABELS[session?.type] || TYPE_LABELS.practice;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-[90vw] max-w-[560px] max-h-[85vh] rounded-3xl border border-cyan-400/15 bg-[#060c18]/95 backdrop-blur-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
            <span className="text-xs font-medium text-white/70">{typeConfig.label.toUpperCase()}</span>
            {session?.topic && (
              <span className="text-[10px] text-white/30">· {session.topic}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session?.difficulty && (
              <span className={`rounded-full border px-2 py-0.5 text-[9px] ${DIFFICULTY_COLORS[session.difficulty]}`}>
                {session.difficulty}
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {showResults ? (
            <ResultsPanel session={session} onClose={handleClose} />
          ) : generating && !currentQ ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <Loader2 className="h-5 w-5 animate-spin mb-3" />
              <p className="text-xs">Generating question...</p>
            </div>
          ) : currentQ ? (
            <>
              {/* Progress */}
              <ProgressBar current={session.currentQuestion} total={session.questions.length} />

              {/* Question */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                {currentQ.code && (
                  <pre className="rounded-lg bg-black/30 border border-white/[0.04] p-3 text-[11px] font-mono text-emerald-300/70 overflow-x-auto whitespace-pre">
                    {currentQ.code}
                  </pre>
                )}
                <p className="text-sm text-white/80 leading-relaxed">{currentQ.question}</p>
              </div>

              {/* Answer input */}
              {!feedback && (
                isMultipleChoice ? (
                  <MultipleChoice
                    options={currentQ.options}
                    onSelect={setSelectedOption}
                    disabled={generating}
                  />
                ) : (
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-xs text-white/80 placeholder:text-white/20 focus:border-cyan-400/30 focus:outline-none resize-none"
                    disabled={generating}
                  />
                )
              )}

              {/* Hint */}
              {currentHint && (
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3 flex items-start gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-400/60 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-300/70 leading-relaxed">{currentHint}</p>
                </div>
              )}

              {/* Feedback */}
              {feedback && (
                <div className={`rounded-xl border p-4 space-y-2 ${
                  answerResult?.result === 'correct'
                    ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
                    : 'border-amber-400/20 bg-amber-400/[0.04]'
                }`}>
                  <div className="flex items-center gap-2">
                    {answerResult?.result === 'correct' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-400" />
                    )}
                    <span className={`text-xs font-medium ${
                      answerResult?.result === 'correct' ? 'text-emerald-300' : 'text-amber-300'
                    }`}>
                      {answerResult?.result === 'correct' ? 'Correct!' : answerResult?.result === 'partially_correct' ? 'Partially Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">{feedback.feedback}</p>
                  {feedback.explanation && (
                    <p className="text-[11px] text-white/40 leading-relaxed">{feedback.explanation}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-white/20">
              <p className="text-xs">No active question</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showResults && (
          <div className="border-t border-white/[0.04] px-5 py-3 flex items-center gap-2">
            {feedback ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-all"
              >
                {session?.currentQuestion >= session?.questions?.length - 1 ? 'Finish' : 'Next'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                {!isMultipleChoice && currentQ?.hints?.length > 0 && hintIndex < currentQ.hints.length && (
                  <button
                    type="button"
                    onClick={handleHint}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[10px] text-amber-300/60 hover:text-amber-300 transition-colors"
                  >
                    <Lightbulb className="h-3 w-3" />
                    Hint {hintIndex + 1}
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={generating || (!answer && !selectedOption)}
                  className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-all disabled:opacity-40"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Submit
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
