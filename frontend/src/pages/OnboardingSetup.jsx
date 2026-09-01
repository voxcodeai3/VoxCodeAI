import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, Layout, Server, Layers, Smartphone, Code2,
  Brain, BarChart, Gamepad2, Wrench, Binary, Code, CheckCircle, Rocket,
} from 'lucide-react';
import api from '../services/api';

const GOAL_ICONS = {
  frontend: Layout, backend: Server, fullstack: Layers, mobile: Smartphone,
  python: Code2, ai_ml: Brain, data_science: BarChart, game_dev: Gamepad2,
  software_engineering: Wrench, dsa: Binary, programming_language: Code,
};

const EXPERIENCE_LEVELS = [
  { id: "complete_beginner", label: "Complete Beginner", desc: "I'm new to programming" },
  { id: "beginner", label: "Beginner", desc: "I know some basics" },
  { id: "intermediate", label: "Intermediate", desc: "I've built a few projects" },
  { id: "advanced", label: "Advanced", desc: "I'm comfortable with most concepts" },
];

const LEARNING_STYLES = [
  { id: "balanced", label: "Balanced", desc: "Mix of explanation, practice, and projects" },
  { id: "coding", label: "Learn by Coding", desc: "Hands-on coding from the start" },
  { id: "project_based", label: "Project Based", desc: "Build real projects to learn" },
  { id: "practice_heavy", label: "Practice Heavy", desc: "Lots of exercises and challenges" },
  { id: "explanation", label: "Mostly Explanation", desc: "Understand concepts first, then code" },
  { id: "quiz_heavy", label: "Quiz Heavy", desc: "Test knowledge frequently" },
];

const WEEKLY_GOALS = [
  { hours: 2, label: "1-2 hrs/week", desc: "Casual learning" },
  { hours: 4, label: "3-5 hrs/week", desc: "Regular practice" },
  { hours: 8, label: "5-10 hrs/week", desc: "Serious learning" },
  { hours: 12, label: "10+ hrs/week", desc: "Intensive study" },
];

