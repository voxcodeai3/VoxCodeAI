import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const LearnerProfileContext = createContext(null);

export function useLearnerProfile() {
  const ctx = useContext(LearnerProfileContext);
  if (!ctx) throw new Error('useLearnerProfile must be used inside <LearnerProfileProvider>');
  return ctx;
}

const EMPTY_PROFILE = {
  preferredLanguages: [],
  experienceLevel: null,
  learningGoals: [],
  strengths: [],
  weaknesses: [],
  interests: [],
  preferredTeachingStyle: null,
  currentTopics: [],
  topicProgress: [],
  conversationSummary: null,
};

export function LearnerProfileProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const { data } = await api.get('/learner/profile');
      setProfile(data);
    } catch {
      /* profile will stay empty — non-fatal */
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) fetchProfile();
    else setProfile(EMPTY_PROFILE);
  }, [isAuthenticated, fetchProfile]);

  const updateProfile = useCallback(
    async (updates) => {
      try {
        const { data } = await api.patch('/learner/profile', updates);
        setProfile(data);
        return data;
      } catch (err) {
        throw err;
      }
    },
    [],
  );

  const value = useMemo(
    () => ({ profile, loading, fetchProfile, updateProfile }),
    [profile, loading, fetchProfile, updateProfile],
  );

  return (
    <LearnerProfileContext.Provider value={value}>
      {children}
    </LearnerProfileContext.Provider>
  );
}
