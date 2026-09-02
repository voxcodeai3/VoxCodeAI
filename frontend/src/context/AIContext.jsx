import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useVoice } from './VoiceContext';
import { useConversations } from './ConversationContext';

const AIContext = createContext(null);

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used inside <AIProvider>');
  return ctx;
}

const PREFERENCE_KEY = 'voxcode_modality_preference';

const GREETING = () => [
  {
    id: 'greeting',
    type: 'ai',
    content:
      "Hello! I'm VoxCode, your AI coding teacher. How can I help you today?",
    timestamp: new Date(),
    avatar: null,
  },
];

const QUICK_ACTION_PROMPTS = {
  learn: {
    teachingMode: 'learn',
    prompt: 'Teach me an interesting programming concept with a clear explanation.',
  },
  practice: {
    teachingMode: 'practice',
    prompt: 'Give me a small coding exercise to practice, with hints instead of the full solution.',
  },
  debug: {
    teachingMode: 'debug',
    prompt: 'I want to debug some code. Guide me on how to share it with you.',
  },
  quiz: {
    teachingMode: 'quiz',
    prompt: 'Quiz me with one question on programming fundamentals.',
  },
  interview: {
    teachingMode: 'interview',
    prompt: 'Start a mock technical interview and ask me your first question.',
  },
};

function applyPreference(recommended, preference) {
  const rec =
    recommended === 'text_voice' || recommended === 'both'
      ? 'text_voice'
      : recommended === 'voice'
        ? 'voice'
        : 'text';

  switch (preference) {
    case 'text':
      return 'text';
    case 'voice':
      return 'voice';
    case 'both':
      return 'text_voice';
    default:
      return rec;
  }
}

const uid = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Convert backend messages into the frontend message format used by MessageBubble.
 */
function serverMessagesToFrontend(serverMessages) {
  if (!Array.isArray(serverMessages)) return [];
  return serverMessages.map((m, i) => ({
    id: `h-${i}-${m.at || Date.now()}-${m.role}`,
    type: m.role === 'user' ? 'user' : 'ai',
    content: m.content,
    code: m.code || null,
    timestamp: m.at ? new Date(m.at) : new Date(),
    avatar: null,
    source: m.inputMode || undefined,
  }));
}

