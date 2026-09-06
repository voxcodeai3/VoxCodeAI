import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import api from '../../../services/api';
import { useVoice } from '../../../context/VoiceContext';

export default function AITeacher({ sessionId, session, onStateChange, onMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const voice = useVoice();
  const inputRef2 = useRef(input);
  inputRef2.current = input;

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

  useEffect(() => {
    if (ttsEnabled && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'assistant' && last.id !== 'welcome') {
        voice.speakResponse(last.content, last.id);
      }
    }
  }, [messages, ttsEnabled, voice]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !sessionId) return;

    setInput('');
    setSending(true);

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data } = await api.post(`/learning/teaching/session/${sessionId}/message`, { message: text });
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
  }, [input, sending, sessionId, onStateChange, onMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceToggle = () => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      voice.startListening();
    }
  };

  useEffect(() => {
    voice.setFinalTranscriptHandler((spokenText) => {
      if (spokenText && !inputRef2.current) {
        setInput(spokenText);
      } else if (spokenText) {
        setInput(prev => prev + ' ' + spokenText);
      }
    });
    return () => voice.setFinalTranscriptHandler(null);
  }, [voice]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
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
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`p-1.5 rounded transition-colors ${
              ttsEnabled ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/30 hover:text-white/50'
            }`}
            title={ttsEnabled ? 'Mute AI voice' : 'Enable AI voice'}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={handleVoiceToggle}
            className={`p-1.5 rounded transition-colors ${
              voice.isListening ? 'text-rose-400 bg-rose-400/10' : 'text-white/30 hover:text-white/50'
            }`}
            title={voice.isListening ? 'Stop listening' : 'Speak'}
          >
            {voice.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your teacher..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/15 transition-colors"
            disabled={sending}
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
