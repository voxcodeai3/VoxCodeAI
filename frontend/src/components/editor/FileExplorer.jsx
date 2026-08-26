import { useState } from 'react';
import { File, Plus, Trash2, Edit3, Folder } from 'lucide-react';
import { useCodingWorkspace } from '../../context/CodingWorkspaceContext';

export default function FileExplorer({ onNewFile }) {
  const { fileList, activeFile, openFile, deleteFile, renameFile } = useCodingWorkspace();
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState(null);

  const startRename = (filename) => {
    setRenaming(filename);
    setRenameValue(filename);
  };

  const commitRename = () => {
    if (renaming && renameValue.trim() && renameValue !== renaming) {
      renameFile(renaming, renameValue.trim());
    }
    setRenaming(null);
  };

  const confirmDelete = (filename) => {
    deleteFile(filename);
    setDeleting(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5 text-cyan-400/50" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            Files
          </span>
        </div>
        <button
          type="button"
          onClick={onNewFile}
          className="rounded p-1 text-white/30 hover:text-cyan-300 transition-colors"
          aria-label="New file"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileList.length === 0 && (
          <p className="px-3 py-4 text-[10px] text-white/20 text-center">
            No files yet
          </p>
        )}
        {fileList.map((filename) => {
          const isActive = filename === activeFile;
          const isRenaming = renaming === filename;
          const isDeleting = deleting === filename;

          return (
            <div key={filename}>
              <div
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-cyan-400/[0.06] text-cyan-300'
                    : 'text-white/50 hover:bg-white/[0.03] hover:text-white/70'
                }`}
                onClick={() => {
                  if (!isRenaming) openFile(filename);
                }}
              >
                <File className="h-3.5 w-3.5 shrink-0 opacity-50" />

                {isRenaming ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className="flex-1 bg-transparent border-b border-cyan-400/30 text-xs text-white/80 outline-none px-0.5"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate text-[11px]">{filename}</span>
                )}

                {/* Actions — visible on hover */}
                {!isRenaming && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(filename);
                      }}
                      className="rounded p-0.5 text-white/30 hover:text-cyan-300 transition-colors"
                      aria-label={`Rename ${filename}`}
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(filename);
                      }}
                      className="rounded p-0.5 text-white/30 hover:text-red-400 transition-colors"
                      aria-label={`Delete ${filename}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Delete confirmation */}
              {isDeleting && (
                <div className="mx-3 mb-1 rounded-lg border border-red-400/20 bg-red-400/[0.05] p-2">
                  <p className="text-[10px] text-white/50 mb-1.5">
                    Delete <span className="text-red-300">{filename}</span>?
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDeleting(null)}
                      className="flex-1 rounded border border-white/[0.06] px-2 py-1 text-[10px] text-white/40 hover:text-white/60 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(filename)}
                      className="flex-1 rounded border border-red-400/20 bg-red-400/[0.08] px-2 py-1 text-[10px] text-red-300 hover:bg-red-400/[0.15] transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
