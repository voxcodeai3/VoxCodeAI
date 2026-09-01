import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, Target, BookOpen, Zap, RotateCcw } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';

const DifficultyBadge = ({ level }) => {
  const colors = {
    easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hard: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[level] || colors.medium}`}>
      {level}
    </span>
  );
};

const TypeIcon = ({ type }) => {
  const icons = {
    placement: Target,
    lesson: BookOpen,
    practice: Play,
    review: RotateCcw,
    course: BookOpen,
    skill: Zap,
  };
  const Icon = icons[type] || Play;
  return <Icon className="w-4 h-4" />;
};

export default function AssessmentList() {
  const navigate = useNavigate();
  const { assessments, weakSkills, fetchAssessments, fetchWeakSkills, startAttempt, startPlacement, startReview, loading } = useAssessment();
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchAssessments();
    fetchWeakSkills();
  }, []);

  const handleStart = async (assessment) => {
    if (assessment.type === 'placement') {
      const data = await startPlacement(assessment.skill || assessment.skills?.[0]);
      if (data?.attempt) navigate(`/assessments/play/${data.attempt._id}`);
    } else {
      const data = await startAttempt(assessment._id);
      if (data?.attempt) navigate(`/assessments/play/${data.attempt._id}`);
    }
  };

  const handleStartReview = async () => {
    const skills = weakSkills.weak?.map((s) => s.skill) || [];
    if (skills.length === 0) return;
    const data = await startReview(skills);
    if (data?.attempt) navigate(`/assessments/play/${data.attempt._id}`);
  };

  const filtered = filter
    ? assessments.filter((a) => a.type === filter)
    : assessments;

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/learn')}
          className="text-xs text-white/40 hover:text-white/60 mb-4 block"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold text-white mb-1">Assessments</h1>
        <p className="text-white/50 text-sm mb-6">Test your knowledge and track your skills</p>

        {/* Weak Skills Alert */}
        {weakSkills.weak?.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-amber-400 mb-1">Skills Needing Review</div>
                <div className="text-xs text-white/40">
                  {weakSkills.weak.map((s) => s.skill).join(', ')}
                </div>
              </div>
              <button
                onClick={handleStartReview}
                className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20 transition-colors"
              >
                Review Now
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { value: '', label: 'All' },
            { value: 'placement', label: 'Placement' },
            { value: 'skill', label: 'Skill' },
            { value: 'course', label: 'Course' },
            { value: 'review', label: 'Review' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                filter === f.value
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'bg-white/5 text-white/40 border border-white/[0.06] hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Assessment Grid */}
        {loading ? (
          <div className="text-center py-20 text-white/30 text-sm">Loading assessments...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-3xl mb-3">📝</div>
            <div className="text-white/40 text-sm">No assessments available</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((a) => (
              <div
                key={a._id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TypeIcon type={a.type} />
                    <h3 className="text-white font-medium text-sm">{a.title}</h3>
                  </div>
                  <DifficultyBadge level={a.difficulty} />
                </div>
                <p className="text-white/40 text-xs mb-3 line-clamp-2">{a.description}</p>
                <div className="flex items-center gap-4 text-xs text-white/30 mb-4">
                  <span>{a.questionCount} questions</span>
                  {a.timeLimitMinutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{a.timeLimitMinutes}m
                    </span>
                  )}
                  <span className="capitalize">{a.mode}</span>
                </div>
                {a.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {a.skills.slice(0, 3).map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-white/5 text-white/30 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handleStart(a)}
                  className="w-full px-4 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start Assessment
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
