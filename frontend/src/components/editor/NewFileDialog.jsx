import { useState } from 'react';
import { X, FilePlus } from 'lucide-react';
import { useCodingWorkspace, detectLanguage } from '../../context/CodingWorkspaceContext';

const INVALID_PATTERN = /[^a-zA-Z0-9._\-\/]/;

export default function NewFileDialog({ isOpen, onClose }) {
  const { createFile } = useCodingWorkspace();
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCreate = () => {
    const trimmed = filename.trim();
    if (!trimmed) {
      setError('Filename cannot be empty.');
      return;
    }
    if (INVALID_PATTERN.test(trimmed)) {
      setError('Only letters, numbers, dots, dashes, underscores, and slashes allowed.');
      return;
    }
    if (trimmed.startsWith('.') || trimmed.startsWith('/')) {
      setError('Filename cannot start with a dot or slash.');
      return;
    }
    const success = createFile(trimmed);
    if (!success) {
      setError('A file with that name already exists.');
      return;
    }
    setFilename('');
    setError('');
    onClose();
  };

  const detected = filename.trim() ? detectLanguage(filename.trim()) : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[90vw] max-w-[380px] rounded-2xl border border-cyan-400/15 bg-[#0a1020]/95 backdrop-blur-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilePlus className="h-4 w-4 text-cyan-300/70" />
            <p className="text-sm font-medium text-white/80">New File</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <input
            type="text"
            value={filename}
            onChange={(e) => {
              setFilename(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="e.g. App.jsx, utils.js, styles.css"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 focus:border-cyan-400/30 focus:outline-none"
            autoFocus
          />
          {detected && (
            <p className="mt-1.5 text-[10px] text-white/25">
              Detected language: <span className="text-cyan-300/50">{detected}</span>
            </p>
          )}
          {error && (
            <p className="mt-1.5 text-[10px] text-red-400/60">{error}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="flex-1 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
