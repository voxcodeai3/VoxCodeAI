import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, FolderOpen, Check, Search, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export default function ProjectSelector({ onCreateNew }) {
  const { projects, currentProject, fetchProjects, fetchProject } = useProject();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (projects.length === 0) fetchProjects();
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const handleSelect = async (project) => {
    await fetchProject(project._id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all text-sm"
      >
        <FolderOpen className="h-3.5 w-3.5 text-cyan-400/60" />
        <span className="text-white/70 max-w-[140px] truncate">
          {currentProject?.name || 'Select Project'}
        </span>
        <ChevronDown className={`h-3 w-3 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-[#0c1020] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-white/[0.04]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/30"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-white/30" />
                </button>
              )}
            </div>
          </div>

          {/* Project list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-white/30">
                {search ? 'No matches' : 'No projects yet'}
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p._id}
                  onClick={() => handleSelect(p)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
                >
                  {currentProject?._id === p._id ? (
                    <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/70 truncate">{p.name}</div>
                    <div className="text-[10px] text-white/25">
                      {p.files?.length || 0} files · {p.language || 'general'}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-white/[0.04] p-1">
            <button
              onClick={() => { setOpen(false); onCreateNew?.(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-cyan-400/70 hover:bg-cyan-500/5 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
