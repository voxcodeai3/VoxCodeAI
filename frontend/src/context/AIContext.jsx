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

/**
 * Combine the AI's recommended response mode with the user's preference.
 * Preference wins; "AI decides" keeps the recommendation.
 */
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

export function AIProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const voice = useVoice();

  const [messages, setMessages] = useState(GREETING());
  const [isThinking, setIsThinking] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
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

  const convIdRef = useRef(null);
  convIdRef.current = currentConversationId;

  const isThinkingRef = useRef(false);
  isThinkingRef.current = isThinking;

  const pendingRetryRef = useRef(null);

  const setPreference = useCallback((pref) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(PREFERENCE_KEY, pref);
    } catch {
      /* noop */
    }
  }, []);

  // Restore the latest server-side conversation so voice + text share one thread.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/ai/conversation');
        if (cancelled || !data?.conversationId || !Array.isArray(data.messages)) return;
        if (!data.messages.length) return;
        setCurrentConversationId(data.conversationId);
        setSettings((s) => ({
          ...s,
          language: data.language || s.language,
          level: data.level || s.level,
          teachingMode: data.teachingMode || s.teachingMode,
        }));
        setMessages([
          ...GREETING(),
          ...data.messages.map((m, i) => ({
            id: `h-${i}-${m.at || Date.now()}`,
            type: m.role === 'user' ? 'user' : 'ai',
            content: m.content,
            code: m.code || null,
            timestamp: m.at ? new Date(m.at) : new Date(),
            avatar: null,
            source: m.inputMode || undefined,
          })),
        ]);
      } catch {
        /* offline / expired — start fresh silently */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /** Core request lifecycle. Drives VoiceWeave through thinking → speaking/idle. */
  const runChat = useCallback(
    async ({ text, inputMode, overrides = {} }) => {
      setIsThinking(true);
      voice.setThinking();
      try {
        const { data } = await api.post('/ai/chat', {
          message: text,
          conversationId: convIdRef.current || undefined,
          inputMode,
          language: overrides.language || settings.language,
          level: overrides.level || settings.level,
          teachingMode: overrides.teachingMode || settings.teachingMode,
        });

        if (data?.conversationId) setCurrentConversationId(data.conversationId);

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
    [preference, settings, voice],
  );

  /**
   * Send a user message (typed or spoken). Voice and text share the same
   * conversation — inputMode only tags how the message was captured.
   */
  const sendMessage = useCallback(
    (rawText, inputMode = 'text', overrides = {}) => {
      const text = (rawText || '').trim();
      if (!text) return;
      if (isThinkingRef.current) return;

      voice.stopSpeaking(); // starting a new exchange stops current playback
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

  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  // Spoken transcripts flow into the same pipeline as typed messages.
  useEffect(() => {
    voice.setFinalTranscriptHandler((spokenText) => {
      sendRef.current(spokenText, 'voice');
    });
    return () => voice.setFinalTranscriptHandler(null);
  }, [voice]);

  /** Retry the last failed request without losing the original message. */
  const retryLast = useCallback(() => {
    const pending = pendingRetryRef.current;
    if (!pending) return;
    pendingRetryRef.current = null;
    setHasFailedAttempt(false);
    setMessages((prev) => prev.filter((m) => !m.failed));
    runChat(pending);
  }, [runChat]);

  const clearConversation = useCallback(async () => {
    try {
      await api.delete('/ai/conversation');
    } catch {
      /* clear locally regardless */
    }
    voice.stopSpeaking();
    setResponseMode(null);
    setCurrentConversationId(null);
    setHasFailedAttempt(false);
    setActiveAction(null);
    pendingRetryRef.current = null;
    setSettings({ language: 'javascript', level: 'beginner', teachingMode: 'learn' });
    setMessages(GREETING());
  }, [voice]);

  /** Quick actions update the teaching mode and send an appropriate opener. */
  const triggerQuickAction = useCallback(
    (actionId) => {
      const config = QUICK_ACTION_PROMPTS[actionId];
      if (!config) return;
      setActiveAction(actionId);
      setSettings((s) => ({ ...s, teachingMode: config.teachingMode }));
      sendMessage(config.prompt, 'text', { teachingMode: config.teachingMode });
    },
    [sendMessage],
  );

  const value = useMemo(
    () => ({
      messages,
      isThinking,
      currentConversationId,
      hasFailedAttempt,
      responseMode,
      preference,
      setPreference,
      settings,
      setSettings,
      activeAction,
      sendMessage,
      retryLast,
      clearConversation,
      triggerQuickAction,
    }),
    [
      messages,
      isThinking,
      currentConversationId,
      hasFailedAttempt,
      responseMode,
      preference,
      setPreference,
      settings,
      activeAction,
      sendMessage,
      retryLast,
      clearConversation,
      triggerQuickAction,
    ],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}
