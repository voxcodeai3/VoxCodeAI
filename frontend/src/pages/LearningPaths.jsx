import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
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

export default function LearningPaths() {
  const navigate = useNavigate();
  const { learningPaths, fetchLearningPaths, loading } = useCourse();

  useEffect(() => {
    fetchLearningPaths();
  }, []);

  if (loading && learningPaths.length === 0) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm font-mono">Loading learning paths...</div>
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

        <h1 className="text-2xl font-bold text-white mb-1">Learning Paths</h1>
        <p className="text-white/50 text-sm mb-8">Structured sequences to reach your goal</p>

        {learningPaths.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-3xl mb-3">🛤️</div>
            <div className="text-white/40 text-sm">No learning paths available yet</div>
          </div>
        ) : (
          <div className="space-y-4">
            {learningPaths.map((path) => (
              <button
                key={path._id}
                onClick={() => navigate(`/learn/path/${path._id}`)}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 text-left hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors">
                        {path.title}
                      </h3>
                      <DifficultyBadge level={path.difficulty} />
                    </div>
                    <p className="text-white/40 text-sm mb-3">{path.description}</p>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      <span>{path.courseCount} courses</span>
                      <span>{path.totalLessons} lessons</span>
                      <span>{path.estimatedDuration}</span>
                    </div>
                    {path.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {path.skills.slice(0, 5).map((skill) => (
                          <span key={skill} className="px-2 py-0.5 bg-white/5 text-white/30 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
