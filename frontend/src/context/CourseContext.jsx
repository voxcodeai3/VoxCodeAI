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
  const [courses, setCourses] = useState([]);
  const [learningPaths, setLearningPaths] = useState([]);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [skills, setSkills] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setCourses([]);
      setLearningPaths([]);
      setCurrentCourse(null);
      setCurrentLesson(null);
      setProgress(null);
      setSkills(null);
      setRecommendations([]);
      setDashboard(null);
      setCalendar(null);
      return;
    }
  }, [isAuthenticated]);

  const fetchCourses = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.language) params.set('language', filters.language);
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.search) params.set('search', filters.search);
      const { data } = await api.get(`/courses?${params.toString()}`);
      setCourses(data);
      return data;
    } catch (err) {
      setError('Failed to load courses');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCourse = useCallback(async (courseId) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/courses/${courseId}`);
      setCurrentCourse(data);
      return data;
    } catch (err) {
      setError('Failed to load course');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLesson = useCallback(async (lessonId) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/courses/lesson/${lessonId}`);
      setCurrentLesson(data);
      return data;
    } catch (err) {
      setError('Failed to load lesson');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

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

  const fetchCourseProgress = useCallback(async (courseId) => {
    try {
      const { data } = await api.get(`/learning/progress?courseId=${courseId}`);
      setProgress(data);
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const updateLessonProgress = useCallback(async ({ lessonId, courseId, status, progress: prog, score }) => {
    try {
      const { data } = await api.post('/learning/progress', {
        lessonId,
        courseId,
        status,
        progress: prog,
        score,
      });
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const fetchSkills = useCallback(async () => {
    try {
      const { data } = await api.get('/learning/skills');
      setSkills(data);
      return data;
    } catch (err) {
      return null;
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

  const fetchCalendar = useCallback(async () => {
    try {
      const { data } = await api.get('/learning-dashboard/calendar');
      setCalendar(data);
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

  const clearLesson = useCallback(() => {
    setCurrentLesson(null);
  }, []);

  const clearCourse = useCallback(() => {
    setCurrentCourse(null);
    setCurrentLesson(null);
  }, []);

  const value = useMemo(() => ({
    courses, learningPaths, currentCourse, currentLesson,
    progress, skills, recommendations, dashboard, calendar,
    loading, error,
    fetchCourses, fetchCourse, fetchLesson,
    fetchLearningPaths, fetchLearningPath,
    fetchCourseProgress, updateLessonProgress,
    fetchSkills, fetchRecommendations,
    fetchDashboard, fetchCalendar, saveOnboarding, setActivePath,
    clearLesson, clearCourse,
  }), [
    courses, learningPaths, currentCourse, currentLesson,
    progress, skills, recommendations, dashboard, calendar,
    loading, error,
    fetchCourses, fetchCourse, fetchLesson,
    fetchLearningPaths, fetchLearningPath,
    fetchCourseProgress, updateLessonProgress,
    fetchSkills, fetchRecommendations,
    fetchDashboard, fetchCalendar, saveOnboarding, setActivePath,
    clearLesson, clearCourse,
  ]);

  return (
    <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
  );
}
