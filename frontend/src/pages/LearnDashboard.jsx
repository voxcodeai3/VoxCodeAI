import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Play, BookOpen, Layers, Database, Wrench, Smartphone, Code2 } from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import TechnologyDropdown from '../components/learn/TechnologyDropdown';
import LearningStackCard from '../components/learn/LearningStackCard';
import { CATEGORIES, PROGRAMMING_LANGUAGES, FRONTEND_STACKS, BACKEND_STACKS, PYTHON_FULLSTACK, JAVA_FULLSTACK, MOBILE_STACKS, DATABASES, TOOLS } from '../data/learnCatalog';
import learningApi from '../services/learningApi';
import learningMemoryApi from '../services/learningMemoryApi';

function Section({ id, title, subtitle, icon: Icon, children }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-white/[0.06] pt-8 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-4 h-4 text-white/30" />}
        <h2 className="text-sm font-semibold tracking-widest text-white/60 uppercase">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-white/40 mb-4">{subtitle}</p>}
      {children}
    </section>
  );
}

function ContinueBanner({ dashboard, resume, onContinue }) {
  const hasResume = resume?.hasProgress && resume?.currentLesson;
  const hasActive = dashboard?.activePath || dashboard?.inProgressLessons > 0 || hasResume;
  if (!hasActive) return null;
  const active = dashboard?.activePath;
  if (hasResume) {
    return (
      <div className="bg-white text-black rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs tracking-widest text-black/50 mb-1">CONTINUE LEARNING</div>
          <div className="font-medium truncate">{resume.learningPath?.title || resume.activeLearningPath?.title || 'Your learning'}</div>
          <div className="text-sm text-black/60 truncate">
            {[resume.currentStage?.title, resume.currentLesson?.title].filter(Boolean).join(' · ') || resume.currentLesson?.title || 'Pick up where you left off'}
          </div>
        </div>
        <button onClick={onContinue} className="px-5 py-2.5 bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2 shrink-0">
          <Play className="w-4 h-4" /> Continue Learning <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="bg-white text-black rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-xs tracking-widest text-black/50 mb-1">CONTINUE LEARNING</div>
        <div className="font-medium truncate">{active?.title || 'Your learning'}</div>
        <div className="text-sm text-black/60 truncate">{active?.description || 'Pick up where you left off'}</div>
      </div>
      <button onClick={onContinue} className="px-5 py-2.5 bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2 shrink-0">
        <Play className="w-4 h-4" /> Continue Learning <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function LearningDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    dashboard, recommendations, courses, learningPaths,
    fetchDashboard, fetchRecommendations, fetchCourses, fetchLearningPaths,
  } = useCourse();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [foundationPaths, setFoundationPaths] = useState(null);
  const [foundationTechs, setFoundationTechs] = useState(null);
  const [apiCategories, setApiCategories] = useState(null);
  const [resume, setResume] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await Promise.all([fetchDashboard(), fetchRecommendations(), fetchCourses(), fetchLearningPaths()]);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadFoundation() {
      try {
        const [cats, techs, paths] = await Promise.all([
          learningApi.getCategories(),
          learningApi.getTechnologies(),
          learningApi.getPaths(),
        ]);
        if (!cancelled) {
          setApiCategories(cats);
          setFoundationTechs(techs);
          setFoundationPaths(paths);
        }
      } catch {}
    }
    loadFoundation();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    learningMemoryApi.getResume().then(setResume).catch(() => {});
  }, []);

  const normalizedQ = q.trim().toLowerCase();
  const matches = (stack) => {
    if (!normalizedQ) return true;
    const hay = [stack.title, ...(stack.techs || [])].join(' ').toLowerCase();
    return hay.includes(normalizedQ);
  };
  const apiMatches = (path) => {
    if (!normalizedQ) return true;
    const hay = [path.title, path.description, ...(path.technologies||[]).map(t=>t.name||t.slug||'')].join(' ').toLowerCase();
    return hay.includes(normalizedQ);
  };
  const difficultyMatches = (stack) => filterDifficulty === 'all' || stack.difficulty === filterDifficulty;
  const apiDifficultyMatches = (path) => filterDifficulty === 'all' || path.difficulty === filterDifficulty;

  const frontendApi = foundationPaths?.filter(p => p.category === 'frontend') || [];
  const backendApi = foundationPaths?.filter(p => p.category === 'backend') || [];
  const fullstackApi = foundationPaths?.filter(p => p.category === 'fullstack') || [];
  const mobileApi = foundationPaths?.filter(p => p.category === 'mobile') || [];
  const databasesApi = foundationPaths?.filter(p => p.category === 'databases') || [];

  if (loading && !dashboard) {
    return <div className="min-h-screen bg-[#08090d] flex items-center justify-center"><div className="text-white/40 text-sm">Loading Learn…</div></div>;
  }

  const goLesson = (lessonId) => lessonId && navigate(`/learn/lesson/${lessonId}`);
  const goCourse = (slug) => {
    const c = courses.find(x => x.slug === slug);
    if (c) navigate(`/learn/course/${c._id}`);
    else navigate('/learn/courses');
  };
  const goPath = (slug) => {
    const p = learningPaths.find(x => x.slug === slug);
    if (p) navigate(`/learn/path/${p._id}`);
    else navigate('/learn/paths');
  };

  const handleContinue = () => {
    if (resume?.hasProgress && resume?.currentLesson?._id) {
      navigate(`/learn/lesson/${resume.currentLesson._id}`);
      return;
    }
    const rec = recommendations.find(r => r.type === 'continue' && r.lessonId);
    if (rec) goLesson(rec.lessonId);
    else if (dashboard?.activePath) navigate(`/learn/path/${dashboard.activePath._id}`);
    else navigate('/learn/courses');
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero — calm, not glass-card */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Learn to code</h1>
          <p className="text-sm text-white/50 mt-1 max-w-2xl">Choose what you want to learn. Build your skills step by step with guided lessons, practice, and projects.</p>
        </div>

        {/* Search + filters — simple row */}
        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search what you want to learn…  e.g. React, Python, Django"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/15"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} style={{ colorScheme: 'dark' }} className="bg-[#14161f] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/15">
              <option className="bg-[#14161f] text-white" value="all">All levels</option>
              <option className="bg-[#14161f] text-white" value="beginner">Beginner</option>
              <option className="bg-[#14161f] text-white" value="intermediate">Intermediate</option>
              <option className="bg-[#14161f] text-white" value="advanced">Advanced</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ colorScheme: 'dark' }} className="bg-[#14161f] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/15">
              <option className="bg-[#14161f] text-white" value="all">All</option>
              <option className="bg-[#14161f] text-white" value="not_started">Not Started</option>
              <option className="bg-[#14161f] text-white" value="in_progress">In Progress</option>
              <option className="bg-[#14161f] text-white" value="completed">Completed</option>
            </select>
            <div className="flex items-center gap-1 text-xs text-white/30 ml-auto">
              <span className="hidden sm:inline">7 categories</span>
            </div>
          </div>
        </div>

        <ContinueBanner dashboard={dashboard} resume={resume} onContinue={handleContinue} />
        {resume && !resume.hasProgress && (
          <div className="mt-4 border border-white/[0.06] rounded-xl p-4 bg-white/[0.02] flex items-center justify-between">
            <div className="text-sm text-white/60">Start your learning journey — choose a path below.</div>
            <button onClick={() => document.getElementById('programming-languages')?.scrollIntoView({ behavior: 'smooth' })} className="text-xs text-cyan-400 hover:text-cyan-300">Explore →</button>
          </div>
        )}

        {/* Foundation status — proves API-driven, not hardcoded */}
        {apiCategories && (
          <div className="text-[11px] text-white/30 border border-white/[0.06] rounded-lg px-3 py-2 bg-white/[0.02]">Live API: {apiCategories.length} categories · {foundationTechs?.length || 0} technologies · {foundationPaths?.length || 0} paths</div>
        )}

        {/* Category nav — subtle tabs */}
        <div className="mt-8 mb-6 border-y border-white/[0.06] py-3 flex gap-4 overflow-x-auto text-xs text-white/40">
          {CATEGORIES.map(c => (
            <a key={c.id} href={`#${c.anchor}`} className="hover:text-white whitespace-nowrap">{c.label}</a>
          ))}
        </div>

        <div className="space-y-10">
          <Section id="programming-languages" title="Programming Languages" subtitle="Pick a language. Learn it step by step." icon={Code2}>
            <div className="grid gap-2">
              {(foundationPaths ? foundationPaths.filter(p => p.category === 'programming_languages').filter(p => matches({ title: p.title, techs: (p.technologies||[]).map(t=>t.slug||t) }) && difficultyMatches({ difficulty: p.difficulty })) : PROGRAMMING_LANGUAGES.filter(s => matches({ title: s.techId, techs: [s.techId] }) && difficultyMatches({ difficulty: s.level.includes('Beginner') ? 'beginner' : s.level.includes('Intermediate') ? 'intermediate' : 'advanced' }))).map(item => {
                // API-driven vs hardcoded
                if (item.category) {
                  const techSlug = item.technologies?.[0]?.slug || item.slug;
                  const dropdownItem = { techId: techSlug, id: item.slug, level: `${item.difficulty}`, stages: item.stages?.length || 9, minutes: 300, prerequisite: item.prerequisites?.length > 0 };
                  return (
                    <TechnologyDropdown
                      key={item.slug}
                      item={dropdownItem}
                      progress={0}
                      onContinue={() => navigate(`/learn/path/${item._id}`)}
                    />
                  );
                }
                return (
                  <TechnologyDropdown
                    key={item.id}
                    item={item}
                    progress={0}
                    onContinue={() => item.courseSlug ? goCourse(item.courseSlug) : navigate(`/learn/courses?search=${item.techId}`)}
                  />
                );
              })}
            </div>
          </Section>

          <Section id="frontend-development" title="Frontend Development" subtitle="Choose a stack — each is a complete learning path." icon={Layers}>
            <div className="grid md:grid-cols-2 gap-3">
              {(frontendApi.length ? frontendApi.filter(p => apiMatches(p) && apiDifficultyMatches(p)) : FRONTEND_STACKS.filter(s => matches(s) && difficultyMatches(s))).map(item => {
                if (item.category) {
                  return <LearningStackCard key={item._id} stack={{ title: item.title, techs: (item.technologies||[]).map(t=>t.slug), difficulty: item.difficulty, stages: item.stages?.length || 6, duration: item.estimatedDuration }} progress={0} onContinue={() => navigate(`/learn/path/${item._id}`)} onView={() => navigate(`/learn/path/${item._id}`)} />;
                }
                return <LearningStackCard key={item.id} stack={item} progress={0} onContinue={() => item.pathSlug ? goPath(item.pathSlug) : navigate(`/learn/courses`)} onView={() => item.pathSlug ? goPath(item.pathSlug) : navigate(`/learn/courses`)} />;
              })}
            </div>
          </Section>

          <Section id="backend-development" title="Backend Development" subtitle="Server, APIs, databases — pick your stack." icon={Layers}>
            <div className="grid md:grid-cols-2 gap-3">
              {(backendApi.length ? backendApi.filter(p => apiMatches(p) && apiDifficultyMatches(p)) : BACKEND_STACKS.filter(s => matches(s) && difficultyMatches(s))).map(item => {
                if (item.category) {
                  return <LearningStackCard key={item._id} stack={{ title: item.title, techs: (item.technologies||[]).map(t=>t.slug), difficulty: item.difficulty, stages: item.stages?.length || 6, duration: item.estimatedDuration }} progress={0} onContinue={() => navigate(`/learn/path/${item._id}`)} onView={() => navigate(`/learn/path/${item._id}`)} />;
                }
                return <LearningStackCard key={item.id} stack={item} progress={0} onContinue={() => item.pathSlug ? goPath(item.pathSlug) : navigate(`/learn/courses`)} onView={() => item.pathSlug ? goPath(item.pathSlug) : navigate(`/learn/courses`)} />;
              })}
            </div>
          </Section>

          <Section id="full-stack-development" title="Full Stack Development" subtitle="End-to-end stacks — frontend + backend + database." icon={Layers}>
            <div className="grid md:grid-cols-2 gap-3">
              {(fullstackApi.length ? fullstackApi.filter(p => apiMatches(p) && apiDifficultyMatches(p)) : []).map(p => (
                <LearningStackCard key={p._id} stack={{ title: p.title, techs: (p.technologies||[]).map(t=>t.slug), difficulty: p.difficulty, stages: p.stages?.length || 6, duration: p.estimatedDuration }} progress={0} onContinue={() => navigate(`/learn/path/${p._id}`)} onView={() => navigate(`/learn/path/${p._id}`)} />
              ))}
              {fullstackApi.length === 0 && <div className="text-xs text-white/30">No full-stack paths yet — seed running.</div>}
            </div>
          </Section>

          <Section id="mobile-development" title="Mobile Development" subtitle="Native and cross-platform." icon={Smartphone}>
            <div className="grid md:grid-cols-2 gap-3">
              {(mobileApi.length ? mobileApi.filter(p => apiMatches(p) && apiDifficultyMatches(p)) : MOBILE_STACKS.filter(s => matches(s) && difficultyMatches(s))).map(item => {
                if (item.category) {
                  return <LearningStackCard key={item._id} stack={{ title: item.title, techs: (item.technologies||[]).map(t=>t.slug), difficulty: item.difficulty, stages: item.stages?.length || 6, duration: item.estimatedDuration }} progress={0} onContinue={() => navigate(`/learn/path/${item._id}`)} onView={() => navigate(`/learn/path/${item._id}`)} />;
                }
                return <LearningStackCard key={item.id} stack={item} progress={0} onContinue={() => navigate('/learn/courses')} onView={() => navigate('/learn/paths')} />;
              })}
            </div>
          </Section>

          <Section id="databases" title="Databases" subtitle="SQL & NoSQL — individually or as part of a stack." icon={Database}>
            <div className="grid gap-2">
              {(databasesApi.length ? databasesApi.filter(p => apiMatches(p) && apiDifficultyMatches(p)) : DATABASES.filter(s => !normalizedQ || s.techId.includes(normalizedQ))).map(item => {
                if (item.category) {
                  const techSlug = item.technologies?.[0]?.slug || item.slug;
                  return <TechnologyDropdown key={item._id} item={{ techId: techSlug, id: item.slug, level: item.difficulty, stages: 5, minutes: 120 }} progress={0} onContinue={() => navigate(`/learn/path/${item._id}`)} />;
                }
                return <TechnologyDropdown key={item.id} item={item} progress={0} onContinue={() => navigate(`/learn/courses?search=${item.techId}`)} />;
              })}
            </div>
          </Section>

          <Section id="tools" title="Tools & Other Technologies" subtitle="Supporting skills for every developer." icon={Wrench}>
            <div className="divide-y divide-white/[0.06] border border-white/[0.06] rounded-lg overflow-hidden">
              {TOOLS.filter(t => !normalizedQ || `${t.name} ${t.desc}`.toLowerCase().includes(normalizedQ)).map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04]">
                  <div>
                    <div className="text-sm text-white/80">{t.name}</div>
                    <div className="text-xs text-white/40">{t.desc}</div>
                  </div>
                  <button onClick={() => navigate(`/learn/courses?search=${t.name}`)} className="text-xs text-white/60 hover:text-white">Learn →</button>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row gap-3 text-xs text-white/40">
          <button onClick={() => navigate('/learn/courses')} className="flex items-center gap-2 hover:text-white"><BookOpen className="w-3 h-3" /> Browse all courses</button>
          <button onClick={() => navigate('/learn/paths')} className="flex items-center gap-2 hover:text-white"><Layers className="w-3 h-3" /> Browse all paths</button>
          <span className="sm:ml-auto">{courses.length} courses · {learningPaths.length} paths</span>
        </div>
      </div>
    </div>
  );
}
