import { useState, useEffect } from 'react';
import {
  History, X, RotateCcw, GitCompare, Clock, Tag,
  Sparkles, AlertTriangle, CheckCircle, Loader2, Search,
} from 'lucide-react';
import { useVersions } from '../../context/VersionContext';
import { useProject } from '../../context/ProjectContext';

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

const SOURCE_LABELS = {
  manual: 'Manual',
  ai_change: 'AI Change',
  checkpoint: 'Checkpoint',
  restore: 'Restored',
  challenge: 'Challenge',
  autosave: 'Autosave',
};

const SOURCE_ICONS = {
  manual: Tag,
  ai_change: Sparkles,
  checkpoint: CheckCircle,
  restore: RotateCcw,
  challenge: AlertTriangle,
  autosave: Clock,
};

export default function VersionHistoryPanel({ isOpen, onClose, projectId, onRestore }) {
  const { versions, loading, fetchVersions, createVersion, compareVersions, restoreVersion, comparing, clearComparing, selectedVersion, setSelectedVersion } = useVersions();
  const { currentProject } = useProject();
  const [checkpointMsg, setCheckpointMsg] = useState('');
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [search, setSearch] = useState('');
  const [compareFrom, setCompareFrom] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(null);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchVersions(projectId);
    }
  }, [isOpen, projectId, fetchVersions]);

  const filtered = versions.filter((v) =>
    !search.trim() || v.message.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateCheckpoint = async () => {
    if (!projectId || creating) return;
    setCreating(true);
    try {
      await createVersion(projectId, checkpointMsg.trim() || 'Manual checkpoint');
      setCheckpointMsg('');
      setShowCheckpoint(false);
    } catch {
      // handled in context
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (version) => {
    if (!projectId || restoring) return;
    setRestoring(true);
    try {
      const project = await restoreVersion(projectId, version._id);
      if (onRestore && project) onRestore(project);
      setShowRestoreConfirm(null);
      setSelectedVersion(null);
    } catch {
      // handled in context
    } finally {
      setRestoring(false);
    }
  };

  const handleCompareSelect = (version) => {
    if (!compareFrom) {
      setCompareFrom(version);
    } else {
      compareVersions(projectId, compareFrom._id, version._id);
      setCompareFrom(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[95vw] max-w-[900px] h-[85vh] rounded-3xl border border-cyan-400/15 bg-[#060c18]/95 backdrop-blur-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-400/10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full border border-cyan-400/20 bg-cyan-400/10 flex items-center justify-center">
              <History className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">VERSION HISTORY</p>
              <p className="text-[10px] text-cyan-400/40">
                {versions.length} version{versions.length !== 1 ? 's' : ''}
                {currentProject && ` · v${currentProject.version || 1}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {compareFrom && (
              <span className="text-[10px] text-amber-400/60 flex items-center gap-1">
                <GitCompare className="h-3 w-3" /> Comparing from v{compareFrom.versionNumber}
                <button onClick={() => setCompareFrom(null)} className="ml-1 text-white/30 hover:text-white/60">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowCheckpoint(true)}
              className="rounded-lg px-2.5 py-1.5 text-[10px] text-cyan-400/60 hover:text-cyan-300 hover:bg-white/[0.05] transition-colors border border-cyan-400/15"
            >
              + Checkpoint
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-cyan-400/40 hover:text-cyan-300 hover:bg-white/[0.05] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-white/20" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search versions..."
              className="flex-1 bg-transparent text-xs text-white/70 placeholder-white/20 outline-none"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version list */}
          <div className="w-[280px] shrink-0 border-r border-white/[0.04] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-20 text-white/20 text-xs gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20 text-center space-y-2">
                <History className="h-6 w-6 text-white/10" />
                <p className="text-[11px] text-white/30">
                  {search ? 'No versions match.' : 'No versions yet. Create a checkpoint to start tracking.'}
                </p>
              </div>
            ) : (
              filtered.map((version) => {
                const SourceIcon = SOURCE_ICONS[version.source] || Tag;
                const isSelected = selectedVersion?._id === version._id;
                const isCompareFrom = compareFrom?._id === version._id;
                return (
                  <div
                    key={version._id}
                    className={`px-4 py-3 border-b border-white/[0.03] cursor-pointer transition-all ${
                      isSelected ? 'bg-cyan-400/[0.06] border-l-2 border-l-cyan-400/40' :
                      isCompareFrom ? 'bg-amber-400/[0.04] border-l-2 border-l-amber-400/40' :
                      'hover:bg-white/[0.02]'
                    }`}
                    onClick={() => setSelectedVersion(isSelected ? null : version)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-cyan-300/60">v{version.versionNumber}</span>
                      <SourceIcon className="h-2.5 w-2.5 text-white/20" />
                    </div>
                    <p className="text-[11px] text-white/60 mt-1 line-clamp-2">{version.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-white/20">{timeAgo(version.createdAt)}</span>
                      <span className="text-[9px] text-white/10 capitalize">{SOURCE_LABELS[version.source] || version.source}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail / Compare panel */}
          <div className="flex-1 overflow-y-auto p-4">
            {comparing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white/70">
                    Comparing v{comparing.from.versionNumber} → v{comparing.to.versionNumber}
                  </h3>
                  <button
                    type="button"
                    onClick={clearComparing}
                    className="text-[10px] text-white/30 hover:text-white/60"
                  >
                    Close comparison
                  </button>
                </div>
                {comparing.files.length === 0 ? (
                  <p className="text-xs text-white/30">No differences found.</p>
                ) : (
                  comparing.files.map((file) => (
                    <div key={file.path} className="rounded-xl border border-white/[0.06] overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/[0.04]">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          file.status === 'added' ? 'bg-emerald-400/10 text-emerald-400/60' :
                          file.status === 'deleted' ? 'bg-red-400/10 text-red-400/60' :
                          'bg-amber-400/10 text-amber-400/60'
                        }`}>
                          {file.status}
                        </span>
                        <span className="text-[11px] text-white/60 font-mono">{file.path}</span>
                      </div>
                      <div className="max-h-48 overflow-auto">
                        <pre className="p-3 text-[10px] text-white/50 whitespace-pre-wrap">
                          {file.status === 'added' ? file.after :
                           file.status === 'deleted' ? file.before :
                           `--- before\n${file.before}\n\n+++ after\n${file.after}`}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : selectedVersion ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-cyan-300/70">v{selectedVersion.versionNumber}</span>
                    <span className="text-[10px] text-white/20 capitalize">{SOURCE_LABELS[selectedVersion.source]}</span>
                  </div>
                  <p className="text-xs text-white/60 mt-2">{selectedVersion.message}</p>
                  <p className="text-[10px] text-white/20 mt-1">{timeAgo(selectedVersion.createdAt)}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCompareSelect(selectedVersion)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] transition-all ${
                      compareFrom?._id === selectedVersion._id
                        ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                    }`}
                  >
                    <GitCompare className="h-3 w-3" /> Compare
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRestoreConfirm(selectedVersion)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-white/40 hover:text-cyan-300 hover:bg-cyan-400/[0.06] transition-all"
                  >
                    <RotateCcw className="h-3 w-3" /> Restore
                  </button>
                </div>

                {selectedVersion.files && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Files ({selectedVersion.files.length})</p>
                    {selectedVersion.files.map((f) => (
                      <div key={f.path} className="text-[11px] text-white/40 font-mono px-2 py-1 rounded bg-white/[0.02]">
                        {f.path}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                <History className="h-8 w-8 text-white/10" />
                <p className="text-xs text-white/30">Select a version to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Checkpoint modal */}
        {showCheckpoint && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowCheckpoint(false)} />
            <div className="relative w-[90vw] max-w-sm rounded-2xl border border-cyan-400/15 bg-[#060c18]/95 backdrop-blur-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white/80">Save Checkpoint</h3>
              <input
                type="text"
                value={checkpointMsg}
                onChange={(e) => setCheckpointMsg(e.target.value)}
                placeholder="Describe this checkpoint (optional)"
                maxLength={200}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-white/70 placeholder-white/20 outline-none focus:border-cyan-400/30"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCheckpoint()}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckpoint(false)}
                  className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-white/40 hover:text-white/60 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCheckpoint}
                  disabled={creating}
                  className="flex-1 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.12] transition-all disabled:opacity-40"
                >
                  {creating ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restore confirmation */}
        {showRestoreConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowRestoreConfirm(null)} />
            <div className="relative w-[90vw] max-w-sm rounded-2xl border border-amber-400/15 bg-[#060c18]/95 backdrop-blur-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber-400/60" />
                <h3 className="text-sm font-semibold text-white/80">
                  Restore v{showRestoreConfirm.versionNumber}?
                </h3>
              </div>
              <p className="text-xs text-white/40">
                Your current project will be preserved as a new version before restoration. You can always undo this.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRestoreConfirm(null)}
                  className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-white/40 hover:text-white/60 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRestore(showRestoreConfirm)}
                  disabled={restoring}
                  className="flex-1 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-xs text-cyan-300 hover:bg-cyan-400/[0.12] transition-all disabled:opacity-40"
                >
                  {restoring ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
