import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Clock, Target, TrendingUp, Zap, BookOpen, Code2, Mic,
  ChevronRight, ChevronLeft, Play, Trophy, AlertTriangle, CheckCircle, BarChart3,
  RefreshCw, ArrowRight,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import api from '../services/api';

const ACTION_ICONS = { practice: BookOpen, quiz: Target, challenge: Code2 };
const ACTION_COLORS = { practice: 'cyan', quiz: 'violet', challenge: 'emerald' };

function formatMinutes(min) {
  if (!min || min === 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ConfidenceBar({ confidence, level }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.8 ? 'bg-emerald-400' :
    confidence >= 0.65 ? 'bg-cyan-400' :
    confidence >= 0.45 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-white/40">{level}</span>
        <span className="text-[10px] text-white/30">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = 'cyan' }) {
  const colorMap = {
    cyan: 'border-cyan-400/15 bg-cyan-400/[0.03] text-cyan-300',
    violet: 'border-violet-400/15 bg-violet-400/[0.03] text-violet-300',
    emerald: 'border-emerald-400/15 bg-emerald-400/[0.03] text-emerald-300',
    amber: 'border-amber-400/15 bg-amber-400/[0.03] text-amber-300',
  };
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-3.5 w-3.5 opacity-60" />
        <span className="text-[10px] uppercase tracking-wider opacity-50">{label}</span>
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/[0.04] bg-white/[0.01] p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-3.5 w-3.5 text-cyan-400/40" />}
        <h3 className="text-[10px] uppercase tracking-wider text-white/30 font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function LearningDashboard({ onNavigate }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get('/analytics');
        if (!cancelled) setData(res.data);
      } catch (err) {
        console.error('Analytics load error:', err);
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Failed to load analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await api.post('/analytics/rebuild');
      const res = await api.get('/analytics');
      setData(res.data);
    } catch { /* noop */ }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-white/30 text-xs">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading analytics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-amber-400/40 mx-auto" />
          <p className="text-xs text-white/30">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state for new users.
  if (!data || data.overview.totalSessions === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
        <div className="h-16 w-16 rounded-full border border-cyan-400/15 bg-cyan-400/[0.03] flex items-center justify-center">
          <BarChart3 className="h-8 w-8 text-cyan-400/30" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-sm font-semibold text-white/70">Welcome to Your Learning Journey</h2>
          <p className="text-xs text-white/30 leading-relaxed">
            You haven't completed enough learning sessions to generate meaningful progress data yet.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('practice')}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2 text-[11px] text-cyan-300 hover:bg-cyan-400/[0.12] transition-all"
          >
            <Play className="h-3 w-3" /> Start Practicing
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('quiz')}
            className="flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-2 text-[11px] text-violet-300 hover:bg-violet-400/[0.12] transition-all"
          >
            <Target className="h-3 w-3" /> Take a Quiz
          </button>
        </div>
      </div>
    );
  }

  const { overview, topics, strengths, weakAreas, recentActivity, dailyPerformance, recommendations, interviews, activeSession } = data;

  // Chart data.
  const chartData = dailyPerformance.map((d) => ({
    date: d.date.slice(5),
    accuracy: Math.round(d.accuracy * 100),
    questions: d.questions,
  }));

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/voxcode')}
            className="rounded-lg p-1.5 text-white/30 hover:text-white/60 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white/80">Learning Progress</h1>
            <p className="text-[10px] text-white/25 mt-0.5">Your personalized analytics</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-lg p-1.5 text-white/20 hover:text-white/40 transition-colors"
          title="Rebuild analytics"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Flame} label="Streak" value={`${overview.currentStreak}d`} color="amber" />
        <StatCard icon={Clock} label="Practice" value={formatMinutes(overview.totalPracticeMinutes)} color="cyan" />
        <StatCard icon={Target} label="Accuracy" value={`${Math.round(overview.accuracy * 100)}%`} color="emerald" />
        <StatCard icon={TrendingUp} label="Sessions" value={overview.totalSessions} color="violet" />
      </div>

      {/* Continue learning */}
      {activeSession && (
        <Section title="Continue Learning" icon={Play}>
          <div className="flex items-center justify-between rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] p-3">
            <div>
              <p className="text-xs text-white/60">{activeSession.topic || activeSession.type}</p>
              <p className="text-[10px] text-white/30 mt-0.5">
                Question {activeSession.currentQuestion + 1} / {activeSession.totalQuestions}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.(activeSession.type)}
              className="flex items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-[10px] text-cyan-300 hover:bg-cyan-400/[0.12] transition-all"
            >
              Resume <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Section>
      )}

      {/* Progress chart */}
      {chartData.length > 1 && (
        <Section title="Progress Over Time" icon={TrendingUp}>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.4)' }}
                  formatter={(v) => [`${v}%`, 'Accuracy']}
                />
                <Area type="monotone" dataKey="accuracy" stroke="#22d3ee" fill="url(#colorAccuracy)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* Strengths + Weak Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Strengths" icon={CheckCircle}>
          {strengths.length === 0 ? (
            <p className="text-[10px] text-white/20">Keep practicing to identify your strengths.</p>
          ) : (
            <div className="space-y-2.5">
              {strengths.map((s) => (
                <div key={s.topic} className="space-y-1">
                  <p className="text-xs text-white/60">{s.topic}</p>
                  <ConfidenceBar confidence={s.confidence} level={s.level} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Areas to Improve" icon={AlertTriangle}>
          {weakAreas.length === 0 ? (
            <p className="text-[10px] text-white/20">No weak areas identified yet.</p>
          ) : (
            <div className="space-y-2.5">
              {weakAreas.map((w) => (
                <div key={w.topic} className="space-y-1">
                  <p className="text-xs text-white/60">{w.topic}</p>
                  <ConfidenceBar confidence={w.confidence} level={w.level} />
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Recommendations */}
      <Section title="Recommended Next" icon={Zap}>
        <div className="flex flex-wrap gap-2">
          {recommendations.map((rec, i) => {
            const Icon = ACTION_ICONS[rec.action] || BookOpen;
            const color = ACTION_COLORS[rec.action] || 'cyan';
            const colorMap = {
              cyan: 'border-cyan-400/15 bg-cyan-400/[0.03] text-cyan-300 hover:bg-cyan-400/[0.08]',
              violet: 'border-violet-400/15 bg-violet-400/[0.03] text-violet-300 hover:bg-violet-400/[0.08]',
              emerald: 'border-emerald-400/15 bg-emerald-400/[0.03] text-emerald-300 hover:bg-emerald-400/[0.08]',
            };
            return (
              <button
                key={i}
                type="button"
                onClick={() => onNavigate?.(rec.action, rec.topic)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] transition-all ${colorMap[color]}`}
              >
                <Icon className="h-3 w-3 opacity-60" />
                <div className="text-left">
                  <p className="font-medium">{rec.topic}</p>
                  <p className="text-[9px] opacity-50">{rec.reason}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Activity breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-center">
          <BookOpen className="h-4 w-4 text-cyan-400/30 mx-auto mb-1" />
          <p className="text-lg font-semibold text-white/70">{overview.practiceCount}</p>
          <p className="text-[9px] text-white/25 uppercase tracking-wider">Practice</p>
        </div>
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-center">
          <Target className="h-4 w-4 text-violet-400/30 mx-auto mb-1" />
          <p className="text-lg font-semibold text-white/70">{overview.quizCount}</p>
          <p className="text-[9px] text-white/25 uppercase tracking-wider">Quizzes</p>
        </div>
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-center">
          <Code2 className="h-4 w-4 text-emerald-400/30 mx-auto mb-1" />
          <p className="text-lg font-semibold text-white/70">{overview.codingChallengeCount}</p>
          <p className="text-[9px] text-white/25 uppercase tracking-wider">Challenges</p>
        </div>
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-center">
          <Mic className="h-4 w-4 text-amber-400/30 mx-auto mb-1" />
          <p className="text-lg font-semibold text-white/70">{overview.interviewCount}</p>
          <p className="text-[9px] text-white/25 uppercase tracking-wider">Interviews</p>
        </div>
      </div>

      {/* Interview stats */}
      {interviews.completed > 0 && (
        <Section title="Interview Performance" icon={Mic}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider">Completed</p>
              <p className="text-sm text-white/60 mt-0.5">{interviews.completed}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider">Average</p>
              <p className="text-sm text-white/60 mt-0.5">{Math.round(interviews.averageScore * 100)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider">Best</p>
              <p className="text-sm text-white/60 mt-0.5">{Math.round(interviews.bestScore * 100)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider">Recent</p>
              <p className="text-sm text-white/60 mt-0.5">{Math.round(interviews.recentScore * 100)}%</p>
            </div>
          </div>
        </Section>
      )}

      {/* Recent activity */}
      <Section title="Recent Activity" icon={Clock}>
        {recentActivity.length === 0 ? (
          <p className="text-[10px] text-white/20">No recent activity.</p>
        ) : (
          <div className="space-y-1.5">
            {recentActivity.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-400/40" />
                  <div>
                    <p className="text-[11px] text-white/50">{a.detail || a.topic || a.type}</p>
                    <p className="text-[9px] text-white/20">{formatDate(a.at)}</p>
                  </div>
                </div>
                {a.score != null && (
                  <span className="text-[10px] text-white/30">{Math.round(a.score * 100)}%</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Topic breakdown */}
      {topics.length > 0 && (
        <Section title="Topic Performance" icon={BarChart3}>
          <div className="space-y-2.5">
            {topics.sort((a, b) => b.confidence - a.confidence).slice(0, 8).map((t) => (
              <div key={t.topic} className="flex items-center gap-3">
                <span className="text-[11px] text-white/50 w-32 truncate shrink-0">{t.topic}</span>
                <div className="flex-1">
                  <ConfidenceBar confidence={t.confidence} level={t.level} />
                </div>
                <span className="text-[9px] text-white/20 shrink-0">{t.attempts} attempts</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Streak info */}
      {overview.longestStreak > 0 && (
        <div className="flex items-center justify-center gap-4 py-2 text-[10px] text-white/20">
          <span>Current: {overview.currentStreak} day{overview.currentStreak !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>Best: {overview.longestStreak} day{overview.longestStreak !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