export default function OnboardingSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState([]);
  const [stacks, setStacks] = useState([]);
  const [loadingStacks, setLoadingStacks] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedStack, setSelectedStack] = useState(null);
  const [stackCurriculum, setStackCurriculum] = useState(null);
  const [experience, setExperience] = useState(null);
  const [learningStyle, setLearningStyle] = useState('balanced');
  const [weeklyGoal, setWeeklyGoal] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/setup/goals').then(({ data }) => setGoals(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedGoal) {
      setLoadingStacks(true);
      api.get(`/setup/stacks?goal=${selectedGoal}`)
        .then(({ data }) => setStacks(data))
        .finally(() => setLoadingStacks(false));
    }
  }, [selectedGoal]);

  useEffect(() => {
    if (selectedStack) {
      api.get(`/setup/curriculum/${selectedStack}`)
        .then(({ data }) => setStackCurriculum(data))
        .catch(() => {});
    }
  }, [selectedStack]);

  const handleStartLearning = async () => {
    setSaving(true);
    try {
      await api.post('/setup/profile', {
        selectedGoal,
        selectedStack: selectedStack,
        experienceLevel: experience,
        preferredLearningStyle: learningStyle,
        weeklyGoalHours: weeklyGoal,
        learningGoals: [selectedGoal],
      });
      const { data } = await api.post('/setup/start', { stackSlug: selectedStack });
      if (data.success) {
        navigate('/learn');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = 5;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/30">Step {step + 1} of {totalSteps}</span>
            <span className="text-xs text-white/30">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Step 0: Goal Selection */}
        {step === 0 && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">What do you want to become?</h1>
            <p className="text-white/40 text-sm mb-6">Choose your learning goal</p>
            <div className="grid grid-cols-2 gap-3">
              {goals.map((g) => {
                const Icon = GOAL_ICONS[g.id] || Code;
                return (
                  <button
                    key={g.id}
                    onClick={() => { setSelectedGoal(g.id); setStep(1); }}
                    className={`bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-left hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group ${
                      selectedGoal === g.id ? 'border-cyan-500/40 bg-cyan-500/5' : ''
                    }`}
                  >
                    <Icon className="w-5 h-5 text-white/30 group-hover:text-cyan-400 mb-2 transition-colors" />
                    <div className="text-sm font-medium text-white">{g.label}</div>
                    <div className="text-xs text-white/40 mt-0.5">{g.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Stack Selection */}
        {step === 1 && (
          <div>
            <button onClick={() => setStep(0)} className="text-xs text-white/40 hover:text-white/60 mb-4 flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" /> Back
            </button>
            <h1 className="text-2xl font-bold text-white mb-2">Choose your stack</h1>
            <p className="text-white/40 text-sm mb-6">Select the technologies you want to learn</p>
            {loadingStacks ? (
              <div className="text-center py-10 text-white/30 text-sm">Loading stacks...</div>
            ) : stacks.length === 0 ? (
              <div className="text-center py-10 text-white/40 text-sm">No stacks available for this goal</div>
            ) : (
              <div className="space-y-3">
                {stacks.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => { setSelectedStack(s.slug); setStep(2); }}
                    className={`w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-left hover:bg-white/[0.05] hover:border-white/[0.1] transition-all ${
                      selectedStack === s.slug ? 'border-cyan-500/40 bg-cyan-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-medium text-sm">{s.name}</h3>
                      <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded">{s.difficulty}</span>
                    </div>
                    <p className="text-white/40 text-xs mb-3">{s.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {s.technologies?.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400/70 rounded">{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      <span>{s.estimatedWeeks} weeks</span>
                      {s.whatYouWillLearn?.length > 0 && (
                        <span>{s.whatYouWillLearn.length} skills</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Stack Preview */}
        {step === 2 && stackCurriculum && (
          <div>
            <button onClick={() => setStep(1)} className="text-xs text-white/40 hover:text-white/60 mb-4 flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" /> Back
            </button>
            <h1 className="text-2xl font-bold text-white mb-2">{stackCurriculum.stack.name}</h1>
            <p className="text-white/40 text-sm mb-4">{stackCurriculum.stack.description}</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="text-xs text-white/40 mb-1">Difficulty</div>
                <div className="text-sm text-white font-medium capitalize">{stackCurriculum.stack.difficulty}</div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="text-xs text-white/40 mb-1">Duration</div>
                <div className="text-sm text-white font-medium">{stackCurriculum.stack.estimatedWeeks} weeks</div>
              </div>
            </div>
            {stackCurriculum.stack.whatYouWillLearn?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/60 mb-3">YOU WILL LEARN</h3>
                <div className="grid grid-cols-2 gap-2">
                  {stackCurriculum.stack.whatYouWillLearn.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-white/60">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white/60 mb-3">CURRICULUM</h3>
              <div className="space-y-2">
                {stackCurriculum.courses.map((c, i) => (
                  <div key={c._id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                    <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-xs text-white/30 font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/80 truncate">{c.title}</div>
                      <div className="text-xs text-white/30">{c.totalLessons} lessons · ~{c.estimatedMinutes}m</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full py-3 bg-cyan-500/10 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 3: Experience Level */}
        {step === 3 && (
          <div>
            <button onClick={() => setStep(2)} className="text-xs text-white/40 hover:text-white/60 mb-4 flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" /> Back
            </button>
            <h1 className="text-2xl font-bold text-white mb-2">How much do you already know?</h1>
            <p className="text-white/40 text-sm mb-6">This helps us personalize your starting point</p>
            <div className="space-y-3 mb-8">
              {EXPERIENCE_LEVELS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setExperience(l.id)}
                  className={`w-full bg-white/[0.03] border rounded-xl p-4 text-left transition-all ${
                    experience === l.id
                      ? 'border-cyan-500/40 bg-cyan-500/5'
                      : 'border-white/[0.06] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{l.label}</div>
                  <div className="text-xs text-white/40">{l.desc}</div>
                </button>
              ))}
            </div>
            <h2 className="text-lg font-bold text-white mb-2">How should we teach you?</h2>
            <p className="text-white/40 text-sm mb-4">Choose your learning style</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {LEARNING_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setLearningStyle(s.id)}
                  className={`bg-white/[0.03] border rounded-xl p-3 text-left transition-all ${
                    learningStyle === s.id
                      ? 'border-cyan-500/40 bg-cyan-500/5'
                      : 'border-white/[0.06] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{s.label}</div>
                  <div className="text-xs text-white/40">{s.desc}</div>
                </button>
              ))}
            </div>
            <h2 className="text-lg font-bold text-white mb-2">How much time do you have?</h2>
            <p className="text-white/40 text-sm mb-4">Optional — helps us pace your learning</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {WEEKLY_GOALS.map((g) => (
                <button
                  key={g.hours}
                  onClick={() => setWeeklyGoal(g.hours)}
                  className={`bg-white/[0.03] border rounded-xl p-3 text-left transition-all ${
                    weeklyGoal === g.hours
                      ? 'border-cyan-500/40 bg-cyan-500/5'
                      : 'border-white/[0.06] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{g.label}</div>
                  <div className="text-xs text-white/40">{g.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(4)}
              disabled={!experience}
              className="w-full py-3 bg-cyan-500/10 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
            >
              Review & Start <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 4: Final Preview */}
        {step === 4 && (
          <div>
            <button onClick={() => setStep(3)} className="text-xs text-white/40 hover:text-white/60 mb-4 flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" /> Back
            </button>
            <h1 className="text-2xl font-bold text-white mb-2">Your Learning Journey</h1>
            <p className="text-white/40 text-sm mb-6">Review your personalized path</p>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-white/40 mb-1">Goal</div>
                  <div className="text-sm text-white font-medium capitalize">
                    {selectedGoal?.replace(/_/g, ' ')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40 mb-1">Stack</div>
                  <div className="text-sm text-white font-medium">{stackCurriculum?.stack?.name}</div>
                </div>
                <div>
                  <div className="text-xs text-white/40 mb-1">Experience</div>
                  <div className="text-sm text-white font-medium capitalize">
                    {experience?.replace(/_/g, ' ')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40 mb-1">Learning Style</div>
                  <div className="text-sm text-white font-medium capitalize">
                    {learningStyle?.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
              {stackCurriculum?.stack?.whatYouWillLearn?.length > 0 && (
                <div className="border-t border-white/[0.04] pt-4">
                  <div className="text-xs text-white/40 mb-2">You will learn</div>
                  <div className="flex flex-wrap gap-1.5">
                    {stackCurriculum.stack.whatYouWillLearn.map((item) => (
                      <span key={item} className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleStartLearning}
              disabled={saving}
              className="w-full py-4 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white rounded-xl text-sm font-bold hover:from-cyan-500/30 hover:to-violet-500/30 transition-all flex items-center justify-center gap-2 border border-cyan-500/20"
            >
              <Rocket className="w-5 h-5" />
              {saving ? 'Setting up your path...' : 'Start Learning'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
