import { useState } from 'react';
import { Play, MessageCircle, Lightbulb, Eye, CheckCircle, Loader2, AlertCircle, X, ClipboardCheck, Sparkles } from 'lucide-react';
import { useAI } from '../../context/AIContext';
import learningMemoryApi from '../../services/learningMemoryApi';
import api from '../../services/api';
import { getPracticeHint, reviewPracticeCode, completePractice, getPracticeSolution } from '../../services/practiceApi';

// Supports both:
//  - practice exercise from AI-first flow (exercise object with pathId/topicId/exerciseId)
//  - legacy lesson exercise (lesson prop)
export default function ExercisePanel({ exercise, lesson, projectId, activeFile, activeFileContent, onAskAI, onDismiss, onCompleted }) {
  const { sendMessage } = useAI();
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [hint, setHint] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [review, setReview] = useState('');
  const [solution, setSolution] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const practice = exercise && (exercise.pathId || exercise.topicId || exercise.exerciseId) ? exercise : null;
  const title = practice?.title || exercise?.title || lesson?.title || 'Exercise';
  const instructions = practice?.instructions || exercise?.instructions || lesson?.objective || 'Complete the exercise in the editor.';
  const difficulty = practice?.difficulty || null;
  const topicLabel = practice?.topicTitle || lesson?.title || null;

  const handleRun = async () => {
    if (!projectId || !activeFile) {
      setError('No file selected to run.');
      return;
    }
    setRunning(true);
    setError('');
    setOutput('');
    try {
      const { data } = await api.post(`/projects/${projectId}/run`, { filePath: activeFile });
      if (data.error) setError(data.error);
      if (data.output) setOutput(data.output);
      if (!data.error && !data.output) setOutput('(no output)');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to run code');
    } finally {
      setRunning(false);
    }
  };

  const handleAskAI = () => {
    const code = activeFileContent || '';
    const ctx = practice
      ? `Learning: ${practice.pathTitle || ''} → ${practice.stageTitle || ''} → ${practice.topicTitle || practice.topicId || ''}\nExercise: ${practice.title}\nInstructions: ${practice.instructions}\nTechnology: ${practice.technology || ''}`
      : `I'm working on "${exercise?.title || lesson?.title}" — ${exercise?.instructions || lesson?.objective || ''}`;
    const msg = practice
      ? `${ctx}\n\nMy code (${activeFile || 'file'}):\n\`\`\`\n${code}\n\`\`\`\n\n${error ? `Error:\n${error}\n\n` : ''}${output ? `Output:\n${output}\n\n` : ''}Explain the likely issue, point to the concept, and give a hint first (not the full solution).`
      : `${ctx}\n\nMy code:\n\`\`\`\n${code}\n\`\`\`\n\n${error ? `Error:\n${error}\n\n` : ''}Why am I getting this result? Explain the issue.`;
    if (onAskAI) onAskAI(msg, code, error);
    else sendMessage(msg, 'text', {
      lessonId: practice?.lessonId || lesson?._id || lesson?.lessonId,
      codingContext: {
        activeFile,
        currentCode: code,
        error,
        output,
        projectId,
        lessonId: practice?.lessonId || lesson?._id,
      },
    });
  };

  const handleHint = async () => {
    const nextLevel = Math.min(3, hintLevel + 1);
    // Practice flow: backend AI hint with exercise + code + error context
    if (practice?.pathId && practice?.topicId) {
      setHintLoading(true);
      try {
        const data = await getPracticeHint({
          pathId: practice.pathId,
          topicId: practice.topicId,
          exerciseId: practice.exerciseId,
          code: activeFileContent || '',
          output: output || '',
          error: error || '',
          hintLevel: nextLevel,
        });
        setHint(data.hint || 'Try breaking the problem into the smallest step.');
        setHintLevel(nextLevel);
      } catch (e) {
        setHint(e.response?.data?.message || 'Check whether your function actually returns the calculated value.');
      } finally {
        setHintLoading(false);
      }
      return;
    }
    // Legacy lesson flow
    setHintLoading(true);
    setHint('');
    try {
      const { data } = await api.post('/ai/chat', {
        message: `Give me a hint for this exercise without revealing the full solution: ${exercise?.title || lesson?.title} — ${exercise?.instructions || lesson?.objective || ''}`,
        lessonId: lesson?._id,
        projectId,
        codingContext: { activeFile, currentCode: activeFileContent || '', projectId },
      });
      setHint(data.message || data.response || 'Check whether your function returns the expected value.');
      setHintLevel(nextLevel);
    } catch {
      setHint('Check whether your function actually returns the calculated value.');
    } finally {
      setHintLoading(false);
    }
  };

  const handleReview = async () => {
    if (!practice?.pathId || !practice?.topicId) return;
    if (!activeFileContent?.trim()) {
      setReview('Write some code first, then ask for a review.');
      return;
    }
    setReviewLoading(true);
    setReview('');
    try {
      const data = await reviewPracticeCode({
        pathId: practice.pathId,
        topicId: practice.topicId,
        exerciseId: practice.exerciseId,
        code: activeFileContent || '',
        output: output || '',
        error: error || '',
      });
      setReview(data.feedback || 'Good effort — compare your output with the instructions.');
    } catch (e) {
      setReview(e.response?.data?.message || 'Review unavailable. Try asking the AI.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSolution = async () => {
    setSolutionLoading(true);
    setSolution('');
    try {
      if (practice?.pathId && practice?.topicId) {
        const data = await getPracticeSolution({ pathId: practice.pathId, topicId: practice.topicId, exerciseId: practice.exerciseId });
        setSolution(`${data.explanation || ''}${data.reference ? `\n\nReference:\n${data.reference}` : ''}`.trim() || 'Solution not available.');
      } else {
        const { data } = await api.post('/ai/chat', {
          message: `Show me the solution for: ${exercise?.title || lesson?.title}. Explain it step by step.`,
          lessonId: lesson?._id,
          projectId,
          codingContext: { activeFile, currentCode: activeFileContent || '', projectId },
        });
        setSolution(data.message || data.code || 'Solution not available.');
        if (data.code) setSolution(`${data.message || ''}\n\n\`\`\`\n${data.code}\n\`\`\``);
      }
    } catch {
      setSolution('Solution not available. Try asking the AI for help.');
    } finally {
      setSolutionLoading(false);
    }
  };

  const handleComplete = async () => {
    // Practice flow: verify via backend (code runs, modified from starter, no error)
    if (practice?.pathId && practice?.topicId) {
      setSubmitting(true);
      try {
        await completePractice({
          pathId: practice.pathId,
          topicId: practice.topicId,
          exerciseId: practice.exerciseId,
          code: activeFileContent || '',
          output: output || '',
          error: error || '',
          projectId,
        });
        setCompleted(true);
        if (onCompleted) onCompleted();
      } catch (e) {
        setError(e.response?.data?.message || 'Not complete yet — run your code and fix errors first.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // Legacy flow
    try {
      await learningMemoryApi.saveExercise({ lessonId: lesson?._id, topic: lesson?.title, passed: true });
      await learningMemoryApi.updateProgress({ lessonId: lesson?._id, status: 'completed' });
      setCompleted(true);
      if (onCompleted) onCompleted();
    } catch {}
  };

  if (!exercise && !lesson) return null;

  return (
    <div className="border-b border-white/[0.06] bg-[#080d1a] px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-widest text-white/40">EXERCISE</span>
          {difficulty && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 capitalize">{difficulty}</span>}
          {topicLabel && practice && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300/70">{topicLabel}</span>}
          {completed && <span className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Completed</span>}
        </div>
        {onDismiss && (
          <button onClick={onDismiss} title="Dismiss exercise" className="rounded p-1 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="text-sm font-medium text-white/80 mb-1">{title}</div>
      <div className="text-xs text-white/40 mb-3 whitespace-pre-wrap">{instructions}</div>
      {exercise?.requirements && (
        <ul className="text-xs text-white/50 mb-3 list-disc list-inside space-y-0.5">
          {exercise.requirements.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      {practice && !projectId && (
        <div className="mb-3 rounded-lg p-2.5 bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-200">
          Select or create a project before starting this exercise — your code runs in the selected project.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={handleRun} disabled={running} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-300 rounded-lg text-xs flex items-center gap-1.5 hover:bg-emerald-500/20 disabled:opacity-40">
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Run
        </button>
        <button onClick={handleAskAI} className="px-3 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs flex items-center gap-1.5 hover:bg-cyan-500/20">
          <MessageCircle className="w-3 h-3" /> Ask AI
        </button>
        <button onClick={handleHint} disabled={hintLoading} className="px-3 py-1.5 bg-amber-500/10 text-amber-300 rounded-lg text-xs flex items-center gap-1.5 hover:bg-amber-500/20 disabled:opacity-40">
          {hintLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />} {hintLevel > 0 ? `Hint ${hintLevel + 1} of 3` : 'Get Hint'}
        </button>
        {practice && (
          <button onClick={handleReview} disabled={reviewLoading} className="px-3 py-1.5 bg-violet-500/10 text-violet-300 rounded-lg text-xs flex items-center gap-1.5 hover:bg-violet-500/20 disabled:opacity-40">
            {reviewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Review my code
          </button>
        )}
        <button onClick={handleSolution} disabled={solutionLoading} className="px-3 py-1.5 bg-white/[0.06] text-white/60 rounded-lg text-xs flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-40">
          {solutionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />} Show Solution
        </button>
        <button onClick={handleComplete} disabled={completed || submitting} className="ml-auto px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-white/90 disabled:opacity-40 flex items-center gap-1.5">
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />} {completed ? 'Completed' : 'Submit'}
        </button>
      </div>

      {(output || error) && (
        <div className={`rounded-lg p-3 text-xs font-mono whitespace-pre-wrap ${error ? 'bg-red-500/5 border border-red-500/20 text-red-300' : 'bg-emerald-500/5 border border-emerald-500/10 text-emerald-300'}`}>
          {error && <div className="flex gap-1.5 mb-1"><AlertCircle className="w-3 h-3 shrink-0" /> Error</div>}
          {error || output}
        </div>
      )}
      {hint && (
        <div className="mt-2 rounded-lg p-3 bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200">
          <span className="font-medium">Hint{hintLevel > 0 ? ` ${hintLevel} of 3` : ''}:</span> {hint}
        </div>
      )}
      {review && (
        <div className="mt-2 rounded-lg p-3 bg-violet-500/5 border border-violet-500/15 text-xs text-violet-200 whitespace-pre-wrap">
          <span className="font-medium">Code review:</span> {review}
        </div>
      )}
      {solution && (
        <div className="mt-2 rounded-lg p-3 bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 whitespace-pre-wrap">
          <span className="font-medium text-white/80">Solution:</span>
          <div className="mt-1">{solution}</div>
        </div>
      )}
    </div>
  );
}
