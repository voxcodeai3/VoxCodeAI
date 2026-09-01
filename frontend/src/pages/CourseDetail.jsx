import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, BookOpen, Clock, CheckCircle, Lock, Play } from 'lucide-react';
import { useCourse } from '../context/CourseContext';

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

const TypeIcon = ({ type }) => {
  const icons = {
    concept: '📖',
    coding: '💻',
    exercise: '✏️',
    quiz: '❓',
    project: '🔨',
    review: '🔄',
  };
  return <span className="text-sm">{icons[type] || '📖'}</span>;
};

export default function CourseDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCourse, fetchCourse, fetchCourseProgress, progress, loading } = useCourse();
  const [loadingProgress, setLoadingProgress] = useState(true);

  useEffect(() => {
    fetchCourse(id);
    fetchCourseProgress(id).finally(() => setLoadingProgress(false));
  }, [id]);

  if (loading && !currentCourse) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm font-mono">Loading course...</div>
      </div>
    );
  }

  if (!currentCourse) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-white/40 text-sm">Course not found</div>
      </div>
    );
  }

  const lessons = progress?.lessons || [];
  const completedCount = lessons.filter((l) => l.status === 'completed').length;
  const totalLessons = lessons.length || currentCourse.modules?.reduce((s, m) => s + m.lessons.length, 0) || 0;
  const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/learn/courses')}
          className="text-xs text-white/40 hover:text-white/60 mb-4 block"
        >
          ← Back to Courses
        </button>

        {/* Course Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl font-bold text-white">{currentCourse.title}</h1>
            <DifficultyBadge level={currentCourse.difficulty} />
          </div>
          <p className="text-white/50 text-sm mb-4">{currentCourse.description}</p>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{totalLessons} lessons</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{currentCourse.estimatedDuration}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">{completedCount}/{totalLessons} lessons completed</span>
            <span className="text-xs text-white/40">{percentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          {totalLessons > 0 && (
            <div className="text-xs text-white/30 mt-1">
              Est. remaining: ~{Math.round((totalLessons - completedCount) * 15)}m
            </div>
          )}
        </div>

        {/* Modules & Lessons */}
        <div className="space-y-6">
          {currentCourse.modules?.map((mod) => (
            <div key={mod._id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
                <h3 className="text-sm font-semibold text-white/80">{mod.title}</h3>
                {mod.description && (
                  <p className="text-xs text-white/30 mt-1">{mod.description}</p>
                )}
              </div>
              <div className="divide-y divide-white/[0.04]">
                {mod.lessons?.map((lesson) => {
                  const lessonProg = lessons.find(
                    (l) => l.lesson?._id === lesson._id
                  );
                  const isCompleted = lessonProg?.status === 'completed';
                  const isInProgress = lessonProg?.status === 'in_progress';
                  const locked = false;

                  return (
                    <button
                      key={lesson._id}
                      onClick={() => !locked && navigate(`/learn/lesson/${lesson._id}`)}
                      disabled={locked}
                      className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${
                        locked
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-white/[0.02] cursor-pointer'
                      }`}
                    >
                      <TypeIcon type={lesson.type} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/80 truncate">{lesson.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-white/30 capitalize">{lesson.type}</span>
                          <span className="text-xs text-white/20">·</span>
                          <span className="text-xs text-white/30">{lesson.estimatedMinutes}m</span>
                          {lesson.required === false && (
                            <span className="text-xs text-white/20 italic">optional</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        ) : locked ? (
                          <Lock className="w-5 h-5 text-white/20" />
                        ) : isInProgress ? (
                          <Play className="w-5 h-5 text-cyan-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white/20" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
