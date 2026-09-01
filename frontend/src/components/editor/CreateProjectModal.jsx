import { useState } from 'react';
import { X, Code2, FileCode, Server, Globe, Cpu } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const TEMPLATES = [
  { id: 'blank', label: 'Blank', icon: FileCode, desc: 'Start from scratch' },
  { id: 'javascript', label: 'JavaScript', icon: Code2, desc: 'Node.js project' },
  { id: 'html', label: 'HTML/CSS/JS', icon: Globe, desc: 'Web page' },
  { id: 'react', label: 'React', icon: Code2, desc: 'React app' },
  { id: 'node', label: 'Node.js', icon: Server, desc: 'Server app' },
  { id: 'python', label: 'Python', icon: Cpu, desc: 'Python script' },
];

export default function CreateProjectModal({ isOpen, onClose, onCreated }) {
  const { createProject } = useProject();
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('blank');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) { setError('Project name required'); return; }
    setCreating(true);
    setError('');
    try {
      const project = await createProject({ name: name.trim(), template, language: 'javascript' });
      onCreated?.(project);
      setName('');
      setTemplate('blank');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#0c1020] border border-white/[0.08] rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <h2 className="text-sm font-semibold text-white">Create Project</h2>
          <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="my-project"
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/30"
              autoFocus
            />
          </div>

          {/* Template */}
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Template</label>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      template === t.id
                        ? 'border-cyan-500/40 bg-cyan-500/5'
                        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mx-auto mb-1 ${template === t.id ? 'text-cyan-400' : 'text-white/30'}`} />
                    <div className="text-[10px] text-white/60">{t.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-white/[0.04]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 text-white/50 rounded-lg text-xs hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex-1 py-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-40"
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
