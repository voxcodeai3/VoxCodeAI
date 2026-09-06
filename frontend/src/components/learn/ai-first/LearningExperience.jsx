import { useState, useEffect, useCallback } from 'react';
import { Loader2, ArrowLeft, ArrowRight, BookOpen, Code2, CheckCircle2, RotateCcw, ChevronLeft } from 'lucide-react';
import api from '../../../services/api';
import learningApi from '../../../services/learningApi';
import { getReview, getProgressSummary, getProgressionCheck, markReviewed } from '../../../services/progressApi';
import { storePracticeContext } from '../../../services/practiceApi';
import { startPractice } from '../../../services/practiceApi';
import Roadmap from './Roadmap';
import AITeacher from './AITeacher';
import TeachingProgress from './TeachingProgress';
import InlineQuiz from './InlineQuiz';

export default function LearningExperience({ pathId, onSwitchPath }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [summary, setSummary] = useState(null);
  const [reviewItems, setReviewItems] = useState([]);
  const [session, setSession] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [position, setPosition] = useState(null);
  const [teachingState, setTeachingState] = useState('teaching');
  const [view, setView] = useState('teacher'); // 'teacher' | 'quiz'
  const [quizId, setQuizId] = useState(null);
  const [progression, setProgression] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!pathId) return;
    setLoading(true);
    setError(null);
    try {
      const [roadmapRes, summaryRes, reviewRes, currentRes] = await Promise.all([
        api.get(`/learning/paths/${pathId}/roadmap`),
        getProgressSummary(pathId).catch(() => null),
        getReview(pathId).catch(() => []),
        api.get('/learning/teaching/session/current'),
      ]);

      setRoadmap(roadmapRes.data);
      setSummary(summaryRes);
      setReviewItems(reviewRes || []);

      if (currentRes.data.hasActive && currentRes.data.session) {
        setSession(currentRes.data.session);
        setSessionId(currentRes.data.session._id);
        setPosition(currentRes.data.position);
        setTeachingState(currentRes.data.session.teachingState || 'teaching');
      } else {
        const topicId = currentRes.data.position?.current?.id;
        if (topicId) {
          const sessRes = await api.post('/learning/teaching/session/start', {
            learningPathId: pathId,
            topicId,
          });
          setSession(sessRes.data.session);
          setSessionId(sessRes.data.session._id);
          setPosition(currentRes.data.position);
          setTeachingState(sessRes.data.session.teachingState || 'teaching');
        }
      }
    } catch (err) {
      setError('Failed to load learning data. Please try again.');
    }
    setLoading(false);
  }, [pathId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStateChange = useCallback((newState, sess) => {
    setTeachingState(newState);
    if (sess) {
      setSession(prev => prev ? { ...prev, teachingState: newState, interactionCount: sess.interactionCount, checksPassed: sess.checksPassed } : prev);
    }
  }, []);

  const handleStartQuiz = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await api.post('/learning/quiz/start', {
        teachingSessionId: sessionId,
        learningPathId: pathId,
      });
      setQuizId(r.data.quiz._id);
      setView('quiz');
    } catch {}
  }, [sessionId, pathId]);

  const handleQuizComplete = useCallback(async (result) => {
    setView('teacher');
    setQuizId(null);
    if (result?.passed && position?.current?.id) {
      const chk = await getProgressionCheck(pathId, position.current.id).catch(() => null);
      setProgression(chk);
      if (chk?.decision === 'READY') {
        await handleCompleteTopic();
      }
    }
    loadData();
  }, [pathId, position]);

  const handleCompleteTopic = useCallback(async () => {
    if (!sessionId || completing) return;
    setCompleting(true);
    try {
      const r = await api.post(`/learning/teaching/session/${sessionId}/complete-topic`);
      if (r.data.next?.next) {
        const nextSess = await api.post('/learning/teaching/session/start', {
          learningPathId: pathId,
          topicId: r.data.next.next.id,
        });
        setSession(nextSess.data.session);
        setSessionId(nextSess.data.session._id);
        setTeachingState('teaching');
        setView('teacher');
      }
      loadData();
    } catch {}
    setCompleting(false);
  }, [sessionId, pathId, completing]);

  const handlePractice = useCallback(async () => {
    if (!position?.current?.id) return;
    try {
      const r = await startPractice({ pathId, topicId: position.current.id });
      storePracticeContext(r.data.exercise, { pathId, topicId: position.current.id, sessionId });
      window.location.href = '/voxcode?openCode=1';
    } catch {}
  }, [pathId, position, sessionId]);

  const handleNextTopic = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await api.post(`/learning/teaching/session/${sessionId}/next-topic`);
      if (r.data.path_completed) {
        loadData();
        return;
      }
      if (r.data.session) {
        setSession(r.data.session);
        setSessionId(r.data.session._id);
        setTeachingState('teaching');
        setView('teacher');
      }
      loadData();
    } catch {}
  }, [sessionId, loadData]);

  const handleReviewTopic = useCallback(async (topic) => {
    if (!topic?.id || !pathId) return;
    try {
      const sessRes = await api.post('/learning/teaching/session/start', {
        learningPathId: pathId,
        topicId: topic.id,
      });
      setSession(sessRes.data.session);
      setSessionId(sessRes.data.session._id);
      setTeachingState('teaching');
      setView('teacher');
      setSidebarOpen(false);
      getProgressionCheck(pathId, topic.id).then(setProgression).catch(() => {});
    } catch {}
  }, [pathId]);

  const handleTopicClick = useCallback((topic, stage) => {
    const tid = topic.id || topic._id;
    const currentTid = position?.current?.id;
    if (tid === currentTid) return;
    handleReviewTopic(topic);
  }, [position, handleReviewTopic]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
        <span className="ml-2 text-sm text-white/40">Loading your learning path...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-sm text-white/50 mb-3">{error}</div>
        <button onClick={loadData} className="text-sm text-cyan-400 hover:underline">Try again</button>
      </div>
    );
  }

  const currentTopic = position?.current;
  const pathTitle = roadmap?.path?.title || 'Learning Path';
  const completedIds = new Set((summary?.completedTopics || []).map(t => typeof t === 'string' ? t : t?._id));
  const reviewIds = new Set(reviewItems.filter(r => r.topicId).map(r => r.topicId));

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden border-b border-white/[0.06] px-4 py-2 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white/50 hover:text-white/80">
          <BookOpen className="w-4 h-4" />
        </button>
        <div className="text-xs text-white/40 truncate">{pathTitle}</div>
        {currentTopic && (
          <div className="text-xs text-cyan-400/60 ml-auto truncate">→ {currentTopic.title}</div>
        )}
      </div>

      <div className="flex">
        {/* Sidebar — Roadmap */}
        <aside className={`fixed lg:sticky top-0 lg:top-0 left-0 z-30 h-screen w-72 bg-[#0a0c14] border-r border-white/[0.06] overflow-y-auto transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-white/90">{pathTitle}</div>
                {currentTopic && (
                  <div className="text-xs text-white/40 mt-0.5">
                    {position?.stage?.title && <span>{position.stage.title} › </span>}
                    <span className="text-cyan-400/70">{currentTopic.title}</span>
                  </div>
                )}
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white/60">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <Roadmap
              roadmap={roadmap}
              summary={summary}
              currentTopicId={currentTopic?.id}
              completedTopicIds={completedIds}
              reviewTopicIds={reviewIds}
              onTopicClick={handleTopicClick}
            />

            {reviewItems.length > 0 && (
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <div className="text-[11px] tracking-widest text-white/40 mb-2">NEEDS REVIEW</div>
                <div className="space-y-1.5">
                  {reviewItems.slice(0, 5).map(item => (
                    <div key={item.topicId || item.topicName} className="flex items-center gap-2 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        item.priority === 'HIGH' ? 'bg-rose-400' : item.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-white/20'
                      }`} />
                      <span className="text-white/60 truncate flex-1">{item.topicName}</span>
                      <button
                        onClick={() => item.topicId && handleReviewTopic({ id: item.topicId, title: item.topicName })}
                        className="text-cyan-400/60 hover:text-cyan-400 shrink-0"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-white/[0.06] pt-4">
              <button
                onClick={onSwitchPath}
                className="w-full text-xs text-white/40 hover:text-white/60 py-2 rounded-lg border border-white/[0.06] hover:bg-white/[0.02] transition-colors"
              >
                Switch Learning Path
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col h-screen">
          {/* Header */}
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {currentTopic && (
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white/90 truncate">{currentTopic.title}</div>
                    {position?.stage?.title && (
                      <div className="text-[11px] text-white/40">{position.stage.title}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <TeachingProgress teachingState={teachingState} />
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {view === 'quiz' && quizId ? (
              <InlineQuiz
                quizId={quizId}
                onComplete={handleQuizComplete}
                onBack={() => { setView('teacher'); setQuizId(null); }}
              />
            ) : sessionId ? (
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <AITeacher
                    sessionId={sessionId}
                    session={session}
                    onStateChange={handleStateChange}
                    onMessage={() => {}}
                  />
                </div>

                {/* Action Bar */}
                <div className="border-t border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(teachingState === 'ready_for_practice' || teachingState === 'completed') && (
                      <>
                        <button
                          onClick={handleStartQuiz}
                          className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-white/60 hover:text-white/80 hover:bg-white/[0.04] flex items-center gap-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Quiz
                        </button>
                        <button
                          onClick={handlePractice}
                          className="px-3 py-1.5 rounded-lg border border-cyan-400/20 text-xs text-cyan-400 hover:bg-cyan-400/10 flex items-center gap-1.5"
                        >
                          <Code2 className="w-3.5 h-3.5" /> Practice in Code
                        </button>
                        <button
                          onClick={handleCompleteTopic}
                          disabled={completing}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-xs text-emerald-400 hover:bg-emerald-500/25 flex items-center gap-1.5 disabled:opacity-40 ml-auto"
                        >
                          {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Complete & Next
                        </button>
                      </>
                    )}
                    {teachingState === 'mini_quiz' && (
                      <button
                        onClick={handleStartQuiz}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/15 text-xs text-cyan-400 hover:bg-cyan-500/25 flex items-center gap-1.5"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> Start Quiz
                      </button>
                    )}
                    {progression?.decision === 'READY' && progression?.nextTopic && (
                      <button
                        onClick={handleNextTopic}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/15 text-xs text-cyan-400 hover:bg-cyan-500/25 flex items-center gap-1.5 ml-auto"
                      >
                        Next Topic <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {progression?.decision === 'REVIEW' && (
                      <div className="text-xs text-amber-400/70 ml-auto">
                        This topic needs review. Use the teacher to strengthen your understanding.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-sm text-white/40">
                Select a topic from the roadmap to begin.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
