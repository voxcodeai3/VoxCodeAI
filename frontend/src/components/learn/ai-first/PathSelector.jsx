import { useState, useEffect } from 'react';
import { Search, Code2, Layers, Smartphone, Database, ChevronRight, Loader2 } from 'lucide-react';
import learningApi from '../../../services/learningApi';

const CATEGORY_META = {
  programming_languages: { label: 'Programming Languages', icon: Code2, desc: 'Pick a language. Learn it step by step.' },
  frontend: { label: 'Frontend Development', icon: Layers, desc: 'Choose a stack — each is a complete learning path.' },
  backend: { label: 'Backend Development', icon: Layers, desc: 'Server, APIs, databases — pick your stack.' },
  fullstack: { label: 'Full Stack Development', icon: Layers, desc: 'End-to-end stacks — frontend + backend + database.' },
  mobile: { label: 'Mobile Development', icon: Smartphone, desc: 'Native and cross-platform.' },
  databases: { label: 'Databases', icon: Database, desc: 'SQL & NoSQL — individually or as part of a stack.' },
};

const DIFFICULTY_COLORS = {
  beginner: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  intermediate: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  advanced: 'bg-rose-400/10 text-rose-400 border-rose-400/20',
};

export default function PathSelector({ onSelect }) {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    let cancelled = false;
    learningApi.getPaths()
      .then(data => { if (!cancelled) setPaths(data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = paths.filter(p => {
    if (q) {
      const hay = [p.title, p.description, ...(p.technologies || []).map(t => t.name || t.slug || '')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filterDifficulty !== 'all' && p.difficulty !== filterDifficulty) return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    return true;
  });

  const grouped = {};
  filtered.forEach(p => {
    const cat = p.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const categories = Object.keys(CATEGORY_META).filter(k => grouped[k]?.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
        <span className="ml-2 text-sm text-white/40">Loading learning paths...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4">
      <div className="mb-5 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Choose a Learning Path</h1>
        <p className="text-sm text-white/50 mt-1">Select what you want to learn. You'll get a personalized roadmap and an AI teacher to guide you.</p>
      </div>

      <div className="mb-4 space-y-3 sm:mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search paths... e.g. React, Python, MERN"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/15 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterDifficulty}
            onChange={e => setFilterDifficulty(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="bg-[#14161f] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/15"
          >
            <option className="bg-[#14161f]" value="all">All levels</option>
            <option className="bg-[#14161f]" value="beginner">Beginner</option>
            <option className="bg-[#14161f]" value="intermediate">Intermediate</option>
            <option className="bg-[#14161f]" value="advanced">Advanced</option>
          </select>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="bg-[#14161f] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/15"
          >
            <option className="bg-[#14161f]" value="all">All categories</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option className="bg-[#14161f]" key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <span className="text-xs text-white/30 self-center ml-auto">{filtered.length} paths</span>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {categories.map(cat => {
          const meta = CATEGORY_META[cat] || { label: cat, icon: Layers, desc: '' };
          const Icon = meta.icon;
          return (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-white/30" />
                <h2 className="text-sm font-semibold tracking-widest text-white/60 uppercase">{meta.label}</h2>
              </div>
              <p className="text-xs text-white/40 mb-3">{meta.desc}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {grouped[cat].map(path => (
                  <PathCard key={path._id} path={path} onSelect={onSelect} />
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/40 text-sm">
            No paths found. Try a different search.
          </div>
        )}
      </div>
    </div>
  );
}

function PathCard({ path, onSelect }) {
  const techs = (path.technologies || []).map(t => t.name || t.slug || '').filter(Boolean);
  const diffClass = DIFFICULTY_COLORS[path.difficulty] || DIFFICULTY_COLORS.beginner;

  return (
    <button
      onClick={() => onSelect(path)}
      className="w-full text-left p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white/90 group-hover:text-white text-sm truncate">{path.title}</div>
          {path.description && (
            <div className="text-xs text-white/40 mt-0.5 line-clamp-2">{path.description}</div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${diffClass}`}>
              {path.difficulty || 'beginner'}
            </span>
            {techs.slice(0, 4).map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/50 border border-white/[0.06]">
                {t}
              </span>
            ))}
            {techs.length > 4 && (
              <span className="text-[10px] px-1.5 py-0.5 text-white/30">+{techs.length - 4}</span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 mt-0.5 transition-colors" />
      </div>
    </button>
  );
}
