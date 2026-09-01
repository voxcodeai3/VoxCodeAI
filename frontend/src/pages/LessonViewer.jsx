import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BookOpen, Play, CheckCircle, Send, Lightbulb } from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ContentBlock = ({ block }) => {
  if (!block) return null;

  if (block.type === 'text') {
    return (
      <div className="mb-4">
        {block.title && <h3 className="text-sm font-semibold text-white/70 mb-2">{block.title}</h3>}
        <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{block.content}</p>
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className="mb-4">
        {block.title && <h3 className="text-sm font-semibold text-white/70 mb-2">{block.title}</h3>}
        <pre className="bg-black/40 border border-white/[0.06] rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-cyan-300 font-mono whitespace-pre">{block.content}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {block.title && <h3 className="text-sm font-semibold text-white/70 mb-2">{block.title}</h3>}
      <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{block.content}</p>
    </div>
  );
};

export default function LessonViewer() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const { user } = useAuth();
  const { currentLesson, fetchLesson, updateLessonProgress, clearLesson } = useCourse();
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [askText, setAskText] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [askingAi, setAskingAi] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const responseRef = useRef(null);
  const lessonRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setCompleted(false);
    setStarted(false);
    setAiResponse('');
    setShowHint(false);
    setHintIndex(0);
    fetchLesson(lessonId).finally(() => setLoading(false));

    return () => clearLesson();
  }, [lessonId]);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [aiResponse]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await updateLessonProgress({
        lessonId,
        courseId: currentLesson?.module?._id,
        status: 'completed',
        progress: 100,
        score: 100,
      });
      setCompleted(true);
    } finally {
      setCompleting(false);
    }
  };

  const handleStartLesson = async () => {
    if (starting || started) return;
    setStarting(true);
    try {
      await updateLessonProgress({
        lessonId,
        courseId: currentLesson?.module?.course || currentLesson?.module?._id,
        status: 'in_progress',
        progress: 10,
      });
      setStarted(true);
      setTimeout(() => lessonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } finally {
      setStarting(false);
    }
  };

  const handleAskAi = async () => {
    if (!askText.trim() || askingAi) return;
    setAskingAi(true);
    setAiResponse('');
    try {
      const { data } = await api.post('/ai/chat', {
        message: `[Lesson Context: ${currentLesson?.title}] ${askText}`,
        context: {
          mode: 'lesson',
          lessonTitle: currentLesson?.title,
          lessonType: currentLesson?.type,
          lessonContent: currentLesson?.content?.map((c) => c.content).join('\n') || '',
        },
      });
      setAiResponse(data.response || data.message || 'No response received.');
    } catch (err) {
      setAiResponse('AI is temporarily unavailable. Please try again.');
    } finally {
      setAskingAi(false);
    }
  };

  const handleExplainAgain = async () => {
    setAskingAi(true);
    setAiResponse('');
    try {
      const { data } = await api.post('/ai/chat', {
        message: `[Lesson: ${currentLesson?.title}] Explain this lesson again in a simpler way with a different analogy.`,
        context: {
          mode: 'lesson',
          lessonTitle: currentLesson?.title,
          requestType: 'explain_again',
        },
      });
      setAiResponse(data.response || data.message || 'No response received.');
    } catch (err) {
      setAiResponse('AI is temporarily unavailable.');
    } finally {
      setAskingAi(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm font-mono">Loading lesson...</div>
      </div>
    );
  }

  if (!currentLesson) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-white/40 text-sm">Lesson not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-white/40 hover:text-white/60 mb-3 flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" />
            Back
          </button>
          <div className="text-xs text-white/30 mb-1">
            {currentLesson.module?.title}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{currentLesson.title}</h1>
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span className="capitalize">{currentLesson.type}</span>
            <span>·</span>
            <span>{currentLesson.estimatedMinutes} min</span>
            <span>·</span>
            <span className="capitalize">{currentLesson.difficulty}</span>
          </div>
        </div>

        {/* Start Button */}
        {!completed && (
          <div className="mb-6">
            <button
              onClick={handleStartLesson}
              disabled={starting || started}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                started
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
              } disabled:opacity-60`}
            >
              {started ? <CheckCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {starting ? 'Starting...' : started ? 'Lesson Started' : 'Start Lesson'}
            </button>
            {started && <p className="text-xs text-emerald-400/60 mt-2">Progress saved — keep reading below.</p>}
          </div>
        )}

        {/* Lesson Content */}
        <div ref={lessonRef} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            LESSON
          </h2>
          {currentLesson.content?.map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}
          {(!currentLesson.content || currentLesson.content.length === 0) && (
            <p className="text-white/30 text-sm italic">No content available for this lesson yet.</p>
          )}
        </div>

        {/* Complete Button */}
        <div className="mb-6">
          {completed ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-sm text-emerald-400 font-medium">Lesson Completed!</div>
                <div className="text-xs text-white/40">Great work. Keep learning!</div>
              </div>
              {currentLesson.nextLesson && (
                <button
                  onClick={() => navigate(`/learn/lesson/${currentLesson.nextLesson._id}`)}
                  className="ml-auto px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                >
                  Next Lesson <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="px-5 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {completing ? 'Completing...' : 'Mark as Complete'}
            </button>
          )}
        </div>

        {/* Hint */}
        {currentLesson.type === 'exercise' && (
          <div className="mb-6">
            <button
              onClick={() => {
                setShowHint(true);
                setHintIndex((h) => Math.min(h + 1, 3));
              }}
              className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20 transition-colors flex items-center gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              {showHint ? `Hint ${hintIndex} of 3` : 'Need a hint?'}
            </button>
            {showHint && (
              <div className="mt-2 bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-sm text-amber-300/70">
                {hintIndex >= 1 && <p className="mb-1">Hint 1: Think about the structure of the data you need to work with.</p>}
                {hintIndex >= 2 && <p className="mb-1">Hint 2: Try breaking the problem into smaller steps.</p>}
                {hintIndex >= 3 && <p>Hint 3: Look at similar examples in the lesson content above.</p>}
              </div>
            )}
          </div>
        )}

        {/* AI Assistant */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white/60 mb-3">Ask VoxCode</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
              placeholder="Ask about this lesson..."
              className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/30"
            />
            <button
              onClick={handleAskAi}
              disabled={askingAi || !askText.trim()}
              className="px-4 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/20 transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleExplainAgain}
              disabled={askingAi}
              className="px-3 py-1.5 bg-white/5 text-white/50 rounded text-xs hover:bg-white/10 transition-colors"
            >
              Explain Again
            </button>
            <button
              onClick={() => { setAskText('Why does this code work?'); }}
              className="px-3 py-1.5 bg-white/5 text-white/50 rounded text-xs hover:bg-white/10 transition-colors"
            >
              Why does this work?
            </button>
            <button
              onClick={() => { setAskText('Can this be written differently?'); }}
              className="px-3 py-1.5 bg-white/5 text-white/50 rounded text-xs hover:bg-white/10 transition-colors"
            >
              Different approach?
            </button>
          </div>
          {askingAi && (
            <div className="text-cyan-400/60 text-sm animate-pulse">Thinking...</div>
          )}
          {aiResponse && !askingAi && (
            <div ref={responseRef} className="bg-black/20 border border-white/[0.04] rounded-lg p-4 text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
              {aiResponse}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {currentLesson.prevLesson ? (
            <button
              onClick={() => navigate(`/learn/lesson/${currentLesson.prevLesson._id}`)}
              className="px-4 py-2 bg-white/5 text-white/50 rounded-lg text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-3 h-3" />
              {currentLesson.prevLesson.title}
            </button>
          ) : <div />}
          {currentLesson.nextLesson ? (
            <button
              onClick={() => navigate(`/learn/lesson/${currentLesson.nextLesson._id}`)}
              className="px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/20 transition-colors flex items-center gap-2"
            >
              {currentLesson.nextLesson.title}
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}
