import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const CodingWorkspaceContext = createContext(null);

export function useCodingWorkspace() {
  const ctx = useContext(CodingWorkspaceContext);
  if (!ctx) throw new Error('useCodingWorkspace must be used inside <CodingWorkspaceProvider>');
  return ctx;
}

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', java: 'java', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
  css: 'css', scss: 'scss', html: 'html', htm: 'html',
  json: 'json', md: 'markdown', sql: 'sql', xml: 'xml',
  sh: 'shell', yaml: 'yaml', yml: 'yaml', txt: 'plaintext',
};

export function detectLanguage(filename) {
  if (!filename) return 'plaintext';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'plaintext';
}

export function CodingWorkspaceProvider({ children }) {
  const [files, setFiles] = useState({});
  const [activeFile, setActiveFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const activeProjectIdRef = useRef(null);

  const createFile = useCallback((filename, content = '', parentPath) => {
    const trimmed = filename.trim();
    if (!trimmed) return false;
    const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
    if (files[fullPath]) return false;
    const lang = detectLanguage(trimmed);
    setFiles((prev) => ({ ...prev, [fullPath]: { content, language: lang, isFolder: false } }));
    setActiveFile(fullPath);
    setOpenFiles((prev) => (prev.includes(fullPath) ? prev : [...prev, fullPath]));
    return true;
  }, [files]);

  const deleteFile = useCallback((filename) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
    setOpenFiles((prev) => prev.filter((f) => f !== filename));
    setActiveFile((prev) => {
      if (prev !== filename) return prev;
      const remaining = Object.keys(files).filter((f) => f !== filename);
      return remaining[0] || null;
    });
  }, [files]);

  const renameFile = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || files[trimmed]) return false;
    setFiles((prev) => {
      const next = { ...prev };
      next[trimmed] = { ...next[oldName], language: detectLanguage(trimmed) };
      delete next[oldName];
      return next;
    });
    setOpenFiles((prev) => prev.map((f) => (f === oldName ? trimmed : f)));
    setActiveFile((prev) => (prev === oldName ? trimmed : prev));
    return true;
  }, [files]);

  const updateFileContent = useCallback((filename, content) => {
    setFiles((prev) => {
      if (!prev[filename]) return prev;
      return { ...prev, [filename]: { ...prev[filename], content } };
    });
  }, []);

  const openFile = useCallback((filename) => {
    if (!files[filename]) return;
    setActiveFile(filename);
    setOpenFiles((prev) => (prev.includes(filename) ? prev : [...prev, filename]));
  }, [files]);

  const closeFile = useCallback((filename) => {
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f !== filename);
      if (activeFile === filename && next.length) {
        setActiveFile(next[next.length - 1]);
      }
      return next;
    });
  }, [activeFile]);

  const renameActiveFile = useCallback((newName) => {
    if (activeFile) renameFile(activeFile, newName);
  }, [activeFile, renameFile]);

  // Load files from a project. This is the ONLY way files enter the workspace.
  const loadProjectFiles = useCallback((projectId, projectFiles, projectActiveFile) => {
    activeProjectIdRef.current = projectId;
    const newFiles = {};
    for (const f of projectFiles || []) {
      newFiles[f.path] = {
        content: f.content || '',
        language: f.language || detectLanguage(f.name || f.path),
        isFolder: f.isFolder || false,
      };
    }
    setFiles(newFiles);
    const fileKeys = Object.keys(newFiles).filter(k => !newFiles[k].isFolder);
    const firstFile = (projectActiveFile && newFiles[projectActiveFile] && !newFiles[projectActiveFile].isFolder)
      ? projectActiveFile
      : fileKeys[0] || null;
    setActiveFile(firstFile);
    setOpenFiles(firstFile ? [firstFile] : []);
  }, []);

  // Clear everything — used when no project is selected or on project switch
  const resetWorkspace = useCallback(() => {
    activeProjectIdRef.current = null;
    setFiles({});
    setActiveFile(null);
    setOpenFiles([]);
  }, []);

  const value = useMemo(() => ({
    files,
    activeFile,
    openFiles,
    activeFileData: files[activeFile] || null,
    createFile,
    deleteFile,
    renameFile,
    updateFileContent,
    openFile,
    closeFile,
    setActiveFile,
    renameActiveFile,
    loadProjectFiles,
    resetWorkspace,
    fileList: Object.keys(files),
  }), [files, activeFile, openFiles, createFile, deleteFile, renameFile, updateFileContent, openFile, closeFile, setActiveFile, renameActiveFile, loadProjectFiles, resetWorkspace]);

  return (
    <CodingWorkspaceContext.Provider value={value}>
      {children}
    </CodingWorkspaceContext.Provider>
  );
}
