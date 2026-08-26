import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const LearningContext = createContext(null);

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used inside <LearningProvider>');
  return ctx;
}

export function LearningProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Check for active session on login.
  useEffect(() => {
    if (!isAuthenticated) { setSession(null); return; }
    api.get('/learning/sessions/active').then(({ data }) => {
      if (data.session) setSession(data.session);
    }).catch(() => {});
  }, [isAuthenticated]);

  const createSession = useCallback(async ({ type, topic, language, difficulty }) => {
    setLoading(true);
    try {
      const { data } = await api.post('/learning/sessions', { type, topic, language, difficulty });
      setSession(data.session);
      return data.session;
    } finally { setLoading(false); }
  }, []);

  const addQuestion = useCallback(async (question) => {
    if (!session) return null;
    const { data } = await api.patch(`/learning/sessions/${session.id}`, { question });
    setSession(data.session);
    return data.session;
  }, [session]);

  const submitAnswer = useCallback(async (answerData) => {
    if (!session) return null;
    const { data } = await api.post(`/learning/sessions/${session.id}/answer`, answerData);
    setSession(data.session);
    return data.session;
  }, [session]);

  const requestHint = useCallback(async (hintIndex = 0) => {
    if (!session) return null;
    const { data } = await api.post(`/learning/sessions/${session.id}/hint`, { hintIndex });
    return data;
  }, [session]);

  const completeSession = useCallback(async (action = 'complete') => {
    if (!session) return null;
    const { data } = await api.post(`/learning/sessions/${session.id}/complete`, { action });
    setSession(data.session);
    return data.session;
  }, [session]);

  const clearSession = useCallback(() => { setSession(null); }, []);

  const value = useMemo(() => ({
    session, loading, generating, setGenerating,
    createSession, addQuestion, submitAnswer, requestHint, completeSession, clearSession,
  }), [session, loading, generating, createSession, addQuestion, submitAnswer, requestHint, completeSession, clearSession]);

  return (
    <LearningContext.Provider value={value}>{children}</LearningContext.Provider>
  );
}
