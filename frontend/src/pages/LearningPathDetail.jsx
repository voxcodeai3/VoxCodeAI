import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, BookOpen, Clock, Lock, CheckCircle, Route, ChevronDown } from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import learningApi from '../services/learningApi';

const DifficultyBadge = ({ level }) => {
  const colors = {
    beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    advanced: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[level] || colors.beginner}`}>
      {level}
    </span>
  );
};

export default function LearningPathDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { fetchLearningPath, dashboard, setActivePath, loading } = useCourse();
  const [path, setPath] = useState(null);
  const [setting, setSetting] = useState(false);
  const [stages, setStages] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [topicsByStage, setTopicsByStage] = useState({});

  useEffect(() => {
    fetchLearningPath(id).then(setPath);
  }, [id]);

  useEffect(() => {
    if (!path) return;
    // Try foundation stages (new hierarchy) — programming languages etc.
    learningApi.getPathStages(path._id).then(setStages).catch(() => setStages([]));
  }, [path]);

  const toggleStage = async (stageId) => {
    setExpanded(prev => ({ ...prev, [stageId]: !prev[stageId] }));
    if (!topicsByStage[stageId]) {
      try {
        const topics = await learningApi.getStageTopics(stageId);
        // for each topic, fetch lessons
        const withLessons = await Promise.all(topics.map(async t => {
          try {
            const lessons = await learningApi.getTopicLessons(t._id);
            return { ...t, lessons };
          } catch { return { ...t, lessons: [] }; }
        }));
        setTopicsByStage(prev => ({ ...prev, [stageId]: withLessons }));
      } catch {}
    }
  };

  const handleSetActive = async () => {
    if (!path?._id) return;
    setSetting(true);
    await setActivePath(path._id);
    setSetting(false);
  };

  const isActivePath = dashboard?.activePath?._id === path?._id;

  if (loading && !path) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm font-mono">Loading learning path...</div>
      </div>
    );
  }

  if (!path) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-white/40 text-sm">Learning path not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/learn')}
          className="text-xs text-white/40 hover:text-white/60 mb-4 block"
        >
          ← Back to Dashboard
        </button>

        {/* Path Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl font-bold text-white">{path.title}</h1>
            <DifficultyBadge level={path.difficulty} />
          </div>
          <p className="text-white/50 text-sm mb-4">{path.description}</p>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{path.courses?.length || 0} courses</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{path.estimatedDuration}</span>
          </div>
          <div className="mt-4">
            {isActivePath ? (
              <span className="px-4 py-2 bg-violet-500/10 text-violet-400 rounded-lg text-sm flex items-center gap-2 w-fit">
                <Route className="w-4 h-4" /> Active Path
              </span>
            ) : (
              <button
                onClick={handleSetActive}
                disabled={setting}
                className="px-4 py-2 bg-violet-500/10 text-violet-400 rounded-lg text-sm hover:bg-violet-500/20 transition-colors flex items-center gap-2"
              >
                <Route className="w-4 h-4" />
                {setting ? 'Setting...' : 'Set as My Path'}
              </button>
            )}
          </div>
        </div>

        {/* Skills */}
        {path.skills?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-white/60 mb-3">SKILLS YOU'LL GAIN</h2>
            <div className="flex flex-wrap gap-2">
              {path.skills.map((skill) => (
                <span key={skill} className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-xs">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stages (foundation) or Course Sequence (legacy) */}
        {stages && stages.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-white/60 mb-4">STAGES</h2>
            {['beginner','intermediate','advanced'].map(level => {
              const levelStages = stages.filter(s => s.level === level);
              if (levelStages.length === 0) return null;
              return (
                <div key={level} className="mb-6">
                  <div className="text-xs tracking-widest text-white/30 mb-2 uppercase">{level}</div>
                  <div className="border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04] bg-white/[0.02]">
                    {levelStages.map((stage, idx) => {
                      const isOpen = !!expanded[stage._id];
                      const topics = topicsByStage[stage._id] || [];
                      return (
                        <div key={stage._id}>
                          <button onClick={() => toggleStage(stage._id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors">
                            <ChevronDown className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            <span className="text-xs text-white/30 shrink-0">Stage {stage.order + 1}</span>
                            <span className="text-sm text-white/80 truncate">{stage.title}</span>
                            <span className="ml-auto text-xs text-white/30">{stage.estimatedMinutes}m</span>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-3 pt-1 border-t border-white/[0.04] bg-black/10">
                              {stage.description && <p className="text-xs text-white/40 mb-2">{stage.description}</p>}
                              {topics.length === 0 ? (
                                <div className="text-xs text-white/20 italic">Loading topics…</div>
                              ) : (
                                <div className="space-y-2">
                                  {topics.map(topic => (
                                    <div key={topic._id}>
                                      <div className="text-xs font-medium text-white/60">{topic.title}</div>
                                      <div className="mt-1 space-y-1">
                                        {(topic.lessons || []).map(lesson => (
                                          <button key={lesson._id} onClick={() => navigate(`/learn/lesson/${lesson._id}`)} className="block w-full text-left px-3 py-1.5 rounded bg-white/[0.03] hover:bg-white/[0.06] text-xs text-white/70 hover:text-white transition-colors">
                                            • {lesson.title} <span className="text-white/30">({lesson.estimatedMinutes}m · {lesson.type})</span>
                                          </button>
                                        ))}
                                        {(!topic.lessons || topic.lessons.length === 0) && <div className="text-xs text-white/20">No lessons</div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-semibold text-white/60 mb-4">COURSE SEQUENCE</h2>
            <div className="space-y-3">
              {path.courses?.map((course, i) => (
                <div key={course._id} className="relative">
                  {i < path.courses.length - 1 && (
                    <div className="absolute left-6 top-12 bottom-0 w-px bg-white/[0.06]" />
                  )}
                  <button
                    onClick={() => navigate(`/learn/course/${course._id}`)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-left hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group relative z-10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center text-white/30 text-sm font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium text-sm group-hover:text-cyan-400 transition-colors">
                            {course.title}
                          </h3>
                          <DifficultyBadge level={course.difficulty} />
                        </div>
                        <p className="text-white/40 text-xs mb-2 line-clamp-1">{course.description}</p>
                        <div className="flex items-center gap-4 text-xs text-white/30">
                          <span>{course.totalLessons} lessons</span>
                          <span>~{course.estimatedMinutes}m</span>
                          {course.required === false && (
                            <span className="text-white/20 italic">optional</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-cyan-400 transition-colors shrink-0" />
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
