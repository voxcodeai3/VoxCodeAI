import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Code2, Server, Layers, BookOpen } from 'lucide-react';
import { useCourse } from '../context/CourseContext';

const GOALS = [
  { id: 'frontend', label: 'Frontend Developer', icon: Code2, description: 'Build modern web interfaces' },
  { id: 'backend', label: 'Backend Developer', icon: Server, description: 'Build server-side applications' },
  { id: 'fullstack', label: 'Full-Stack Developer', icon: Layers, description: 'Master both frontend and backend' },
  { id: 'python', label: 'Python Developer', icon: Code2, description: 'Learn Python from scratch' },
  { id: 'general', label: 'Just Learning', icon: BookOpen, description: 'Explore and learn at your pace' },
];

const LEVELS = [
  { id: 'beginner', label: 'Complete Beginner', description: "I'm new to programming" },
  { id: 'some', label: 'Some Experience', description: "I know the basics" },
  { id: 'intermediate', label: 'Intermediate', description: "I've built a few projects" },
  { id: 'advanced', label: 'Advanced', description: "I'm comfortable with most concepts" },
];

const goalToPathSlug = {
  frontend: 'frontend-developer',
  backend: 'backend-developer',
  fullstack: 'fullstack-developer',
  python: 'python-developer',
  general: null,
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { saveOnboarding, learningPaths, fetchLearningPaths } = useCourse();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(null);
  const [level, setLevel] = useState(null);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLearningPaths();
  }, []);

  const matchingPath = learningPaths.find((p) => p.slug === goalToPathSlug[goal]);

  const handleGoalSelect = (goalId) => {
    setGoal(goalId);
    const path = learningPaths.find((p) => p.slug === goalToPathSlug[goalId]);
    setSelectedPathId(path?._id || null);
  };

  const handleFinish = async () => {
    setSaving(true);
    const experienceMap = {
      beginner: 'beginner',
      some: 'beginner',
      intermediate: 'intermediate',
      advanced: 'advanced',
    };
    await saveOnboarding({
      learningGoal: goal,
      experienceLevel: experienceMap[level] || 'beginner',
      preferredLanguages: goal === 'python' ? ['python'] : ['javascript'],
      activePathId: selectedPathId,
    });
    setSaving(false);
    if (selectedPathId) {
      navigate(`/learn/path/${selectedPathId}`);
    } else {
      navigate('/learn/courses');
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[0, 1].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-cyan-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">What do you want to learn?</h1>
            <p className="text-white/40 text-sm mb-6">Choose your learning goal</p>
            <div className="space-y-3">
              {GOALS.map((g) => {
                const Icon = g.icon;
                return (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`w-full bg-white/[0.03] border rounded-xl p-4 text-left transition-all flex items-center gap-4 ${
                      goal === g.id
                        ? 'border-cyan-500/40 bg-cyan-500/5'
                        : 'border-white/[0.06] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      goal === g.id ? 'bg-cyan-500/10' : 'bg-white/5'
                    }`}>
                      <Icon className={`w-5 h-5 ${goal === g.id ? 'text-cyan-400' : 'text-white/40'}`} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{g.label}</div>
                      <div className="text-xs text-white/40">{g.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => goal && setStep(1)}
              disabled={!goal}
              className="mt-6 w-full py-3 bg-cyan-500/10 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
            {goal && matchingPath && (
              <p className="text-center text-xs text-white/30 mt-2">
                This will start you on: <span className="text-cyan-400/60">{matchingPath.title}</span> path
              </p>
            )}
            {goal && goalToPathSlug[goal] === null && (
              <p className="text-center text-xs text-white/30 mt-2">
                You can browse all courses freely
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">How much experience?</h1>
            <p className="text-white/40 text-sm mb-6">This helps us personalize your starting point</p>
            <div className="space-y-3">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className={`w-full bg-white/[0.03] border rounded-xl p-4 text-left transition-all ${
                    level === l.id
                      ? 'border-cyan-500/40 bg-cyan-500/5'
                      : 'border-white/[0.06] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{l.label}</div>
                  <div className="text-xs text-white/40">{l.description}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(0)}
                className="px-4 py-3 bg-white/5 text-white/50 rounded-xl text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleFinish}
                disabled={!level || saving}
                className="flex-1 py-3 bg-cyan-500/10 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Start Learning'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
