import { useState } from 'react';
import { Play, MessageCircle, Lightbulb, Eye, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useAI } from '../../context/AIContext';
import { useProject } from '../../context/ProjectContext';
import learningMemoryApi from '../../services/learningMemoryApi';
import api from '../../services/api';

export default function ExercisePanel({ exercise, lesson, projectId, activeFile, activeFileContent, onAskAI }) {
  const { sendMessage } = useAI();
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [hint, setHint] = useState('');
  const [solution, setSolution] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

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
    const msg = `I'm working on "${exercise?.title || lesson?.title}" — ${exercise?.instructions || lesson?.objective || ''}\n\nMy code:\n\`\`\`\n${code}\n\`\`\`\n\n${error ? `Error:\n${error}\n\n` : ''}Why am I getting this result? Explain the issue.`;
    if (onAskAI) onAskAI(msg, code, error);
    else sendMessage(msg, 'text', {
      lessonId: lesson?._id,
      codingContext: { activeFile, currentCode: code, error, projectId },
    });
  };

  const handleHint = async () => {
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
    } catch {
      setHint('Check whether your function actually returns the calculated value.');
    } finally {
      setHintLoading(false);
    }
  };

  const handleSolution = async () => {
    setSolutionLoading(true);
    setSolution('');
    try {
      const { data } = await api.post('/ai/chat', {
        message: `Show me the solution for: ${exercise?.title || lesson?.title}. Explain it step by step.`,
        lessonId: lesson?._id,
        projectId,
        codingContext: { activeFile, currentCode: activeFileContent || '', projectId },
      });
      setSolution(data.message || data.code || 'Solution not available.');
      // also try to get code field
      if (data.code) setSolution(`${data.message || ''}\n\n\`\`\`\n${data.code}\n\`\`\``);
    } catch {
      setSolution('Solution not available. Try asking the AI for help.');
    } finally {
      setSolutionLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      await learningMemoryApi.saveExercise({ lessonId: lesson?._id, topic: lesson?.title, passed: true });
      // also mark lesson as in_progress at least
      await learningMemoryApi.updateProgress({ lessonId: lesson?._id, status: 'completed' });
      setCompleted(true);
    } catch {}
  };

  if (!exercise && !lesson) return null;

  return (
    <div className="border-b border-white/[0.06] bg-[#080d1a] px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] tracking-widest text-white/40">EXERCISE</span>
        {completed && <span className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Completed</span>}
      </div>
      <div className="text-sm font-medium text-white/80 mb-1">{exercise?.title || lesson?.title}</div>
      <div className="text-xs text-white/40 mb-3">
        {exercise?.instructions || lesson?.objective || 'Complete the exercise in the editor.'}
      </div>
      {exercise?.requirements && (
        <ul className="text-xs text-white/50 mb-3 list-disc list-inside space-y-0.5">
          {exercise.requirements.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={handleRun} disabled={running} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-300 rounded-lg text-xs flex items-center gap-1.5 hover:bg-emerald-500/20 disabled:opacity-40">
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Run
        </button>
        <button onClick={handleAskAI} className="px-3 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs flex items-center gap-1.5 hover:bg-cyan-500/20">
          <MessageCircle className="w-3 h-3" /> Ask AI
        </button>
        <button onClick={handleHint} disabled={hintLoading} className="px-3 py-1.5 bg-amber-500/10 text-amber-300 rounded-lg text-xs flex items-center gap-1.5 hover:bg-amber-500/20 disabled:opacity-40">
          {hintLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />} Get Hint
        </button>
        <button onClick={handleSolution} disabled={solutionLoading} className="px-3 py-1.5 bg-white/[0.06] text-white/60 rounded-lg text-xs flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-40">
          {solutionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />} Show Solution
        </button>
        <button onClick={handleComplete} disabled={completed} className="ml-auto px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-white/90 disabled:opacity-40 flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3" /> {completed ? 'Completed' : 'Mark Complete'}
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
          <span className="font-medium">Hint:</span> {hint}
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
