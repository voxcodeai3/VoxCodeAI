import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { File, Folder, FolderOpen, Plus, Trash2, Edit3, Upload, Download, Loader2, ChevronRight, MoreHorizontal, FilePlus, FolderPlus, Search, RefreshCw, Move, Eye } from 'lucide-react';
import { useCodingWorkspace } from '../../context/CodingWorkspaceContext';
import { useProject } from '../../context/ProjectContext';

function buildTree(files) {
  const root = { name: '', path: '', children: {}, isFolder: true };
  for (const f of files) {
    const parts = f.path.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast && !f.isFolder) {
        current.children[part] = { ...f, children: undefined };
      } else {
        if (!current.children[part]) {
          current.children[part] = { name: part, path: parts.slice(0, i + 1).join('/'), children: {}, isFolder: true };
        }
        current = current.children[part];
      }
    }
  }
  return root;
}

function countItems(node) {
  let files = 0;
  let folders = 0;
  for (const child of Object.values(node.children || {})) {
    if (child.isFolder) {
      folders++;
      const sub = countItems(child);
      files += sub.files;
      folders += sub.folders;
    } else {
      files++;
    }
  }
  return { files, folders };
}

function searchTree(node, query) {
  const results = [];
  const q = query.toLowerCase();
  function walk(n, depth) {
    for (const child of Object.values(n.children || {})) {
      if (child.name.toLowerCase().includes(q)) {
        results.push({ ...child, depth });
      }
      if (child.isFolder) walk(child, depth + 1);
    }
  }
  if (node.name.toLowerCase().includes(q) || node.path === '') {
    results.push({ ...node, depth: 0 });
  }
  walk(node, 0);
  return results;
}

function TreeNode({ node, depth, activeFile, selectedFolder, onSelectFile, onSelectFolder, onContextMenu, searchQuery }) {
  const [expanded, setExpanded] = useState(searchQuery ? true : depth < 2);
  const isFolder = node.isFolder;
  const isActive = !isFolder && node.path === activeFile;
  const isSelected = isFolder && node.path === selectedFolder;

  useEffect(() => {
    if (searchQuery) setExpanded(true);
  }, [searchQuery]);

  if (isFolder) {
    const childEntries = Object.values(node.children || {}).sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div>
        <div
          className={`group flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors text-[11px] ${
            isSelected
              ? 'bg-cyan-400/[0.08] text-cyan-300'
              : 'text-white/50 hover:bg-white/[0.03] hover:text-white/70'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => { setExpanded(!expanded); onSelectFolder?.(node.path); }}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, node); }}
        >
          <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''} text-white/20`} />
          {expanded
            ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-cyan-400/50" />
            : <Folder className="h-3.5 w-3.5 shrink-0 text-cyan-400/40" />
          }
          <span className="truncate">{node.name}</span>
          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onContextMenu?.(e, node, 'folder-actions'); }}
              className="rounded p-0.5 text-white/20 hover:text-white/50"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </div>
        </div>
        {expanded && childEntries.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            selectedFolder={selectedFolder}
            onSelectFile={onSelectFile}
            onSelectFolder={onSelectFolder}
            onContextMenu={onContextMenu}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors text-[11px] ${
        isActive
          ? 'bg-cyan-400/[0.06] text-cyan-300'
          : 'text-white/50 hover:bg-white/[0.03] hover:text-white/70'
      }`}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
      onClick={() => onSelectFile?.(node.path)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, node); }}
    >
      <File className="h-3.5 w-3.5 shrink-0 opacity-40" />
      <span className="truncate flex-1">{node.name}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onContextMenu?.(e, node, 'file-actions'); }}
          className="rounded p-0.5 text-white/20 hover:text-white/50"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const adjustedY = Math.min(y, window.innerHeight - items.length * 32 - 20);

  return (
    <div
      ref={menuRef}
      className="fixed z-[80] min-w-[160px] bg-[#0c1020] border border-white/[0.08] rounded-xl shadow-2xl py-1"
      style={{ left: x, top: adjustedY }}
    >
      {items.map((item, i) => (
        item.separator ? (
          <div key={i} className="border-t border-white/[0.04] my-1" />
        ) : (
          <button
            key={i}
            onClick={() => { item.action(); onClose(); }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
              item.danger ? 'text-red-400/70 hover:bg-red-400/10' : 'text-white/60 hover:bg-white/[0.04]'
            }`}
          >
            {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" />}
            {item.label}
          </button>
        )
      ))}
    </div>
  );
}

