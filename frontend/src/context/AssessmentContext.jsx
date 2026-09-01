import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import api from '../services/api';

const AssessmentContext = createContext(null);

export function useAssessment() {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment must be used inside <AssessmentProvider>');
  return ctx;
}

export function AssessmentProvider({ children }) {
  const [assessments, setAssessments] = useState([]);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [weakSkills, setWeakSkills] = useState({ weak: [], strong: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAssessments = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.skill) params.set('skill', filters.skill);
      const { data } = await api.get(`/assessments?${params.toString()}`);
      setAssessments(data);
      return data;
    } catch (err) {
      setError('Failed to load assessments');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssessment = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/assessments/${id}`);
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const startAttempt = useCallback(async (assessmentId) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/assessments/${assessmentId}/start`);
      setCurrentAttempt(data.attempt);
      setCurrentQuestion(data.next?.question || null);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start assessment');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAttempt = useCallback(async (attemptId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/assessments/attempts/${attemptId}`);
      setCurrentAttempt(data.attempt);
      setCurrentQuestion(data.next?.question || null);
      return data;
    } catch (err) {
      setError('Failed to load attempt');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitAnswer = useCallback(async (attemptId, payload) => {
    try {
      const { data } = await api.post(`/assessments/attempts/${attemptId}/answer`, payload);
      if (data.next) {
        setCurrentQuestion(data.next.question || data.next);
      } else {
        setCurrentQuestion(null);
      }
      if (data.isComplete || !data.next) {
        const resultData = await api.get(`/assessments/attempts/${attemptId}/result`);
        setLastResult(resultData.data);
      }
      return data;
    } catch (err) {
      setError('Failed to submit answer');
      return null;
    }
  }, []);

  const completeAttempt = useCallback(async (attemptId) => {
    try {
      const { data } = await api.post(`/assessments/attempts/${attemptId}/complete`);
      const resultData = await api.get(`/assessments/attempts/${attemptId}/result`);
      setLastResult(resultData.data);
      setCurrentAttempt(null);
      setCurrentQuestion(null);
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const getResult = useCallback(async (attemptId) => {
    try {
      const { data } = await api.get(`/assessments/attempts/${attemptId}/result`);
      setLastResult(data);
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const fetchWeakSkills = useCallback(async () => {
    try {
      const { data } = await api.get('/assessments/weak-skills');
      setWeakSkills(data);
      return data;
    } catch (err) {
      return { weak: [], strong: [] };
    }
  }, []);

  const startPlacement = useCallback(async (skill) => {
    setLoading(true);
    try {
      const { data: assessment } = await api.get(`/assessments/placement/${skill}`);
      const { data } = await api.post(`/assessments/${assessment._id}/start`);
      setCurrentAttempt(data.attempt);
      setCurrentQuestion(data.next?.question || null);
      return data;
    } catch (err) {
      setError('No placement assessment available');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startReview = useCallback(async (skills) => {
    setLoading(true);
    try {
      const { data: assessment } = await api.post('/assessments/review', { skills });
      if (!assessment) return null;
      const { data } = await api.post(`/assessments/${assessment._id}/start`);
      setCurrentAttempt(data.attempt);
      setCurrentQuestion(data.next?.question || null);
      return data;
    } catch (err) {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAttempt = useCallback(() => {
    setCurrentAttempt(null);
    setCurrentQuestion(null);
  }, []);

  const value = useMemo(() => ({
    assessments, currentAttempt, currentQuestion, lastResult,
    weakSkills, loading, error,
    fetchAssessments, fetchAssessment, startAttempt, fetchAttempt,
    submitAnswer, completeAttempt, getResult, fetchWeakSkills,
    startPlacement, startReview, clearAttempt,
  }), [
    assessments, currentAttempt, currentQuestion, lastResult,
    weakSkills, loading, error,
    fetchAssessments, fetchAssessment, startAttempt, fetchAttempt,
    submitAnswer, completeAttempt, getResult, fetchWeakSkills,
    startPlacement, startReview, clearAttempt,
  ]);

  return (
    <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>
  );
}
