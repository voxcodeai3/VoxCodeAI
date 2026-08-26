import { X } from 'lucide-react';
import { useCodingWorkspace } from '../../context/CodingWorkspaceContext';

export default function FileTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile } = useCodingWorkspace();

  if (!openFiles.length) return null;

  return (
    <div className="flex overflow-x-auto border-b border-white/[0.04] bg-[#080d1a]">
      {openFiles.map((filename) => {
        const isActive = filename === activeFile;
        return (
          <div
            key={filename}
            className={`group flex items-center gap-1.5 border-r border-white/[0.04] px-3 py-2 text-[11px] cursor-pointer transition-colors shrink-0 ${
              isActive
                ? 'bg-[#0e1529] text-cyan-300 border-b-2 border-b-cyan-400/40'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
            }`}
            onClick={() => setActiveFile(filename)}
          >
            <span className="truncate max-w-[120px]">{filename}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(filename);
              }}
              className={`ml-1 rounded p-0.5 transition-colors ${
                isActive
                  ? 'text-cyan-400/40 hover:text-red-400'
                  : 'text-white/20 opacity-0 group-hover:opacity-100 hover:text-red-400'
              }`}
              aria-label={`Close ${filename}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