export function AIProvider({ children }) {
  const { isAuthenticated, logout: authLogout } = useAuth();
  const voice = useVoice();
  const {
    activeConversationId,
    activeConversation,
    syncAfterChat,
    loadConversation,
    newConversation,
    resetAll: resetConversations,
  } = useConversations();

  const [messages, setMessages] = useState(GREETING());
  const [isThinking, setIsThinking] = useState(false);
  const [hasFailedAttempt, setHasFailedAttempt] = useState(false);
  const [preference, setPreferenceState] = useState(() => {
    try {
      return localStorage.getItem(PREFERENCE_KEY) || 'auto';
    } catch {
      return 'auto';
    }
  });
  const [settings, setSettings] = useState({
    language: 'javascript',
    level: 'beginner',
    teachingMode: 'learn',
  });
  const [activeAction, setActiveAction] = useState(null);
  const [responseMode, setResponseMode] = useState(null);
  const [practiceState, setPracticeState] = useState(null); // { question, feedback, score, evaluation }
  const [openPractice, setOpenPractice] = useState(false); // signal to open CodePractice
  const [practiceMode, setPracticeMode] = useState(null); // 'practice' | 'quiz'

  const isThinkingRef = useRef(false);
  isThinkingRef.current = isThinking;

  const pendingRetryRef = useRef(null);
  const syncingRef = useRef(false);

  const setPreference = useCallback((pref) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(PREFERENCE_KEY, pref);
    } catch {
      /* noop */
    }
  }, []);

  // Reset all AI state on logout.
  useEffect(() => {
    if (isAuthenticated) return;
    voice.stopSpeaking();
    setIsThinking(false);
    setHasFailedAttempt(false);
    setActiveAction(null);
    setResponseMode(null);
    pendingRetryRef.current = null;
    syncingRef.current = false;
    setSettings({ language: 'javascript', level: 'beginner', teachingMode: 'learn' });
    setMessages(GREETING());
  }, [isAuthenticated, voice]);

  // When ConversationContext loads a conversation, populate AI messages.
  useEffect(() => {
    if (!activeConversation) {
      // No active conversation — show greeting (but only if we're not in the middle of something).
      // Also skip if we just synced after a chat (syncingRef prevents race condition).
      if (!isThinking && !syncingRef.current) setMessages(GREETING());
      return;
    }
    const serverMessages = activeConversation.messages || [];
    if (serverMessages.length === 0) {
      setMessages(GREETING());
      return;
    }
    setMessages([
      ...GREETING(),
      ...serverMessagesToFrontend(serverMessages),
    ]);
    setSettings((s) => ({
      ...s,
      language: activeConversation.language || s.language,
      level: activeConversation.level || s.level,
      teachingMode: activeConversation.teachingMode || s.teachingMode,
    }));
  }, [activeConversation, isThinking]);

  /** Core request lifecycle. */
  const runChat = useCallback(
    async ({ text, inputMode, overrides = {} }) => {
      setIsThinking(true);
      voice.setThinking();
      try {
        // Reset teachingMode to 'learn' for regular chat (no overrides).
        const mode = overrides.teachingMode || settings.teachingMode;
        const effectiveMode = overrides.teachingMode ? mode : (mode === 'interview' || mode === 'practice' || mode === 'quiz' || mode === 'debug') ? 'learn' : mode;

        const { data } = await api.post('/ai/chat', {
          message: text,
          conversationId: activeConversationId || undefined,
          inputMode,
          language: overrides.language || settings.language,
          level: overrides.level || settings.level,
          teachingMode: effectiveMode,
          codingContext: overrides.codingContext || undefined,
          lessonId: overrides.lessonId || undefined,
          projectId: overrides.projectId || overrides.codingContext?.projectId || undefined,
        });

        const finalMode = applyPreference(data.responseMode, preference);
        setResponseMode(finalMode);
        const aiMessage = {
          id: uid('ai'),
          type: 'ai',
          content: data.message || '',
          code: data.code || null,
          timestamp: new Date(),
          avatar: null,
          modality: finalMode,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsThinking(false);
        setHasFailedAttempt(false);
        pendingRetryRef.current = null;

        // Sync conversation list and active ID with ConversationContext.
        // Set syncingRef to prevent the activeConversation useEffect from
        // wiping messages during the brief null state of the re-fetch.
        if (data.conversationId) {
          syncingRef.current = true;
          syncAfterChat(data.conversationId);
          // Clear the flag after a short delay to allow the useEffect to run.
          setTimeout(() => { syncingRef.current = false; }, 500);
        }

        if (finalMode !== 'text' && aiMessage.content && voice.support.tts) {
          voice.speakResponse(aiMessage.content, aiMessage.id);
        } else {
          voice.setIdle();
        }
      } catch (error) {
        setIsThinking(false);
        voice.setIdle();
        const content =
          error?.response?.data?.message ||
          "I couldn't process that request right now.\nPlease try again.";
        setMessages((prev) => [
          ...prev,
          {
            id: uid('err'),
            type: 'ai',
            content,
            timestamp: new Date(),
            avatar: null,
            failed: true,
          },
        ]);
        pendingRetryRef.current = { text, inputMode, overrides };
        setHasFailedAttempt(true);
      }
    },
    [activeConversationId, preference, settings, voice, syncAfterChat],
  );

  const sendMessage = useCallback(
    (rawText, inputMode = 'text', overrides = {}) => {
      const text = (rawText || '').trim();
      if (!text) return;
      if (isThinkingRef.current) return;

      voice.stopSpeaking();
      setMessages((prev) => [
        ...prev,
        {
          id: uid('user'),
          type: 'user',
          content: text,
          timestamp: new Date(),
          avatar: null,
          source: inputMode,
        },
      ]);
      pendingRetryRef.current = null;
      runChat({ text, inputMode, overrides });
    },
    [runChat, voice],
  );

  /** Send a practice message (generate question or evaluate code) without adding to chat. */
  const sendPracticeMessage = useCallback(
    async (message, practiceMode, codingContext = {}) => {
      setIsThinking(true);
      try {
        const { data } = await api.post('/ai/chat', {
          message,
          practiceMode,
          conversationId: activeConversationId || undefined,
          language: settings.language,
          level: settings.level,
          teachingMode: 'practice',
          codingContext,
        });
        setIsThinking(false);
        if (data.practice?.action === 'question') {
          setPracticeState({ type: 'question', question: data.practice.question, feedback: null, score: null });
        } else if (data.practice?.action === 'evaluation') {
          setPracticeState((prev) => ({
            ...prev,
            type: 'evaluation',
            feedback: data.practice.evaluation,
            score: data.practice.evaluation.score,
          }));
        }
        return data;
      } catch (err) {
        setIsThinking(false);
        console.error('Practice message failed:', err);
        return null;
      }
    },
    [activeConversationId, settings],
  );

  const clearPractice = useCallback(() => setPracticeState(null), []);

  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  useEffect(() => {
    voice.setFinalTranscriptHandler((spokenText) => {
      sendRef.current(spokenText, 'voice');
    });
    return () => voice.setFinalTranscriptHandler(null);
  }, [voice]);

  const retryLast = useCallback(() => {
    const pending = pendingRetryRef.current;
    if (!pending) return;
    pendingRetryRef.current = null;
    setHasFailedAttempt(false);
    setMessages((prev) => prev.filter((m) => !m.failed));
    runChat(pending);
  }, [runChat]);

  // Clear active conversation — start fresh without deleting anything.
  const clearConversation = useCallback(() => {
    voice.stopSpeaking();
    setResponseMode(null);
    setHasFailedAttempt(false);
    setActiveAction(null);
    pendingRetryRef.current = null;
    setSettings({ language: 'javascript', level: 'beginner', teachingMode: 'learn' });
    newConversation();
  }, [voice, newConversation]);

  // Full delete — clears all conversations on server.
  const deleteAllConversations = useCallback(async () => {
    try {
      await api.delete('/ai/conversation');
    } catch {
      /* clear locally regardless */
    }
    voice.stopSpeaking();
    setResponseMode(null);
    setHasFailedAttempt(false);
    setActiveAction(null);
    pendingRetryRef.current = null;
    setSettings({ language: 'javascript', level: 'beginner', teachingMode: 'learn' });
    setMessages(GREETING());
    resetConversations();
  }, [voice, resetConversations]);

  const triggerQuickAction = useCallback(
    (actionId) => {
      const config = QUICK_ACTION_PROMPTS[actionId];
      if (!config) return;
      setActiveAction(actionId);
      setSettings((s) => ({ ...s, teachingMode: config.teachingMode }));
      // Practice and quiz open CodePractice instead of sending a chat message.
      if (actionId === 'practice' || actionId === 'quiz') {
        setPracticeMode(actionId);
        setOpenPractice(true);
        return;
      }
      sendMessage(config.prompt, 'text', { teachingMode: config.teachingMode });
    },
    [sendMessage],
  );

  const clearOpenPractice = useCallback(() => {
    setOpenPractice(false);
    setPracticeMode(null);
    setActiveAction(null);
  }, []);

  // Load a specific conversation from history (called from TextConsole after ConversationContext loads it).
  const loadConversationMessages = useCallback(
    async (id) => {
      const data = await loadConversation(id);
      return data;
    },
    [loadConversation],
  );

  const value = useMemo(
    () => ({
      messages,
      isThinking,
      currentConversationId: activeConversationId,
      hasFailedAttempt,
      responseMode,
      preference,
      setPreference,
      settings,
      setSettings,
      activeAction,
      sendMessage,
      sendPracticeMessage,
      practiceState,
      clearPractice,
      openPractice,
      clearOpenPractice,
      practiceMode,
      retryLast,
      clearConversation,
      deleteAllConversations,
      triggerQuickAction,
      loadConversationMessages,
    }),
    [
      messages,
      isThinking,
      activeConversationId,
      hasFailedAttempt,
      responseMode,
      preference,
      setPreference,
      settings,
      activeAction,
      sendMessage,
      sendPracticeMessage,
      practiceState,
      clearPractice,
      openPractice,
      clearOpenPractice,
      practiceMode,
      retryLast,
      clearConversation,
      deleteAllConversations,
      triggerQuickAction,
      loadConversationMessages,
    ],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}
