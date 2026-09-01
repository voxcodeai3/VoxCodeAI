import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, XCircle, TrendingUp, TrendingDown, ArrowRight, RotateCcw } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';

const SkillBar = ({ skill, score, status }) => {
  const percent = Math.round(score * 100);
  const colors = {
    strong: 'bg-emerald-500',
    proficient: 'bg-cyan-500',
    developing: 'bg-amber-500',
    not_started: 'bg-red-500',
  };
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white/80 truncate">{skill}</div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${colors[status] || colors.developing}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs text-white/40 w-10 text-right">{percent}%</span>
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded ${
        status === 'strong' ? 'bg-emerald-500/10 text-emerald-400' :
        status === 'proficient' ? 'bg-cyan-500/10 text-cyan-400' :
        status === 'developing' ? 'bg-amber-500/10 text-amber-400' :
        'bg-red-500/10 text-red-400'
      }`}>
        {status}
      </span>
    </div>
  );
};

export default function AssessmentResults() {
  const navigate = useNavigate();
  const { attemptId } = useParams();
  const { lastResult, getResult, loading } = useAssessment();

  useEffect(() => {
    getResult(attemptId);
  }, [attemptId]);

  if (loading || !lastResult) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-sm font-mono">Loading results...</div>
      </div>
    );
  }

  const { attempt, strong, weak, passed } = lastResult;

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
            passed ? 'bg-emerald-500/10' : 'bg-amber-500/10'
          }`}>
            {passed ? (
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            ) : (
              <XCircle className="w-8 h-8 text-amber-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Assessment Complete</h1>
          <p className="text-white/40 text-sm">
            {passed ? 'Great work! You passed.' : 'Keep practicing — you\'ll get there.'}
          </p>
        </div>

        {/* Score Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 mb-6 text-center">
          <div className="text-4xl font-bold text-white mb-1">{attempt.percentage}%</div>
          <div className="text-sm text-white/40 mb-4">
            {attempt.score?.toFixed(1)} / {attempt.totalQuestions} points
          </div>
          <div className="flex items-center justify-center gap-6 text-xs text-white/40">
            <div>
              <div className="text-white/60 font-medium">{attempt.answers?.filter((a) => a.correct).length || 0}</div>
              Correct
            </div>
            <div>
              <div className="text-white/60 font-medium">{attempt.answers?.filter((a) => !a.correct).length || 0}</div>
              Incorrect
            </div>
            <div>
              <div className="text-white/60 font-medium">{attempt.timeSpentSeconds ? `${Math.floor(attempt.timeSpentSeconds / 60)}m` : '—'}</div>
              Time
            </div>
          </div>
        </div>

        {/* Strong Skills */}
        {strong.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-4">
            <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              STRONG SKILLS
            </h2>
            <div className="divide-y divide-white/[0.04]">
              {strong.map((s) => (
                <SkillBar key={s.skill} skill={s.skill} score={s.score} status={s.status} />
              ))}
            </div>
          </div>
        )}

        {/* Weak Skills */}
        {weak.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              NEEDS PRACTICE
            </h2>
            <div className="divide-y divide-white/[0.04]">
              {weak.map((s) => (
                <SkillBar key={s.skill} skill={s.skill} score={s.score} status={s.status} />
              ))}
            </div>
          </div>
        )}

        {/* All Skill Results */}
        {attempt.skillResults?.length > 0 && strong.length === 0 && weak.length === 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-white/60 mb-3">SKILL RESULTS</h2>
            <div className="divide-y divide-white/[0.04]">
              {attempt.skillResults.map((s) => (
                <SkillBar key={s.skill} skill={s.skill} score={s.score} status={s.status} />
              ))}
            </div>
          </div>
        )}

        {/* Answer Review */}
        {attempt.answers?.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-white/60 mb-3">ANSWER REVIEW</h2>
            <div className="space-y-3">
              {attempt.answers.map((a, i) => (
                <div key={i} className={`p-3 rounded-lg border ${
                  a.correct
                    ? 'bg-emerald-500/5 border-emerald-500/10'
                    : 'bg-red-500/5 border-red-500/10'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {a.correct ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="text-xs text-white/40">Q{i + 1}</span>
                    <span className="text-xs text-white/30">Score: {Math.round(a.score * 100)}%</span>
                  </div>
                  <div className="text-xs text-white/50 ml-6">
                    Your answer: {a.answer || '(no answer)'}
                  </div>
                  {a.feedback && (
                    <div className="text-xs text-white/40 ml-6 mt-1">{a.feedback}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {weak.length > 0 && (
            <button
              onClick={() => navigate('/assessments')}
              className="flex-1 px-4 py-3 bg-amber-500/10 text-amber-400 rounded-xl text-sm font-medium hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Review Weak Areas
            </button>
          )}
          <button
            onClick={() => navigate('/learn')}
            className="flex-1 px-4 py-3 bg-cyan-500/10 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2"
          >
            Continue Learning
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
