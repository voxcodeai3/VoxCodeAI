import { useEffect, useRef, useState } from 'react';
import { Maximize, Minus, X, MessageCircle, Microchip, Trash2, User, BookOpen, Mic, Volume2, VolumeX, MoreVertical } from 'lucide-react';
import ConversationPanel from './ConversationPanel';
import MessageComposer from './MessageComposer';
import { useAI } from '../../context/AIContext';
import { useVoice } from '../../context/VoiceContext';
import { useConversations } from '../../context/ConversationContext';
import LearnerProfilePanel from '../learner/LearnerProfilePanel';
import LearningWorkspace from '../learning/LearningWorkspace';
import InterviewWorkspace from '../interview/InterviewWorkspace';
import CodePractice from '../practice/CodePractice';
import { useLearning } from '../../context/LearningContext';
import { useInterview } from '../../context/InterviewContext';

function MenuItem({ icon: Icon, label, onSelect, danger = false }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${danger ? 'text-red-400/80 hover:bg-red-400/10 hover:text-red-300' : 'text-cyan-100/80 hover:bg-cyan-400/10 hover:text-cyan-200'}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function TextConsole({ expanded = false }) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLearningOpen, setIsLearningOpen] = useState(false);
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { messages, isThinking, clearConversation, loadConversationMessages, openPractice, clearOpenPractice, practiceMode } = useAI();
  const { voiceEnabled, toggleVoice, support } = useVoice();
  const { activeConversationId } = useConversations();
  const { session: activeSession } = useLearning();
  const { session: activeInterview, showResults: interviewShowResults } = useInterview();
  const scrollRef = useRef(null);
  const wasExpandedRef = useRef(isExpanded);

  // Auto-open interview workspace when viewing results from history.
  useEffect(() => {
    if (interviewShowResults) setIsInterviewOpen(true);
  }, [interviewShowResults]);

  // Auto-open CodePractice when quick action triggers it.
  useEffect(() => {
    if (openPractice) {
      setIsPracticeOpen(true);
      clearOpenPractice();
    }
  }, [openPractice, clearOpenPractice]);

  useEffect(() => {
    if (!isExpanded) return undefined;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    return undefined;
  }, [messages, isThinking, isExpanded]);

  useEffect(() => {
    if (isExpanded && !wasExpandedRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    wasExpandedRef.current = isExpanded;
  }, [isExpanded]);

  // Reset the mobile overflow menu whenever the console collapses.
  useEffect(() => {
    if (!isExpanded) setIsMenuOpen(false);
  }, [isExpanded]);

  // Close the mobile overflow menu with Escape.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  const handlePracticeClick = () => {
    if (activeSession) {
      setIsLearningOpen(true);
    } else {
      setIsPracticeOpen(true);
    }
  };

  // Runs a mobile menu action, then closes the menu.
  const selectMenuAction = (action) => () => {
    setIsMenuOpen(false);
    action();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isExpanded && (
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="w-[280px] rounded-2xl border border-cyan-400/20 bg-[#040a14]/80 backdrop-blur-2xl flex flex-col items-center justify-center p-4 text-sm text-cyan-300 transition-all duration-500 hover:scale-[1.02] hover:border-cyan-300/50 hover:bg-white/[0.06] cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-cyan-300" />
              <span>Ask VoxCode...</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="opacity-70">⌨</span>
              <Maximize className="h-4 w-4 text-cyan-300 transition-transform duration-300 group-hover:rotate-90" />
            </div>
          </button>
        </div>
      )}
      {isExpanded && (
        <div className="w-[calc(100vw-32px)] sm:w-[70vw] h-[80vh] max-w-[900px] max-h-[700px] rounded-3xl border border-cyan-400/20 bg-[#040a14]/85 backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-500" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="relative z-20 flex items-center justify-between border-b border-cyan-400/10 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-cyan-400/20 bg-cyan-400/10 flex items-center justify-center">
                <Microchip className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">VOXCODE CONSOLE</p>
                <p className="flex items-center gap-2 text-xs text-cyan-300">
                  <span className={`h-2 w-2 rounded-full ${isThinking ? 'bg-yellow-400' : 'bg-cyan-400 animate-pulse'}`} />
                  <span>{isThinking ? 'THINKING' : 'ONLINE'}</span>
                </p>
              </div>
            </div>
            <div className="relative flex items-center gap-1.5 sm:gap-3">
              {/* Desktop: every action directly visible */}
              <div className="hidden items-center gap-3 md:flex">
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-label={voiceEnabled ? 'Mute voice' : 'Enable voice'}
                  title={voiceEnabled ? 'Voice: ON' : 'Voice: OFF'}
                  className={`rounded-lg p-1.5 transition-colors ${voiceEnabled ? 'text-cyan-400/60 hover:text-cyan-400' : 'text-amber-400 hover:text-amber-300'}`}
                >
                  {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsInterviewOpen(true)}
                  aria-label="Open interview"
                  className="rounded-lg p-1.5 text-cyan-400/60 hover:text-cyan-400 transition-colors"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePracticeClick}
                  aria-label="Open practice"
                  className="rounded-lg p-1.5 text-cyan-400/60 hover:text-cyan-400 transition-colors"
                >
                  <BookOpen className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  aria-label="Learning profile"
                  className="rounded-lg p-1.5 text-cyan-400/60 hover:text-cyan-400 transition-colors"
                >
                  <User className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={clearConversation}
                  aria-label="Clear conversation"
                >
                  <Trash2 className="h-4 w-4 text-cyan-400/60 hover:text-red-400 transition-colors" />
                </button>
              </div>
              {/* Mobile: interview, voice, practice, profile and clear live in a dropdown */}
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((open) => !open)}
                  aria-label="Console options"
                  aria-expanded={isMenuOpen}
                  className="rounded-lg p-1.5 text-cyan-400/60 hover:text-cyan-400 transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {isMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-hidden="true"
                      tabIndex={-1}
                      onClick={() => setIsMenuOpen(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-cyan-400/20 bg-[#040a14]/95 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                      <MenuItem
                        icon={voiceEnabled ? Volume2 : VolumeX}
                        label={voiceEnabled ? 'Voice: On' : 'Voice: Off'}
                        onSelect={selectMenuAction(toggleVoice)}
                      />
                      <MenuItem
                        icon={Mic}
                        label="Interview"
                        onSelect={selectMenuAction(() => setIsInterviewOpen(true))}
                      />
                      <MenuItem
                        icon={BookOpen}
                        label="Practice"
                        onSelect={selectMenuAction(handlePracticeClick)}
                      />
                      <MenuItem
                        icon={User}
                        label="Profile"
                        onSelect={selectMenuAction(() => setIsProfileOpen(true))}
                      />
                      <MenuItem
                        icon={Trash2}
                        label="Clear chat"
                        danger
                        onSelect={selectMenuAction(clearConversation)}
                      />
                    </div>
                  </>
                )}
              </div>
              {/* Always visible, including on mobile: minimize + close */}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Minimize console"
              >
                <Minus className="h-4 w-4 text-cyan-400/60 hover:text-cyan-400 transition-colors" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Close console"
              >
                <X className="h-4 w-4 text-cyan-400/60 hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
            <ConversationPanel
              className="flex flex-col gap-4"
              messages={messages}
              isTyping={isThinking}
            />
          </div>
          <MessageComposer />
        </div>
      )}

      <LearnerProfilePanel
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
      <LearningWorkspace
        isOpen={isLearningOpen}
        onClose={() => setIsLearningOpen(false)}
      />
      <CodePractice
        isOpen={isPracticeOpen}
        onClose={() => setIsPracticeOpen(false)}
        mode={practiceMode}
      />
      <InterviewWorkspace
        isOpen={isInterviewOpen}
        onClose={() => setIsInterviewOpen(false)}
      />
    </div>
  );
}

export default TextConsole;
