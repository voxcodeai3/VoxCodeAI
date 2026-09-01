import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';

const ProjectContext = createContext(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
  return ctx;
}

const AUTOSAVE_DELAY = 1500;

function detectLang(filename) {
  if (!filename) return 'plaintext';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', java: 'java', cpp: 'cpp', c: 'c', css: 'css', html: 'html', json: 'json', md: 'markdown', sql: 'sql', xml: 'xml', sh: 'shell', yaml: 'yaml', yml: 'yaml', txt: 'plaintext' };
  return map[ext] || 'plaintext';
}

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [conflict, setConflict] = useState(null);

  const autosaveTimer = useRef(null);
  const currentProjectRef = useRef(null);
  currentProjectRef.current = currentProject;

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/projects');
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProject = useCallback(async (id) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/projects/${id}`);
      setCurrentProject(data.project);
      setSaveStatus('saved');
      setConflict(null);
      return data.project;
    } catch (err) {
      console.error('Failed to load project:', err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (payload) => {
    try {
      const { data } = await api.post('/projects', payload);
      await fetchProjects();
      return data.project;
    } catch (err) {
      console.error('Failed to create project:', err.message);
      throw err;
    }
  }, [fetchProjects]);

  const deleteProject = useCallback(async (id) => {
    try {
      await api.delete(`/projects/${id}`);
      if (currentProject?._id === id) {
        setCurrentProject(null);
      }
      await fetchProjects();
    } catch (err) {
      console.error('Failed to delete project:', err.message);
      throw err;
    }
  }, [currentProject, fetchProjects]);

  const duplicateProject = useCallback(async (id) => {
    try {
      const { data } = await api.post(`/projects/${id}/duplicate`);
      await fetchProjects();
      return data.project;
    } catch (err) {
      console.error('Failed to duplicate project:', err.message);
      throw err;
    }
  }, [fetchProjects]);

  const renameProject = useCallback(async (id, name) => {
    try {
      await api.patch(`/projects/${id}/rename`, { name });
      if (currentProject?._id === id) {
        setCurrentProject((prev) => prev ? { ...prev, name } : prev);
      }
      await fetchProjects();
    } catch (err) {
      console.error('Failed to rename project:', err.message);
      throw err;
    }
  }, [currentProject, fetchProjects]);

  const importFiles = useCallback(async (id, files) => {
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      const { data } = await api.post(`/projects/${id}/import`, formData);
      await fetchProject(id);
      return data;
    } catch (err) {
      console.error('Failed to import files:', err.message);
      throw err;
    }
  }, [fetchProject]);

  const exportProject = useCallback(async (id, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.excludeSecrets === false) params.set('excludeSecrets', 'false');
      if (options.excludeGenerated === false) params.set('excludeGenerated', 'false');
      if (options.folderPath) params.set('folderPath', options.folderPath);
      const qs = params.toString();
      const response = await api.get(`/projects/${id}/export${qs ? '?' + qs : ''}`, { responseType: 'blob' });
      const blob = response.data;
      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed.message || 'Export failed');
      }
      if (blob.size === 0) throw new Error('Empty file received');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject?.name || 'project'}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      if (err.message?.includes('Export failed') || err.message?.includes('Empty file')) throw err;
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          throw new Error(parsed.message || `Server error (${err.response.status})`);
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) throw new Error(`Server error (${err.response.status})`);
          throw parseErr;
        }
      }
      throw err;
    }
  }, [currentProject]);

  const saveProject = useCallback(async (updates) => {
    const proj = currentProjectRef.current;
    if (!proj) return;

    try {
      setSaveStatus('saving');
      const payload = { ...updates, version: proj.version };
      const { data } = await api.patch(`/projects/${proj._id}`, payload);
      setCurrentProject((prev) => prev ? {
        ...prev,
        ...updates,
        version: data.version,
        updatedAt: data.updatedAt,
      } : prev);
      setSaveStatus('saved');
    } catch (err) {
      if (err.response?.data?.code === 'PROJECT_CONFLICT') {
        setConflict({
          serverVersion: err.response.data.serverVersion,
          clientVersion: err.response.data.clientVersion,
        });
        setSaveStatus('conflict');
      } else {
        setSaveStatus('error');
        console.error('Failed to save project:', err.message);
      }
    }
  }, []);

  const requestAutosave = useCallback((updates) => {
    const proj = currentProjectRef.current;
    if (!proj) return;

    setCurrentProject((prev) => prev ? { ...prev, ...updates } : prev);
    setSaveStatus('unsaved');

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveProject(updates);
    }, AUTOSAVE_DELAY);
  }, [saveProject]);

  const updateFiles = useCallback((files, activeFile) => {
    requestAutosave({ files, activeFile: activeFile ?? currentProjectRef.current?.activeFile });
  }, [requestAutosave]);

  const addFile = useCallback((file) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    const files = [...(proj.files || []), { ...file, language: file.language || detectLang(file.name) }];
    requestAutosave({ files, activeFile: file.path });
  }, [requestAutosave]);

  const removeFile = useCallback((filePath) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    const files = (proj.files || []).filter((f) => f.path !== filePath);
    const activeFile = proj.activeFile === filePath ? (files[0]?.path || null) : proj.activeFile;
    requestAutosave({ files, activeFile });
  }, [requestAutosave]);

  const renameFile = useCallback((oldPath, newName) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    const files = (proj.files || []).map((f) => {
      if (f.path !== oldPath) return f;
      const dir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/') + 1) : '';
      const newPath = dir + newName;
      return { ...f, name: newName, path: newPath, language: detectLang(newName) };
    });
    const newFilePath = (() => {
      const file = proj.files?.find((f) => f.path === oldPath);
      if (!file) return oldPath;
      const dir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/') + 1) : '';
      return dir + newName;
    })();
    const activeFile = proj.activeFile === oldPath ? newFilePath : proj.activeFile;
    requestAutosave({ files, activeFile });
  }, [requestAutosave]);

  const updateFileContent = useCallback((filePath, content) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    const files = (proj.files || []).map((f) => f.path === filePath ? { ...f, content } : f);
    requestAutosave({ files });
  }, [requestAutosave]);

  const setActiveFile = useCallback((filePath) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    requestAutosave({ activeFile: filePath });
  }, [requestAutosave]);

  const resolveConflict = useCallback(async (choice) => {
    const proj = currentProjectRef.current;
    if (!proj || !conflict) return;

    if (choice === 'load_latest') {
      const fresh = await fetchProject(proj._id);
      if (fresh) setConflict(null);
    } else if (choice === 'keep_mine') {
      await saveProject({ files: proj.files, activeFile: proj.activeFile });
      setConflict(null);
    }
  }, [conflict, fetchProject, saveProject]);

  const closeProject = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setCurrentProject(null);
    setSaveStatus('saved');
    setConflict(null);
  }, []);

  const createFolder = useCallback(async (name, parentPath) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    try {
      const { data } = await api.post(`/projects/${proj._id}/folders`, { name, parentPath });
      await fetchProject(proj._id);
      return data;
    } catch (err) {
      throw err;
    }
  }, [fetchProject]);

  const createFileInProject = useCallback(async (name, parentPath, content) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    try {
      const { data } = await api.post(`/projects/${proj._id}/files`, { name, parentPath, content });
      await fetchProject(proj._id);
      return data;
    } catch (err) {
      throw err;
    }
  }, [fetchProject]);

  const renameFileFolder = useCallback(async (filePath, newName) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    try {
      const encoded = encodeURIComponent(filePath);
      const { data } = await api.patch(`/projects/${proj._id}/rename/${encoded}`, { newName });
      await fetchProject(proj._id);
      return data;
    } catch (err) {
      throw err;
    }
  }, [fetchProject]);

  const deleteFileFolder = useCallback(async (filePath) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    try {
      const encoded = encodeURIComponent(filePath);
      const { data } = await api.delete(`/projects/${proj._id}/delete/${encoded}`);
      await fetchProject(proj._id);
      return data;
    } catch (err) {
      throw err;
    }
  }, [fetchProject]);

  const moveFileFolder = useCallback(async (filePath, destinationPath, overwrite = false) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    try {
      const encoded = encodeURIComponent(filePath);
      const { data } = await api.patch(`/projects/${proj._id}/move/${encoded}`, { destinationPath, overwrite });
      await fetchProject(proj._id);
      return data;
    } catch (err) {
      throw err;
    }
  }, [fetchProject]);

  const getImportPreview = useCallback(async (files) => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      const { data } = await api.post(`/projects/${proj._id}/import/preview`, formData);
      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const value = useMemo(() => ({
    projects,
    currentProject,
    loading,
    saveStatus,
    conflict,
    fetchProjects,
    fetchProject,
    createProject,
    deleteProject,
    duplicateProject,
    renameProject,
    importFiles,
    exportProject,
    updateFiles,
    addFile,
    removeFile,
    renameFile,
    updateFileContent,
    setActiveFile,
    resolveConflict,
    closeProject,
    createFolder,
    createFileInProject,
    renameFileFolder,
    deleteFileFolder,
    moveFileFolder,
    getImportPreview,
  }), [projects, currentProject, loading, saveStatus, conflict, fetchProjects, fetchProject, createProject, deleteProject, duplicateProject, renameProject, importFiles, exportProject, updateFiles, addFile, removeFile, renameFile, updateFileContent, setActiveFile, resolveConflict, closeProject, createFolder, createFileInProject, renameFileFolder, deleteFileFolder, moveFileFolder, getImportPreview]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
