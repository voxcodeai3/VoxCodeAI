import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, Search, Folder, Trash2, Copy, Pencil,
  Clock, Code2, RefreshCw, X,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const LANG_COLORS = {
  javascript: '#f7df1e',
  typescript: '#3178c6',
  python: '#3776ab',
  java: '#ed8b00',
  html: '#e34c26',
  css: '#1572b6',
  react: '#61dafb',
};

const SORT_OPTIONS = [
  { id: 'updated', label: 'Recently Updated' },
  { id: 'created', label: 'Recently Created' },
  { id: 'name', label: 'Name' },
];

const TEMPLATES = [
  { id: 'blank', name: 'Blank', icon: '📄' },
  { id: 'javascript', name: 'JavaScript', icon: '🟨' },
  { id: 'react', name: 'React', icon: '⚛️' },
  { id: 'node', name: 'Node.js', icon: '🟢' },
  { id: 'python', name: 'Python', icon: '🐍' },
  { id: 'html', name: 'HTML/CSS', icon: '🌐' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Projects() {
  const navigate = useNavigate();
  const {
    projects, loading, fetchProjects, createProject, deleteProject,
    duplicateProject, renameProject, fetchProject,
  } = useProject();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('updated');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLang, setNewLang] = useState('javascript');
  const [newTemplate, setNewTemplate] = useState('blank');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameName, setRenameName] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = useMemo(() => {
    let list = [...projects];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'updated') list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    else if (sortBy === 'created') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [projects, search, sortBy]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const project = await createProject({
        name: newName.trim(),
        description: newDesc.trim(),
        language: newLang,
        template: newTemplate,
      });
      setShowNew(false);
      setNewName('');
      setNewDesc('');
      if (project?.id) {
        await fetchProject(project.id);
        navigate('/voxcode');
      }
    } catch {
      // error handled in context
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = async (id) => {
    await fetchProject(id);
    navigate('/voxcode');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteProject(deleteTarget._id);
    setDeleteTarget(null);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return;
    await renameProject(renameTarget._id, renameName.trim());
    setRenameTarget(null);
  };

  const handleDuplicate = async (id) => {
    await duplicateProject(id);
  };

  return (
    <div className="flex flex-col h-full bg-[#010208]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/voxcode')}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" /> Back
          </button>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-xs font-semibold text-white/70">MY PROJECTS</span>
          <span className="text-[10px] text-white/20">{projects.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-[11px] text-cyan-300 hover:bg-cyan-400/[0.12] transition-all"
        >
          <Plus className="h-3 w-3" /> NEW
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <Search className="h-3.5 w-3.5 text-white/20" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="flex-1 bg-transparent text-xs text-white/70 placeholder-white/20 outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-white/20 hover:text-white/40">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-white/40 outline-none appearance-none cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id} className="bg-[#0a0f1e]">{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && projects.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-white/20 text-xs gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading projects...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center space-y-3">
            <Folder className="h-8 w-8 text-white/10" />
            <p className="text-xs text-white/30">
              {search ? 'No projects match your search.' : 'No projects yet. Create one to get started.'}
            </p>
          </div>
        ) : (
          filtered.map((project) => (
            <div
              key={project._id}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-400/15 hover:bg-cyan-400/[0.02] transition-all cursor-pointer"
              onClick={() => handleOpen(project._id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: LANG_COLORS[project.language] || '#888' }}
                    />
                    <h3 className="text-sm font-medium text-white/80 truncate">{project.name}</h3>
                  </div>
                  {project.description && (
                    <p className="text-[11px] text-white/30 mt-1 truncate ml-4">{project.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 ml-4">
                    <span className="text-[10px] text-white/20 capitalize">{project.language}</span>
                    <span className="text-[10px] text-white/10">·</span>
                    <span className="text-[10px] text-white/20 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> {timeAgo(project.updatedAt)}
                    </span>
                    {project.files?.length > 0 && (
                      <>
                        <span className="text-[10px] text-white/10">·</span>
                        <span className="text-[10px] text-white/20">{project.files.length} file{project.files.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => { setRenameTarget(project); setRenameName(project.name); }}
                    className="rounded-lg p-1.5 text-white/20 hover:text-cyan-300 hover:bg-white/[0.05] transition-colors"
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(project._id)}
                    className="rounded-lg p-1.5 text-white/20 hover:text-cyan-300 hover:bg-white/[0.05] transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(project)}
                    className="rounded-lg p-1.5 text-white/20 hover:text-red-400 hover:bg-white/[0.05] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Project Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative w-[90vw] max-w-md rounded-2xl border border-cyan-400/15 bg-[#060c18]/95 backdrop-blur-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/80">New Project</h2>
              <button type="button" onClick={() => setShowNew(false)} className="text-white/30 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] text-cyan-400/50 uppercase tracking-wider mb-1.5 block">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Project"
                maxLength={100}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-white/70 placeholder-white/20 outline-none focus:border-cyan-400/30"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[10px] text-cyan-400/50 uppercase tracking-wider mb-1.5 block">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-white/70 placeholder-white/20 outline-none focus:border-cyan-400/30"
              />
            </div>

            <div>
              <label className="text-[10px] text-cyan-400/50 uppercase tracking-wider mb-1.5 block">Template</label>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setNewTemplate(t.id); setNewLang(t.id === 'blank' ? 'javascript' : t.id === 'html' ? 'html' : t.id); }}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      newTemplate === t.id
                        ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                    }`}
                  >
                    <span className="text-lg block">{t.icon}</span>
                    <span className="text-[10px] block mt-1">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-xs text-cyan-300 hover:bg-cyan-400/[0.12] transition-all disabled:opacity-40"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-[90vw] max-w-sm rounded-2xl border border-red-400/15 bg-[#060c18]/95 backdrop-blur-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white/80">Delete Project</h2>
            <p className="text-xs text-white/40">
              Delete <span className="text-white/60">"{deleteTarget.name}"</span>? This will permanently delete the project.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-white/40 hover:text-white/60 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-2.5 text-xs text-red-300 hover:bg-red-400/[0.12] transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRenameTarget(null)} />
          <div className="relative w-[90vw] max-w-sm rounded-2xl border border-cyan-400/15 bg-[#060c18]/95 backdrop-blur-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white/80">Rename Project</h2>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              maxLength={100}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-cyan-400/30"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-white/40 hover:text-white/60 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRename}
                disabled={!renameName.trim()}
                className="flex-1 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.12] transition-all disabled:opacity-40"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
