import { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { X, Play, Lightbulb, RotateCcw, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useAI } from '../../context/AIContext';

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php', swift: 'swift',
  kt: 'kotlin', sql: 'sql', html: 'html', css: 'css', json: 'json',
  md: 'markdown', sh: 'shell', yml: 'yaml', yaml: 'yaml',
};

function detectLanguage(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'plaintext';
}

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TOPICS = ['javascript', 'react', 'node', 'python', 'data_structures', 'algorithms', 'general'];

export default function CodePractice({ isOpen, onClose }) {
  const { practiceState, sendPracticeMessage, clearPractice, isThinking } = useAI();
  const [code, setCode] = useState('// Write your code here\n');
  const [language, setLanguage] = useState('javascript');
  const [topic, setTopic] = useState('javascript');
  const [difficulty, setDifficulty] = useState('medium');
  const [hintIndex, setHintIndex] = useState(0);
  const [showConfig, setShowConfig] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode('// Write your code here\n');
    setHintIndex(0);
  }, [isOpen]);

  const handleGenerate = useCallback(async () => {
    setShowConfig(false);
    setCode('// Write your code here\n');
    setHintIndex(0);
    setError(null);
    const result = await sendPracticeMessage(
      `Generate a ${difficulty} coding question about ${topic}`,
      'generate',
      { topic, difficulty, type: 'coding' }
    );
    if (!result) setError('Failed to generate question. Is the backend server running?');
  }, [sendPracticeMessage, topic, difficulty]);

  const handleSubmit = useCallback(async () => {
    if (!practiceState?.question) return;
    setError(null);
    const questionText = typeof practiceState.question === 'string'
      ? practiceState.question
      : practiceState.question.question || JSON.stringify(practiceState.question);
    const expectedConcepts = practiceState.question?.expectedConcepts || [];

    const result = await sendPracticeMessage(
      `Evaluate this code answer`,
      'evaluate',
      {
        question: questionText,
        code,
        expectedConcepts,
        difficulty,
      }
    );
    if (!result) setError('Failed to evaluate answer. Is the backend server running?');
  }, [sendPracticeMessage, practiceState, code, difficulty]);

  const handleHint = useCallback(() => {
    if (!practiceState?.question?.hints?.length) return;
    setHintIndex((prev) => Math.min(prev + 1, practiceState.question.hints.length));
  }, [practiceState]);

  const handleReset = useCallback(() => {
    clearPractice();
    setCode('// Write your code here\n');
    setHintIndex(0);
    setShowConfig(true);
    setError(null);
  }, [clearPractice]);

  if (!isOpen) return null;

  const question = practiceState?.question;
  const evaluation = practiceState?.type === 'evaluation' ? practiceState.feedback : null;
  const hints = question?.hints || [];
  const questionText = typeof question === 'string' ? question : question?.question;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[95vw] max-w-[1100px] h-[85vh] rounded-3xl border border-cyan-400/15 bg-[#060c18]/95 backdrop-blur-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-400/10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full border border-cyan-400/20 bg-cyan-400/10 flex items-center justify-center">
              <Play className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">PRACTICE</p>
              <p className="text-[10px] text-cyan-400/40">
                {showConfig ? 'Configure your session' : `${topic} · ${difficulty}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-cyan-400/40 hover:text-cyan-300 hover:bg-white/[0.05] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Config screen */}
        {showConfig && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-sm space-y-5">
              <div>
                <label className="text-[10px] text-cyan-400/50 uppercase tracking-wider mb-1.5 block">Topic</label>
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      className={`rounded-full px-3 py-1.5 text-[11px] border transition-all ${
                        topic === t
                          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-cyan-400/50 uppercase tracking-wider mb-1.5 block">Difficulty</label>
                <div className="flex gap-1.5">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 rounded-xl px-3 py-2 text-[11px] border transition-all ${
                        difficulty === d
                          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isThinking}
                className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-300 hover:bg-cyan-400/[0.12] transition-all disabled:opacity-40"
              >
                {isThinking ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                  </span>
                ) : (
                  'Start Practice'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Main content: Question + Editor */}
        {!showConfig && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Question panel */}
            <div className="w-[320px] shrink-0 border-r border-cyan-400/10 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Question */}
                {isThinking && (
                  <div className="flex items-center justify-center h-32 text-cyan-400/30 text-xs gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating question...
                  </div>
                )}
                {!isThinking && !questionText && !error && (
                  <div className="flex items-center justify-center h-32 text-white/20 text-xs">
                    No active question
                  </div>
                )}
                {!isThinking && error && (
                  <div className="rounded-xl border border-red-400/15 bg-red-400/[0.03] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400/60" />
                      <p className="text-[10px] text-red-400/50 uppercase tracking-wider font-medium">Error</p>
                    </div>
                    <p className="text-[11px] text-red-300/50 leading-relaxed">{error}</p>
                  </div>
                )}
                {!isThinking && questionText && !error && (
                  <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] p-3 space-y-2">
                    <p className="text-[10px] text-cyan-400/50 uppercase tracking-wider font-medium">Question</p>
                    <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">{questionText}</p>
                    {question?.code && (
                      <pre className="mt-2 rounded-lg bg-black/30 p-2 text-[10px] text-cyan-300/60 overflow-x-auto whitespace-pre-wrap">
                        {question.code}
                      </pre>
                    )}
                  </div>
                )}

                {/* Hints */}
                {hints.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-amber-400/50 uppercase tracking-wider font-medium flex items-center gap-1.5">
                        <Lightbulb className="h-3 w-3" /> Hints
                      </p>
                      <span className="text-[9px] text-white/20">{hintIndex}/{hints.length}</span>
                    </div>
                    {hints.slice(0, hintIndex).map((h, i) => (
                      <div key={i} className="rounded-lg border border-amber-400/10 bg-amber-400/[0.03] p-2.5">
                        <p className="text-[11px] text-amber-300/60 leading-relaxed">{h}</p>
                      </div>
                    ))}
                    {hintIndex < hints.length && (
                      <button
                        type="button"
                        onClick={handleHint}
                        className="w-full rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[11px] text-amber-300/60 hover:bg-amber-400/[0.08] transition-all"
                      >
                        Show Hint {hintIndex + 1}
                      </button>
                    )}
                  </div>
                )}

                {/* Evaluation feedback */}
                {evaluation && (
                  <div className={`rounded-xl border p-3 space-y-2 ${
                    evaluation.result === 'correct'
                      ? 'border-emerald-400/15 bg-emerald-400/[0.03]'
                      : 'border-amber-400/15 bg-amber-400/[0.03]'
                  }`}>
                    <div className="flex items-center gap-2">
                      {evaluation.result === 'correct' ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400/60" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400/60" />
                      )}
                      <p className="text-[10px] uppercase tracking-wider font-medium text-white/50">
                        {evaluation.result === 'correct' ? 'Correct!' : 'Feedback'}
                      </p>
                      {evaluation.score != null && (
                        <span className="ml-auto text-[10px] text-white/30">{Math.round(evaluation.score * 100)}%</span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 leading-relaxed">{evaluation.feedback}</p>
                    {evaluation.explanation && (
                      <p className="text-[10px] text-white/30 leading-relaxed mt-1">{evaluation.explanation}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="border-t border-cyan-400/10 p-3 space-y-2">
                {practiceState?.type === 'evaluation' ? (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isThinking}
                    className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.12] transition-all disabled:opacity-40"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isThinking || !questionText}
                    className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.12] transition-all disabled:opacity-40"
                  >
                    {isThinking ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Evaluating...
                      </span>
                    ) : (
                      'Submit Code'
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.04] transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3 w-3" /> New Session
                </button>
              </div>
            </div>

            {/* Right: Monaco editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-cyan-400/10">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[10px] text-white/50 outline-none"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
              </div>
              <div className="flex-1">
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={(val) => setCode(val || '')}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    minimap: { enabled: false },
                    padding: { top: 16, bottom: 16 },
                    bracketPairColorization: { enabled: true },
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
