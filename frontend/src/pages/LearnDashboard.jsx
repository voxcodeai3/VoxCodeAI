import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Flame, Clock, Target, TrendingUp, ChevronRight, Play, Star, Award, Calendar, Route } from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';

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

const ProgressBar = ({ percent, color = 'cyan' }) => {
  const colorMap = {
    cyan: 'bg-cyan-500',
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
  };
  return (
    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorMap[color] || colorMap.cyan}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
};

export default function LearningDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    dashboard, calendar, recommendations, courses, learningPaths,
    fetchDashboard, fetchCalendar, fetchRecommendations,
    fetchCourses, fetchLearningPaths, setActivePath,
  } = useCourse();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      await Promise.all([
        fetchDashboard(),
        fetchCalendar(),
        fetchRecommendations(),
        fetchCourses(),
        fetchLearningPaths(),
      ]);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm font-mono">Loading learning dashboard...</div>
      </div>
    );
  }

  const inProgressCourse = dashboard?.inProgressLessons > 0;
  const streak = dashboard?.streak || 0;
  const weeklyMinutes = dashboard?.weeklyMinutes || 0;
  const completedLessons = dashboard?.completedLessons || 0;

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome back, {user?.name || 'Learner'}
          </h1>
          <p className="text-white/50 text-sm">Continue your learning journey</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-white/40">Streak</span>
            </div>
            <div className="text-xl font-bold text-white">{streak} day{streak !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-white/40">This Week</span>
            </div>
            <div className="text-xl font-bold text-white">{weeklyMinutes}m</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-white/40">Completed</span>
            </div>
            <div className="text-xl font-bold text-white">{completedLessons}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-white/40">Skills</span>
            </div>
            <div className="text-xl font-bold text-white">{dashboard?.masteredSkills || 0}/{dashboard?.totalSkills || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Continue Learning */}
            {inProgressCourse && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                  <Play className="w-4 h-4 text-cyan-400" />
                  CONTINUE LEARNING
                </h2>
                <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-4">
                  <div className="text-white font-medium mb-1">
                    {dashboard?.inProgressLessons} lesson{dashboard?.inProgressLessons !== 1 ? 's' : ''} in progress
                  </div>
                  <p className="text-white/40 text-sm mb-3">Pick up where you left off</p>
                  <button
                    onClick={() => navigate('/learn/courses')}
                    className="px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors flex items-center gap-2"
                  >
                    Continue <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  RECOMMENDED NEXT
                </h2>
                <div className="space-y-2">
                  {recommendations.slice(0, 3).map((rec, i) => (
                    <div
                      key={i}
                      className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{rec.title}</div>
                        <div className="text-white/40 text-xs mt-0.5 truncate">{rec.reason}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (rec.lessonId) navigate(`/learn/lesson/${rec.lessonId}`);
                        }}
                        className="ml-3 px-3 py-1.5 bg-white/5 text-white/70 rounded text-xs hover:bg-white/10 transition-colors shrink-0"
                      >
                        {rec.type === 'continue' ? 'Continue' : rec.type === 'review' ? 'Review' : 'Start'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Learning Path */}
            {dashboard?.activePath && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                  <Route className="w-4 h-4 text-violet-400" />
                  YOUR LEARNING PATH
                </h2>
                <button
                  onClick={() => navigate(`/learn/path/${dashboard.activePath._id}`)}
                  className="w-full bg-violet-500/5 border border-violet-500/10 rounded-lg p-4 text-left hover:bg-violet-500/10 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm group-hover:text-violet-400 transition-colors">
                      {dashboard.activePath.title}
                    </span>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-violet-400" />
                  </div>
                  <div className="text-white/40 text-xs mb-2">{dashboard.activePath.description}</div>
                </button>
                <button
                  onClick={() => navigate('/learn/paths')}
                  className="mt-2 text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Switch path →
                </button>
              </div>
            )}

            {/* No path selected */}
            {!dashboard?.activePath && !loading && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                  <Route className="w-4 h-4 text-violet-400" />
                  CHOOSE A LEARNING PATH
                </h2>
                <p className="text-white/40 text-xs mb-3">Pick a structured path to guide your learning</p>
                <button
                  onClick={() => navigate('/learn/paths')}
                  className="px-4 py-2 bg-violet-500/10 text-violet-400 rounded-lg text-sm hover:bg-violet-500/20 transition-colors"
                >
                  Browse Paths
                </button>
              </div>
            )}

            {/* Courses */}
            {courses.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  COURSES
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {courses.slice(0, 4).map((course) => (
                    <button
                      key={course._id}
                      onClick={() => navigate(`/learn/course/${course._id}`)}
                      className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 text-left hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="text-white font-medium text-sm mb-1">{course.title}</div>
                      <div className="flex items-center gap-2 mb-2">
                        <DifficultyBadge level={course.difficulty} />
                        <span className="text-white/30 text-xs">{course.totalLessons} lessons</span>
                      </div>
                      <div className="text-white/30 text-xs">~{course.estimatedMinutes}m</div>
                    </button>
                  ))}
                </div>
                {courses.length > 4 && (
                  <button
                    onClick={() => navigate('/learn/courses')}
                    className="mt-3 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    View all {courses.length} courses →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Calendar */}
            {calendar && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  THIS WEEK
                </h2>
                <div className="flex justify-between">
                  {calendar.days?.map((day) => (
                    <div key={day.date} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-white/30">{day.day}</span>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                          day.active
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-white/5 text-white/20'
                        }`}
                      >
                        {day.active ? '✓' : '·'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white/60 mb-3">QUICK ACTIONS</h2>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/learn/courses')}
                  className="w-full bg-white/[0.03] border border-white/[0.04] rounded-lg p-3 text-left text-white/70 text-sm hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  Browse Courses
                </button>
                <button
                  onClick={() => navigate('/learn/paths')}
                  className="w-full bg-white/[0.03] border border-white/[0.04] rounded-lg p-3 text-left text-white/70 text-sm hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  Learning Paths
                </button>
                <button
                  onClick={() => navigate('/voxcode')}
                  className="w-full bg-white/[0.03] border border-white/[0.04] rounded-lg p-3 text-left text-white/70 text-sm hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                >
                  <Award className="w-4 h-4 text-amber-400" />
                  Practice & Quiz
                </button>
              </div>
            </div>

            {/* Empty State */}
            {!inProgressCourse && recommendations.length === 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-center">
                <div className="text-white/20 text-2xl mb-2">📚</div>
                <div className="text-white/40 text-sm mb-3">Start your learning journey</div>
                <button
                  onClick={() => navigate('/learn/courses')}
                  className="px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/20 transition-colors"
                >
                  Browse Courses
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
