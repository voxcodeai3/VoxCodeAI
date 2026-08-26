import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const CodingWorkspaceContext = createContext(null);

export function useCodingWorkspace() {
  const ctx = useContext(CodingWorkspaceContext);
  if (!ctx) throw new Error('useCodingWorkspace must be used inside <CodingWorkspaceProvider>');
  return ctx;
}

const STORAGE_KEY = 'voxcode_workspace';

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

const DEFAULT_FILES = {
  'main.js': {
    content: '// Welcome to VoxCode Coding Workspace\n// Create files and start coding!\n\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet("World"));\n',
    language: 'javascript',
  },
};

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.files && typeof parsed.files === 'object') return parsed;
    }
  } catch { /* corrupted — start fresh */ }
  return null;
}

function persistState(files, activeFile, openFiles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, activeFile, openFiles }));
  } catch { /* storage full — non-fatal */ }
}

export function CodingWorkspaceProvider({ children }) {
  const persisted = useRef(loadPersistedState());

  const [files, setFiles] = useState(() => persisted.current?.files || DEFAULT_FILES);
  const [activeFile, setActiveFile] = useState(() => {
    const p = persisted.current;
    if (p?.activeFile && p.files?.[p.activeFile]) return p.activeFile;
    return Object.keys(persisted.current?.files || DEFAULT_FILES)[0] || 'main.js';
  });
  const [openFiles, setOpenFiles] = useState(() => {
    const p = persisted.current;
    if (p?.openFiles?.length) return p.openFiles.filter((f) => p.files?.[f]);
    return Object.keys(persisted.current?.files || DEFAULT_FILES);
  });

  // Persist on every change.
  useEffect(() => {
    persistState(files, activeFile, openFiles);
  }, [files, activeFile, openFiles]);

  const createFile = useCallback((filename, content = '') => {
    const trimmed = filename.trim();
    if (!trimmed || files[trimmed]) return false;
    const lang = detectLanguage(trimmed);
    setFiles((prev) => ({ ...prev, [trimmed]: { content, language: lang } }));
    setActiveFile(trimmed);
    setOpenFiles((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
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
      return remaining[0] || '';
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
    fileList: Object.keys(files),
  }), [files, activeFile, openFiles, createFile, deleteFile, renameFile, updateFileContent, openFile, closeFile, setActiveFile, renameActiveFile]);

  return (
    <CodingWorkspaceContext.Provider value={value}>
      {children}
    </CodingWorkspaceContext.Provider>
  );
}
