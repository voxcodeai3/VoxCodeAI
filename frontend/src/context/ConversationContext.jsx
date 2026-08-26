import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ConversationContext = createContext(null);

export function useConversations() {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversations must be used inside <ConversationProvider>');
  return ctx;
}

export function ConversationProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingActive, setLoadingActive] = useState(false);

  // Fetch the conversation list when authenticated.
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingConversations(true);
    try {
      const { data } = await api.get('/conversations');
      setConversations(data || []);
    } catch {
      /* offline / error — keep existing list */
    } finally {
      setLoadingConversations(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
    } else {
      setConversations([]);
      setActiveConversationId(null);
      setActiveConversation(null);
    }
  }, [isAuthenticated, fetchConversations]);

  // Load a specific conversation's messages.
  const loadConversation = useCallback(async (id) => {
    if (!id) {
      setActiveConversationId(null);
      setActiveConversation(null);
      return null;
    }
    setLoadingActive(true);
    try {
      const { data } = await api.get(`/conversations/${id}`);
      setActiveConversationId(data.id);
      setActiveConversation(data);
      return data;
    } catch {
      return null;
    } finally {
      setLoadingActive(false);
    }
  }, []);

  // After AIContext sends a message and gets back a conversationId,
  // sync it here and refresh the list.
  const syncAfterChat = useCallback(
    async (conversationId) => {
      if (conversationId && conversationId !== activeConversationId) {
        setActiveConversationId(conversationId);
      }
      await fetchConversations();
    },
    [activeConversationId, fetchConversations]
  );

  // Delete a conversation and refresh list.
  const deleteConversation = useCallback(
    async (id) => {
      try {
        await api.delete(`/conversations/${id}`);
      } catch {
        /* continue regardless */
      }
      if (id === activeConversationId) {
        setActiveConversationId(null);
        setActiveConversation(null);
      }
      await fetchConversations();
    },
    [activeConversationId, fetchConversations]
  );

  // Start a new conversation (clear active, keep list intact).
  const newConversation = useCallback(() => {
    setActiveConversationId(null);
    setActiveConversation(null);
  }, []);

  // Reset all state on logout.
  const resetAll = useCallback(() => {
    setConversations([]);
    setActiveConversationId(null);
    setActiveConversation(null);
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      activeConversationId,
      activeConversation,
      loadingConversations,
      loadingActive,
      fetchConversations,
      loadConversation,
      setActiveConversationId,
      syncAfterChat,
      deleteConversation,
      newConversation,
      resetAll,
    }),
    [
      conversations,
      activeConversationId,
      activeConversation,
      loadingConversations,
      loadingActive,
      fetchConversations,
      loadConversation,
      syncAfterChat,
      deleteConversation,
      newConversation,
      resetAll,
    ]
  );

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