function FolderPickerDialog({ tree, onSelect, onClose }) {
  const [selected, setSelected] = useState('');

  const renderOptions = (node, depth = 0) => {
    const entries = Object.values(node.children || {}).filter(c => c.isFolder).sort((a, b) => a.name.localeCompare(b.name));
    return entries.map(child => (
      <option key={child.path} value={child.path}>
        {'  '.repeat(depth)}{depth > 0 ? '└ ' : ''}{child.name}
      </option>
    ));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[90vw] max-w-[380px] rounded-2xl border border-cyan-400/15 bg-[#0a1020]/95 backdrop-blur-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Move className="h-4 w-4 text-cyan-300/70" />
          <p className="text-sm font-medium text-white/80">Move to...</p>
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 focus:border-cyan-400/30 focus:outline-none"
        >
          <option value="">/ (root)</option>
          {renderOptions(tree)}
        </select>
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
            onClick={() => onSelect(selected)}
            className="flex-1 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-colors"
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportPreviewDialog({ preview, onConfirm, onClose }) {
  if (!preview) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[90vw] max-w-[420px] rounded-2xl border border-cyan-400/15 bg-[#0a1020]/95 backdrop-blur-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyan-300/70" />
          <p className="text-sm font-medium text-white/80">Import Preview</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-lg font-semibold text-white/80">{preview.totalFiles}</p>
            <p className="text-[10px] text-white/30">Files</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-lg font-semibold text-white/80">{preview.totalFolders}</p>
            <p className="text-[10px] text-white/30">Folders</p>
          </div>
        </div>

        {preview.detectedTechs?.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 mb-1.5">Detected technologies:</p>
            <div className="flex flex-wrap gap-1">
              {preview.detectedTechs.map(tech => (
                <span key={tech} className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-2 py-0.5 text-[10px] text-cyan-300/70">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {preview.excluded?.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 mb-1.5">Excluded ({preview.excluded.length}):</p>
            <div className="max-h-24 overflow-y-auto rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-[10px] text-white/30 space-y-0.5">
              {preview.excluded.slice(0, 20).map((ex, i) => (
                <div key={i} className="flex justify-between">
                  <span className="truncate">{ex.path}</span>
                  <span className="text-amber-400/50 shrink-0 ml-2">{ex.reason}</span>
                </div>
              ))}
              {preview.excluded.length > 20 && <p>...and {preview.excluded.length - 20} more</p>}
            </div>
          </div>
        )}

        {preview.treePreview?.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 mb-1.5">Preview:</p>
            <pre className="max-h-40 overflow-y-auto rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-[10px] text-white/40 font-mono">
              {preview.treePreview.join('\n')}
              {preview.hasMore && '\n...'}
            </pre>
          </div>
        )}

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
            onClick={onConfirm}
            className="flex-1 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-colors"
          >
            Import Project
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FileExplorer({ onNewFile }) {
  const { files, activeFile, openFile, fileList } = useCodingWorkspace();
  const {
    currentProject, importFiles, exportProject,
    createFolder, createFileInProject, renameFileFolder, deleteFileFolder, moveFileFolder,
    getImportPreview, fetchProject,
  } = useProject();
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [dialogState, setDialogState] = useState(null);
  const [importing, setImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importPreviewFiles, setImportPreviewFiles] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({ excludeSecrets: true, excludeGenerated: true, scope: 'project' });
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const searchInputRef = useRef(null);

  const showStatus = (msg, type = 'success') => {
    setStatusMsg({ msg, type });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const tree = useMemo(() => buildTree(Object.values(files).map((data, i) => ({
    ...data,
    path: Object.keys(files)[i],
    name: Object.keys(files)[i].split('/').pop(),
    isFolder: data.isFolder || false,
  }))), [files]);

  const folderCount = useMemo(() => {
    let count = 0;
    Object.values(files).forEach(f => { if (f.isFolder) count++; });
    return count;
  }, [files]);

  const handleSelectFile = useCallback((path) => {
    openFile(path);
    setSelectedFolder(null);
  }, [openFile]);

  const handleSelectFolder = useCallback((path) => {
    setSelectedFolder(path);
  }, []);

  const handleContextMenu = useCallback((e, node, forceType) => {
    const type = forceType || (node.isFolder ? 'folder' : 'file');
    const items = [];

    if (type === 'folder' || type === 'folder-actions') {
      items.push(
        { label: 'New File', icon: FilePlus, action: () => setDialogState({ type: 'create-file', parentPath: node.path }) },
        { label: 'New Folder', icon: FolderPlus, action: () => setDialogState({ type: 'create-folder', parentPath: node.path }) },
        { separator: true },
        { label: 'Export Folder', icon: Download, action: () => { setSelectedFolder(node.path); setExportOptions(prev => ({ ...prev, scope: 'folder' })); setExportDialogOpen(true); } },
        { label: 'Move to...', icon: Move, action: () => setDialogState({ type: 'move', path: node.path, name: node.name }) },
        { label: 'Rename', icon: Edit3, action: () => setDialogState({ type: 'rename', path: node.path, name: node.name }) },
        { label: 'Delete', icon: Trash2, danger: true, action: () => {
          const counts = countItems(node);
          setDialogState({ type: 'delete', path: node.path, name: node.name, isFolder: true, fileCount: counts.files, folderCount: counts.folders });
        }},
      );
    } else {
      items.push(
        { label: 'Open', icon: File, action: () => openFile(node.path) },
        { separator: true },
        { label: 'Move to...', icon: Move, action: () => setDialogState({ type: 'move', path: node.path, name: node.name }) },
        { label: 'Rename', icon: Edit3, action: () => setDialogState({ type: 'rename', path: node.path, name: node.name }) },
        { label: 'Delete', icon: Trash2, danger: true, action: () => setDialogState({ type: 'delete', path: node.path, name: node.name, isFolder: false }) },
      );
    }

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [openFile]);

  const handleImportFolder = async (e) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0 || !currentProject) return;
    setImporting(true);
    try {
      const result = await importFiles(currentProject._id, Array.from(filesList));
      showStatus(result?.message || `Imported ${filesList.length} file(s)`);
    } catch (err) {
      showStatus(err.response?.data?.message || err.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreviewFiles || !currentProject) return;
    setImporting(true);
    try {
      const result = await importFiles(currentProject._id, importPreviewFiles);
      showStatus(result?.message || 'Import complete');
    } catch (err) {
      showStatus(err.response?.data?.message || err.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
      setImportPreview(null);
      setImportPreviewFiles(null);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleExport = async (options = {}) => {
    if (!currentProject) return;
    setExporting(true);
    try {
      await exportProject(currentProject._id, options);
      showStatus('Download started');
    } catch (err) {
      showStatus(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
      setExportDialogOpen(false);
    }
  };

  const handleDialogSubmit = async () => {
    if (!dialogState || !currentProject) return;
    try {
      switch (dialogState.type) {
        case 'create-folder':
          await createFolder(dialogState.inputValue, dialogState.parentPath);
          showStatus('Folder created');
          break;
        case 'create-file':
          await createFileInProject(dialogState.inputValue, dialogState.parentPath);
          showStatus('File created');
          break;
        case 'rename':
          await renameFileFolder(dialogState.path, dialogState.inputValue);
          showStatus('Renamed');
          break;
        case 'delete':
          await deleteFileFolder(dialogState.path);
          showStatus('Deleted');
          break;
        case 'move':
          await moveFileFolder(dialogState.path, dialogState.moveTarget || '', dialogState.overwrite || false);
          showStatus('Moved');
          break;
      }
    } catch (err) {
      showStatus(err.response?.data?.message || err.message || 'Operation failed', 'error');
    }
    setDialogState(null);
  };

  const handleRefresh = async () => {
    if (!currentProject) return;
    try {
      await fetchProject(currentProject._id);
      showStatus('Refreshed');
    } catch {
      showStatus('Refresh failed', 'error');
    }
  };

  const rootEntries = Object.values(tree.children || {}).sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchTree(tree, searchQuery.trim()).filter(r => r.path !== '');
  }, [tree, searchQuery]);

  const hasProject = !!currentProject;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5 text-cyan-400/50" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            Files
          </span>
          {hasProject && (
            <span className="text-[9px] text-white/20">
              {fileList.length - folderCount} file{(fileList.length - folderCount) !== 1 ? 's' : ''}
              {folderCount > 0 && `, ${folderCount} folder${folderCount !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50); }}
            disabled={!hasProject}
            className="rounded p-1 text-white/30 hover:text-cyan-300 transition-colors disabled:opacity-30"
            title="Search files"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!hasProject}
            className="rounded p-1 text-white/30 hover:text-cyan-300 transition-colors disabled:opacity-30"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleImportFolder} onClick={(e) => { e.target.value = ''; }} />
          <input ref={folderInputRef} type="file" webkitdirectory="" multiple className="hidden" onChange={handleImportFolder} onClick={(e) => { e.target.value = ''; }} />
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={!hasProject || importing}
            className="rounded p-1 text-white/30 hover:text-emerald-300 transition-colors disabled:opacity-30"
            title={!hasProject ? 'Select a project first' : importing ? 'Importing...' : 'Import folder'}
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setExportDialogOpen(true)}
            disabled={!hasProject || exporting}
            className="rounded p-1 text-white/30 hover:text-amber-300 transition-colors disabled:opacity-30"
            title={!hasProject ? 'Select a project first' : exporting ? 'Exporting...' : 'Export project'}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </button>
          <div className="relative group">
            <button
              type="button"
              disabled={!hasProject}
              className="rounded p-1 text-white/30 hover:text-cyan-300 transition-colors disabled:opacity-30"
              title="Create new"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50">
              <div className="bg-[#0c1020] border border-white/[0.08] rounded-xl shadow-2xl py-1 min-w-[130px]">
                <button
                  onClick={() => setDialogState({ type: 'create-file', parentPath: selectedFolder || '' })}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.04]"
                >
                  <FilePlus className="h-3.5 w-3.5" /> New File
                </button>
                <button
                  onClick={() => setDialogState({ type: 'create-folder', parentPath: selectedFolder || '' })}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.04]"
                >
                  <FolderPlus className="h-3.5 w-3.5" /> New Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04]">
          <Search className="h-3 w-3 text-white/20 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-[11px] text-white/60 placeholder-white/20 outline-none"
          />
          {searchQuery && (
            <span className="text-[9px] text-white/20">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
          )}
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
            className="text-white/20 hover:text-white/40"
          >
            <span className="text-[9px]">ESC</span>
          </button>
        </div>
      )}

      {/* Status message */}
      {statusMsg && (
        <div className={`mx-2 mb-1 rounded-lg px-2.5 py-1.5 text-[10px] ${
          statusMsg.type === 'error'
            ? 'bg-red-400/[0.08] text-red-300 border border-red-400/20'
            : 'bg-emerald-400/[0.08] text-emerald-300 border border-emerald-400/20'
        }`}>
          {statusMsg.msg}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {!hasProject ? (
          <p className="px-3 py-4 text-[10px] text-white/20 text-center">Select a project</p>
        ) : searchQuery.trim() ? (
          searchResults.length === 0 ? (
            <p className="px-3 py-4 text-[10px] text-white/20 text-center">No results</p>
          ) : (
            searchResults.map((node) => (
              <div
                key={node.path}
                className="flex items-center gap-2 px-2 py-1 cursor-pointer text-[11px] text-white/50 hover:bg-white/[0.03] hover:text-white/70"
                style={{ paddingLeft: `${(node.depth || 0) * 12 + 8}px` }}
                onClick={() => { handleSelectFile(node.path); setSearchQuery(''); setSearchOpen(false); }}
              >
                {node.isFolder ? <Folder className="h-3.5 w-3.5 shrink-0 text-cyan-400/40" /> : <File className="h-3.5 w-3.5 shrink-0 opacity-40" />}
                <span className="truncate">{node.path}</span>
              </div>
            ))
          )
        ) : rootEntries.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[10px] text-white/20 mb-2">No files yet</p>
            <button
              type="button"
              onClick={() => setDialogState({ type: 'create-file', parentPath: '' })}
              className="text-[10px] text-cyan-400/50 hover:text-cyan-400 transition-colors"
            >
              + Create File
            </button>
          </div>
        ) : rootEntries.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            selectedFolder={selectedFolder}
            onSelectFile={handleSelectFile}
            onSelectFolder={handleSelectFolder}
            onContextMenu={handleContextMenu}
            searchQuery={searchQuery}
          />
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Dialogs */}
      {dialogState && dialogState.type === 'move' && (
        <FolderPickerDialog
          tree={tree}
          onSelect={(target) => { setDialogState(prev => ({ ...prev, moveTarget: target })); }}
          onClose={() => setDialogState(null)}
        />
      )}

      {dialogState && dialogState.type === 'move' && dialogState.moveTarget !== undefined && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDialogState(null)} />
          <div className="relative w-[90vw] max-w-[380px] rounded-2xl border border-cyan-400/15 bg-[#0a1020]/95 backdrop-blur-2xl p-5 space-y-4">
            <p className="text-sm font-medium text-white/80">Move "{dialogState.name}"</p>
            <p className="text-xs text-white/40">
              Move to: <span className="text-cyan-300/60">/{dialogState.moveTarget || '(root)'}</span>
            </p>
            <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
              <input
                type="checkbox"
                checked={dialogState.overwrite || false}
                onChange={(e) => setDialogState(prev => ({ ...prev, overwrite: e.target.checked }))}
                className="rounded border-white/20 bg-white/[0.03] text-cyan-400 focus:ring-cyan-400/30"
              />
              Overwrite if file exists at destination
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDialogState(null)}
                className="flex-1 rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDialogSubmit}
                className="flex-1 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-colors"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogState && !['move'].includes(dialogState.type) && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDialogState(null)} />
          <div className="relative w-[90vw] max-w-[380px] rounded-2xl border border-cyan-400/15 bg-[#0a1020]/95 backdrop-blur-2xl p-5 space-y-4">
            <p className="text-sm font-medium text-white/80">
              {dialogState.type === 'create-folder' && 'Create Folder'}
              {dialogState.type === 'create-file' && 'Create File'}
              {dialogState.type === 'rename' && `Rename ${dialogState.isFolder ? 'Folder' : 'File'}`}
              {dialogState.type === 'delete' && `Delete ${dialogState.isFolder ? 'Folder' : 'File'}`}
            </p>
            {dialogState.type === 'delete' ? (
              <p className="text-xs text-white/40">
                Are you sure you want to delete <span className="text-red-300">{dialogState.name}</span>?
                {dialogState.isFolder && dialogState.fileCount > 0 && (
                  <span className="block mt-1">
                    Contains <span className="text-white/60">{dialogState.fileCount} file{dialogState.fileCount !== 1 ? 's' : ''}</span>
                    {dialogState.folderCount > 0 && <> and <span className="text-white/60">{dialogState.folderCount} folder{dialogState.folderCount !== 1 ? 's' : ''}</span></>}
                  </span>
                )}
                {dialogState.isFolder && ' This will delete all contents inside.'}
              </p>
            ) : (
              <input
                type="text"
                value={dialogState.inputValue || dialogState.name || ''}
                onChange={(e) => setDialogState((prev) => ({ ...prev, inputValue: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit(); }}
                placeholder={dialogState.type === 'rename' ? 'New name' : 'Name'}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 focus:border-cyan-400/30 focus:outline-none"
                autoFocus
              />
            )}
            {dialogState.parentPath !== undefined && dialogState.type !== 'rename' && dialogState.type !== 'delete' && (
              <p className="text-[10px] text-white/25">
                Location: /{dialogState.parentPath || 'root'}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDialogState(null)}
                className="flex-1 rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDialogSubmit}
                className={`flex-1 rounded-lg px-3 py-2 text-xs transition-colors ${
                  dialogState.type === 'delete'
                    ? 'border border-red-400/20 bg-red-400/10 text-red-300 hover:bg-red-400/20'
                    : 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20'
                }`}
              >
                {dialogState.type === 'delete' ? 'Delete' : dialogState.type === 'rename' ? 'Rename' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export dialog */}
      {exportDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setExportDialogOpen(false)} />
          <div className="relative w-[90vw] max-w-[380px] rounded-2xl border border-cyan-400/15 bg-[#0a1020]/95 backdrop-blur-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-cyan-300/70" />
              <p className="text-sm font-medium text-white/80">Export Project</p>
            </div>
            <p className="text-xs text-white/40">
              {exportOptions.scope === 'folder' && selectedFolder
                ? `Export folder "${selectedFolder}" as ZIP.`
                : `Export "${currentProject?.name}" as ZIP archive.`}
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                <input type="radio" name="exportScope" checked={exportOptions.scope !== 'folder'} onChange={() => setExportOptions(prev => ({ ...prev, scope: 'project' }))} className="text-cyan-400 focus:ring-cyan-400/30" />
                Entire project ({fileList.filter(f=>!files[f]?.isFolder).length} files)
              </label>
              {selectedFolder && (
                <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                  <input type="radio" name="exportScope" checked={exportOptions.scope === 'folder'} onChange={() => setExportOptions(prev => ({ ...prev, scope: 'folder' }))} className="text-cyan-400 focus:ring-cyan-400/30" />
                  Current folder: /{selectedFolder}
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportDialogOpen(false)}
                className="flex-1 rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExport({ ...exportOptions, folderPath: exportOptions.scope === 'folder' ? selectedFolder : undefined })}
                disabled={exporting}
                className="flex-1 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-colors disabled:opacity-30 flex items-center justify-center gap-1.5"
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Export ZIP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import preview dialog */}
      {importPreview && (
        <ImportPreviewDialog
          preview={importPreview}
          onConfirm={handleConfirmImport}
          onClose={() => { setImportPreview(null); setImportPreviewFiles(null); }}
        />
      )}
    </div>
  );
}
