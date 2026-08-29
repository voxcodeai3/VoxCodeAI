import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import api from '../services/api';

const VersionContext = createContext(null);

export function useVersions() {
  const ctx = useContext(VersionContext);
  if (!ctx) throw new Error('useVersions must be used inside <VersionProvider>');
  return ctx;
}

export function VersionProvider({ children }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(null); // { from, to, diffs }
  const [selectedVersion, setSelectedVersion] = useState(null);

  const fetchVersions = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/projects/${projectId}/versions`);
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createVersion = useCallback(async (projectId, message, source = 'manual') => {
    try {
      const { data } = await api.post(`/projects/${projectId}/versions`, { message, source });
      await fetchVersions(projectId);
      return data.version;
    } catch (err) {
      console.error('Failed to create version:', err.message);
      throw err;
    }
  }, [fetchVersions]);

  const getVersion = useCallback(async (projectId, versionId) => {
    try {
      const { data } = await api.get(`/projects/${projectId}/versions/${versionId}`);
      return data.version;
    } catch (err) {
      console.error('Failed to load version:', err.message);
      return null;
    }
  }, []);

  const compareVersions = useCallback(async (projectId, fromId, toId) => {
    try {
      const { data } = await api.get(`/projects/${projectId}/compare?from=${fromId}&to=${toId}`);
      setComparing(data);
      return data;
    } catch (err) {
      console.error('Failed to compare versions:', err.message);
      return null;
    }
  }, []);

  const restoreVersion = useCallback(async (projectId, versionId) => {
    try {
      const { data } = await api.post(`/projects/${projectId}/versions/${versionId}/restore`);
      await fetchVersions(projectId);
      return data.project;
    } catch (err) {
      console.error('Failed to restore version:', err.message);
      throw err;
    }
  }, [fetchVersions]);

  const createAICheckpoint = useCallback(async (projectId, message, aiAction) => {
    try {
      await api.post(`/projects/${projectId}/ai-checkpoint`, { message, aiAction });
      await fetchVersions(projectId);
    } catch (err) {
      console.error('Failed to create AI checkpoint:', err.message);
    }
  }, [fetchVersions]);

  const clearComparing = useCallback(() => setComparing(null), []);

  const value = useMemo(() => ({
    versions,
    loading,
    comparing,
    selectedVersion,
    fetchVersions,
    createVersion,
    getVersion,
    compareVersions,
    restoreVersion,
    createAICheckpoint,
    setSelectedVersion,
    clearComparing,
  }), [versions, loading, comparing, selectedVersion, fetchVersions, createVersion, getVersion, compareVersions, restoreVersion, createAICheckpoint, clearComparing]);

  return (
    <VersionContext.Provider value={value}>
      {children}
    </VersionContext.Provider>
  );
}
