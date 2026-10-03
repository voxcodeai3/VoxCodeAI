import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CourseContext = createContext(null);

export function useCourse() {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error('useCourse must be used inside <CourseProvider>');
  return ctx;
}

export function CourseProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [learningPaths, setLearningPaths] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLearningPaths([]);
      setRecommendations([]);
      setDashboard(null);
      return;
    }
  }, [isAuthenticated]);

  const fetchLearningPaths = useCallback(async () => {
    try {
      const { data } = await api.get('/learning-paths');
      setLearningPaths(data);
      return data;
    } catch (err) {
      return [];
    }
  }, []);

  const fetchLearningPath = useCallback(async (pathId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/learning-paths/${pathId}`);
      return data;
    } catch (err) {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      const { data } = await api.get('/recommendations');
      setRecommendations(data.recommendations || []);
      return data.recommendations || [];
    } catch (err) {
      return [];
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data } = await api.get('/learning-dashboard/dashboard');
      setDashboard(data);
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const saveOnboarding = useCallback(async (payload) => {
    try {
      const { data } = await api.post('/learning-dashboard/onboarding', payload);
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const setActivePath = useCallback(async (pathId) => {
    try {
      const { data } = await api.post('/learning-dashboard/active-path', { pathId });
      if (data.success) {
        setDashboard((prev) => prev ? { ...prev, activePath: pathId } : prev);
      }
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const value = useMemo(() => ({
    learningPaths, recommendations, dashboard, loading,
    fetchLearningPaths, fetchLearningPath,
    fetchRecommendations, fetchDashboard, saveOnboarding, setActivePath,
  }), [
    learningPaths, recommendations, dashboard, loading,
    fetchLearningPaths, fetchLearningPath,
    fetchRecommendations, fetchDashboard, saveOnboarding, setActivePath,
  ]);

  return (
    <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
  );
}
