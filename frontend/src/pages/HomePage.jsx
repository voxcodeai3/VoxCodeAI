import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Code2, Folder, BarChart3, Rocket, ChevronRight,
  Flame, Clock, Target, Play, Award,
} from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dashboard, recommendations, fetchDashboard, fetchRecommendations } = useCourse();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [profRes] = await Promise.all([
          api.get('/setup/profile').catch(() => ({ data: null })),
          fetchDashboard(),
          fetchRecommendations(),
        ]);
        if (!cancelled) setProfile(profRes.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm font-mono">Loading...</div>
      </div>
    );
  }

  const hasOnboarded = profile?.onboardingComplete && profile?.activePath;

  if (!hasOnboarded) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-3">Welcome to VoxCode</h1>
            <p className="text-white/50 text-sm">Your personal AI coding teacher</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 mb-6">
            <div className="text-4xl mb-4">🎓</div>
            <h2 className="text-lg font-semibold text-white mb-2">What would you like to learn?</h2>
            <p className="text-white/40 text-sm mb-6">
              Tell us your goal and we'll create a personalized learning path just for you.
            </p>
            <button
              onClick={() => navigate('/setup')}
              className="w-full py-3 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white rounded-xl text-sm font-bold hover:from-cyan-500/30 hover:to-violet-500/30 transition-all flex items-center justify-center gap-2 border border-cyan-500/20"
            >
              <Rocket className="w-5 h-5" />
              Choose What I Want To Learn
            </button>
          </div>
          <p className="text-white/20 text-xs">
            Or explore <button onClick={() => navigate('/learn/courses')} className="text-cyan-400/50 hover:text-cyan-400">courses</button> and <button onClick={() => navigate('/learn/paths')} className="text-cyan-400/50 hover:text-cyan-400">learning paths</button> manually.
          </p>
        </div>
      </div>
    );
  }

  const nextRec = recommendations?.[0];

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome back, {user?.name || 'Learner'}
          </h1>
          <p className="text-white/50 text-sm">Continue your learning journey</p>
        </div>

        {/* Continue Learning - Hero Card */}
        <div className="bg-gradient-to-r from-cyan-500/5 to-violet-500/5 border border-cyan-500/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Play className="w-5 h-5 text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-400 tracking-wider">CONTINUE LEARNING</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">
                {dashboard?.activePath?.title || 'Your Learning Path'}
              </h2>
              {dashboard?.inProgressLessons > 0 && (
                <p className="text-white/50 text-sm">
                  {dashboard.inProgressLessons} lesson{dashboard.inProgressLessons !== 1 ? 's' : ''} in progress
                </p>
              )}
              {dashboard?.activePath?.description && (
                <p className="text-white/40 text-xs mt-1">{dashboard.activePath.description}</p>
              )}
            </div>
            <button
              onClick={() => navigate('/learn')}
              className="px-5 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/20 transition-colors flex items-center gap-2 shrink-0"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-white/40">Streak</span>
            </div>
            <div className="text-xl font-bold text-white">{dashboard?.streak || 0} day{(dashboard?.streak || 0) !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-white/40">This Week</span>
            </div>
            <div className="text-xl font-bold text-white">{dashboard?.weeklyMinutes || 0}m</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-white/40">Completed</span>
            </div>
            <div className="text-xl font-bold text-white">{dashboard?.completedLessons || 0}</div>
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
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recommended Next */}
            {nextRec && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  RECOMMENDED NEXT
                </h2>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm font-medium">{nextRec.title}</div>
                    <div className="text-white/40 text-xs mt-0.5">{nextRec.reason}</div>
                  </div>
                  <button
                    onClick={() => {
                      if (nextRec.lessonId) navigate(`/learn/lesson/${nextRec.lessonId}`);
                      else navigate('/learn');
                    }}
                    className="ml-4 px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/20 transition-colors shrink-0"
                  >
                    {nextRec.type === 'continue' ? 'Continue' : nextRec.type === 'review' ? 'Review' : 'Start'}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Access */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white/60 mb-3">QUICK ACCESS</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => navigate('/learn')}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 text-left hover:bg-white/[0.04] transition-colors group"
                >
                  <BookOpen className="w-5 h-5 text-cyan-400 mb-2" />
                  <div className="text-sm text-white/80 group-hover:text-cyan-400 transition-colors">Learn</div>
                  <div className="text-xs text-white/30">Courses & Lessons</div>
                </button>
                <button
                  onClick={() => navigate('/voxcode')}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 text-left hover:bg-white/[0.04] transition-colors group"
                >
                  <Code2 className="w-5 h-5 text-violet-400 mb-2" />
                  <div className="text-sm text-white/80 group-hover:text-violet-400 transition-colors">Practice</div>
                  <div className="text-xs text-white/30">AI Tutor & Coding</div>
                </button>
                <button
                  onClick={() => navigate('/assessments')}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 text-left hover:bg-white/[0.04] transition-colors group"
                >
                  <Target className="w-5 h-5 text-emerald-400 mb-2" />
                  <div className="text-sm text-white/80 group-hover:text-emerald-400 transition-colors">Assess</div>
                  <div className="text-xs text-white/30">Test Your Skills</div>
                </button>
                <button
                  onClick={() => navigate('/projects')}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 text-left hover:bg-white/[0.04] transition-colors group"
                >
                  <Folder className="w-5 h-5 text-amber-400 mb-2" />
                  <div className="text-sm text-white/80 group-hover:text-amber-400 transition-colors">Projects</div>
                  <div className="text-xs text-white/30">Build & Create</div>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                PROGRESS
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Lessons completed</span>
                  <span className="text-xs text-white/60">{dashboard?.completedLessons || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">In progress</span>
                  <span className="text-xs text-white/60">{dashboard?.inProgressLessons || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Skills mastered</span>
                  <span className="text-xs text-white/60">{dashboard?.masteredSkills || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Learning streak</span>
                  <span className="text-xs text-white/60">{dashboard?.streak || 0} days</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/learning')}
                className="mt-4 w-full py-2 bg-white/5 text-white/50 rounded-lg text-xs hover:bg-white/10 transition-colors"
              >
                View Full Progress
              </button>
            </div>

            {/* Change Path */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white/60 mb-3">LEARNING PATH</h2>
              <div className="text-sm text-white/80 mb-2">{dashboard?.activePath?.title || 'Not set'}</div>
              <button
                onClick={() => navigate('/learn/paths')}
                className="w-full py-2 bg-white/5 text-white/50 rounded-lg text-xs hover:bg-white/10 transition-colors"
              >
                Change Path
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
