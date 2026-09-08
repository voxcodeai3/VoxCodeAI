import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Volume2, VolumeX, Mic, MicOff, AlertCircle } from 'lucide-react';
import api from '../../../services/api';
import { useVoice } from '../../../context/VoiceContext';

export default function AITeacher({ sessionId, session, onStateChange, onMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const voice = useVoice();
  const sendingRef = useRef(false);
  sendingRef.current = sending;
  // Message ids already read aloud. The auto-speak effect below must fire
  // at most once per message — without this, every VoiceProvider re-render
  // (including the speaking→idle transition when speech ENDS) re-triggers
  // the effect and the same message repeats forever.
  const spokenRef = useRef(new Set());

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  useEffect(() => {
    if (session && messages.length === 0) {
      const topic = session.topic?.title || 'this topic';
      const path = session.learningPath?.title || '';
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Welcome! We're working on ${topic}${path ? ` in ${path}` : ''}. I'm here to teach you step by step. Ask me anything or let's get started.`,
      }]);
    }
  }, [session]);

  const { voiceEnabled, speakResponse } = voice;
  const speakIfEnabled = useCallback((text, messageId) => {
    if (voiceEnabled && text) {
      speakResponse(text, messageId);
    }
  }, [voiceEnabled, speakResponse]);

  useEffect(() => {
    if (messages.length > 0 && voiceEnabled) {
      const last = messages[messages.length - 1];
      if (last.role === 'assistant' && last.id !== 'welcome' && !last.isError && !spokenRef.current.has(last.id)) {
        spokenRef.current.add(last.id);
        speakIfEnabled(last.content, last.id);
      }
    }
  }, [messages, speakIfEnabled, voiceEnabled]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || '').trim();
    if (!msg || sendingRef.current || !sessionId) return;

    setInput('');
    setSending(true);

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data } = await api.post(`/learning/teaching/session/${sessionId}/message`, { message: msg });
      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.message || '',
        evaluation: data.evaluation || null,
        suggestedAction: data.suggestedAction || null,
      };
      setMessages(prev => [...prev, aiMsg]);
      onStateChange?.(data.state, data.session);
      onMessage?.(data);
    } catch (err) {
      const errMsg = err?.response?.data?.message || 'Something went wrong. Please try again.';
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: errMsg,
        isError: true,
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [sessionId, onStateChange, onMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleVoiceToggle = useCallback(() => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      if (voice.isSpeaking) {
        voice.stopSpeaking();
      }
      voice.startListening();
    }
  }, [voice]);

  useEffect(() => {
    voice.setFinalTranscriptHandler((spokenText) => {
      if (spokenText && !sendingRef.current) {
        sendMessage(spokenText);
      }
    });
    return () => voice.setFinalTranscriptHandler(null);
  }, [voice, sendMessage]);

  const voiceStateLabel = voice.isListening ? 'Listening...' : voice.isSpeaking ? 'Speaking...' : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0 sm:px-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed sm:max-w-[85%] ${
              msg.role === 'user'
                ? 'bg-cyan-500/15 text-white/90 border border-cyan-400/20'
                : msg.isError
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-400/20'
                  : 'bg-white/[0.04] text-white/80 border border-white/[0.06]'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.evaluation && (
                <div className={`mt-2 text-xs px-2 py-1 rounded ${
                  msg.evaluation.result === 'correct'
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : msg.evaluation.result === 'partially_correct'
                      ? 'bg-amber-400/10 text-amber-400'
                      : 'bg-rose-400/10 text-rose-400'
                }`}>
                  {msg.evaluation.feedback}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span className="text-xs text-white/40">Thinking...</span>
            </div>
          </div>
        )}

        {voice.isListening && (
          <div className="flex justify-start">
            <div className="bg-cyan-500/10 border border-cyan-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs text-cyan-300">
                {voice.transcript || 'Listening...'}
              </span>
            </div>
          </div>
        )}

        {voice.isSpeaking && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-xs text-white/40">Speaking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/[0.06] px-3 py-2 safe-area-inset-bottom">
        {voice.errorMessage && (
          <div className="mb-2 px-2 py-1.5 rounded bg-amber-400/10 border border-amber-400/20 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-300">{voice.errorMessage}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={voice.toggleVoice}
            className={`p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
              voice.voiceEnabled ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/30 hover:text-white/50'
            }`}
            title={voice.voiceEnabled ? 'Mute AI voice' : 'Enable AI voice'}
          >
            {voice.voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {voice.support.speech ? (
            <button
              onClick={handleVoiceToggle}
              disabled={sending}
              className={`p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
                voice.isListening
                  ? 'text-rose-400 bg-rose-400/10 animate-pulse'
                  : voice.isSpeaking
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-white/30 hover:text-white/50'
              } disabled:opacity-30`}
              title={voice.isListening ? 'Stop listening' : 'Speak to teacher'}
            >
              {voice.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          ) : null}

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voice.isListening ? 'Listening...' : 'Ask your teacher...'}
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/15 transition-colors"
            disabled={sending || voice.isListening}
          />

          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending || voice.isListening}
            className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
