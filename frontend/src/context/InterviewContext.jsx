import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const InterviewContext = createContext(null);

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterview must be used inside <InterviewProvider>');
  return ctx;
}

const INTERVIEW_STATES = ['idle', 'starting', 'asking', 'listening', 'evaluating', 'follow_up', 'coding', 'completed', 'paused', 'error'];

export function InterviewProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [session, setSession] = useState(null);
  const [interviewState, setInterviewState] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Timer state.
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);
  const pausedTimeRef = useRef(0);
  const startTimeRef = useRef(null);

  // Check for active session on login.
  useEffect(() => {
    if (!isAuthenticated) {
      setSession(null);
      setInterviewState('idle');
      setTimeRemaining(null);
      return;
    }
    api.get('/interviews/active').then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setInterviewState(data.session.status === 'paused' ? 'paused' : 'idle');
        if (data.session.status === 'active') {
          startTimer(data.session);
        }
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  // Timer logic.
  const startTimer = useCallback((sess) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!sess?.durationMinutes) return;

    const totalMs = sess.durationMinutes * 60 * 1000;
    const pausedMs = sess.totalPausedMs || 0;
    const elapsed = Date.now() - new Date(sess.startedAt).getTime() - pausedMs;
    const remaining = Math.max(0, totalMs - elapsed);

    startTimeRef.current = Date.now();
    pausedTimeRef.current = pausedMs;

    if (remaining <= 0) {
      setTimeRemaining(0);
      return;
    }

    setTimeRemaining(remaining);
    timerRef.current = setInterval(() => {
      const currentPaused = pausedTimeRef.current;
      const nowPaused = sess.pausedAt ? Date.now() - new Date(sess.pausedAt).getTime() : 0;
      const totalPaused = currentPaused + nowPaused;
      const elapsedTotal = Date.now() - startTimeRef.current - totalPaused;
      const rem = Math.max(0, totalMs - elapsedTotal);
      setTimeRemaining(rem);
      if (rem <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const createSession = useCallback(async ({ type, difficulty, language, focusArea, durationMinutes }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/interviews', { type, difficulty, language, focusArea, durationMinutes });
      setSession(data.session);
      setShowConfig(false);
      return data.session;
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to create interview.';
      setError(msg);
      throw err;
    } finally { setLoading(false); }
  }, []);

  const generateQuestion = useCallback(async () => {
    if (!session) return null;
    setGenerating(true);
    setInterviewState('asking');
    try {
      const { data } = await api.post(`/interviews/${session.id}/question`);
      setSession(data.session);
      setInterviewState('asking');
      return data;
    } catch (err) {
      setInterviewState('error');
      setError(err?.response?.data?.message || 'Failed to generate question.');
      return null;
    } finally { setGenerating(false); }
  }, [session]);

  const submitAnswer = useCallback(async (answer, inputMode = 'text') => {
    if (!session) return null;
    setInterviewState('evaluating');
    try {
      const { data } = await api.post(`/interviews/${session.id}/answer`, { answer, inputMode });
      setSession(data.session);

      if (data.nextAction === 'follow_up') {
        setInterviewState('follow_up');
      } else {
        setInterviewState('asking');
      }

      return data;
    } catch (err) {
      setInterviewState('error');
      setError(err?.response?.data?.message || 'Failed to submit answer.');
      return null;
    }
  }, [session]);

  const completeInterview = useCallback(async (action = 'complete') => {
    if (!session) return null;
    stopTimer();
    try {
      const { data } = await api.post(`/interviews/${session.id}/complete`, { action });
      setSession(data.session);
      if (action === 'complete') {
        setInterviewState('completed');
        setShowResults(true);
      } else {
        setInterviewState('idle');
      }
      return data.session;
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to complete interview.');
      return null;
    }
  }, [session, stopTimer]);

  const pauseInterview = useCallback(async () => {
    if (!session) return null;
    stopTimer();
    // Record current pause start.
    pausedTimeRef.current += Date.now() - startTimeRef.current;
    try {
      const { data } = await api.post(`/interviews/${session.id}/pause`);
      setSession(data.session);
      setInterviewState('paused');
      return data.session;
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to pause interview.');
      return null;
    }
  }, [session, stopTimer]);

  const resumeInterview = useCallback(async () => {
    if (!session) return null;
    try {
      const { data } = await api.post(`/interviews/${session.id}/resume`);
      setSession(data.session);
      setInterviewState('asking');
      startTimer(data.session);
      return data.session;
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to resume interview.');
      return null;
    }
  }, [session, startTimer]);

  const clearInterview = useCallback(() => {
    stopTimer();
    setSession(null);
    setInterviewState('idle');
    setTimeRemaining(null);
    setShowResults(false);
    setShowConfig(false);
    setError(null);
  }, [stopTimer]);

  const value = useMemo(() => ({
    session, interviewState, setInterviewState,
    loading, generating, error, setError,
    showResults, setShowResults, showConfig, setShowConfig,
    timeRemaining,
    createSession, generateQuestion, submitAnswer,
    completeInterview, pauseInterview, resumeInterview, clearInterview,
  }), [
    session, interviewState, loading, generating, error,
    showResults, showConfig, timeRemaining,
    createSession, generateQuestion, submitAnswer,
    completeInterview, pauseInterview, resumeInterview, clearInterview,
  ]);

  return (
    <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>
  );
}
