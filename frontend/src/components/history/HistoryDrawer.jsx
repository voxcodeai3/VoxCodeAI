import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Loader2, MessageSquareDashed, Mic, Trophy, Trash2 } from 'lucide-react';
import { useConversations } from '../../context/ConversationContext';
import { useInterview } from '../../context/InterviewContext';
import ConversationItem from './ConversationItem';
import api from '../../services/api';

function DeleteModal({ title, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div
        className="w-[90vw] max-w-[360px] rounded-2xl border border-cyan-400/15 bg-[#080e1c]/95 backdrop-blur-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-white mb-2">Delete conversation?</p>
        <p className="text-xs text-cyan-400/50 mb-6 leading-relaxed">
          This conversation will be permanently deleted. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-cyan-400/15 bg-white/[0.03] px-4 py-2 text-xs text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-xs text-red-300 hover:bg-red-400/20 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryDrawer({ isOpen, onClose, onSelectConversation, onSelectInterview }) {
  const {
    conversations,
    activeConversationId,
    loadingConversations,
    loadConversation,
    deleteConversation,
    newConversation,
  } = useConversations();

  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingDeleteInterview, setPendingDeleteInterview] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const { deleteInterview } = useInterview();

  // Load interview history.
  useEffect(() => {
    if (!isOpen) return;
    setLoadingInterviews(true);
    api.get('/interviews').then(({ data }) => {
      setInterviews(data.sessions || []);
    }).catch(() => {}).finally(() => setLoadingInterviews(false));
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Group conversations by date.
  const grouped = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = { Today: [], Yesterday: [], Earlier: [] };
    for (const c of conversations) {
      const d = new Date(c.updatedAt);
      if (d.toDateString() === today) groups.Today.push(c);
      else if (d.toDateString() === yesterday.toDateString()) groups.Yesterday.push(c);
      else groups.Earlier.push(c);
    }
    return groups;
  }, [conversations]);

  const handleSelect = async (id) => {
    await loadConversation(id);
    onSelectConversation();
    onClose();
  };

  const handleNewConversation = () => {
    newConversation();
    onSelectConversation();
    onClose();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    await deleteConversation(pendingDelete.id);
    setPendingDelete(null);
  };

  const handleDeleteInterview = async () => {
    if (!pendingDeleteInterview) return;
    await deleteInterview(pendingDeleteInterview.id);
    setInterviews((prev) => prev.filter((i) => i.id !== pendingDeleteInterview.id));
    setPendingDeleteInterview(null);
  };

  const isEmpty = !loadingConversations && conversations.length === 0 && interviews.length === 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — fades in */}
      <div
        className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.2s ease-out' }}
        onClick={onClose}
      />

      {/* Drawer — slides in from left */}
      <div
        className="fixed inset-y-0 left-0 z-[60] w-[320px] max-w-[85vw] bg-[#060c18]/95 backdrop-blur-2xl border-r border-cyan-400/10 flex flex-col shadow-2xl"
        style={{ animation: 'slideInLeft 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-400/10">
          <h2 className="text-sm font-semibold text-white tracking-wide">VOXCODE HISTORY</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-cyan-400/40 hover:text-cyan-300 hover:bg-white/[0.05] transition-colors"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New conversation button */}
        <div className="px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={handleNewConversation}
            className="w-full flex items-center gap-2.5 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] px-4 py-2.5 text-sm text-cyan-300 hover:bg-cyan-400/10 hover:border-cyan-400/25 transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
          {loadingConversations && (
            <div className="flex flex-col items-center justify-center py-12 text-cyan-400/40">
              <Loader2 className="h-5 w-5 animate-spin mb-3" />
              <p className="text-xs">Loading conversations...</p>
            </div>
          )}

          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquareDashed className="h-8 w-8 text-cyan-400/20 mb-3" />
              <p className="text-xs font-medium text-white/60 mb-1">NO CONVERSATIONS YET</p>
              <p className="text-[10px] text-cyan-400/30 max-w-[180px] leading-relaxed">
                Start talking to VoxCode and your coding sessions will appear here.
              </p>
            </div>
          )}

          {!loadingConversations &&
            Object.entries(grouped).map(([label, items]) =>
              items.length === 0 ? null : (
                <div key={label} className="mb-4">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-cyan-400/25 mb-2 px-1">
                    {label}
                  </p>
                  <div className="border-t border-cyan-400/5 mb-2" />
                  <div className="space-y-1">
                    {items.map((c) => (
                      <ConversationItem
                        key={c.id}
                        conversation={c}
                        isActive={c.id === activeConversationId}
                        onSelect={handleSelect}
                        onDelete={(id, title) => setPendingDelete({ id, title })}
                      />
                    ))}
                  </div>
                </div>
              )
            )}

          {/* Interview History */}
          {interviews.length > 0 && (
            <div className="mb-4 mt-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-cyan-400/25 mb-2 px-1">
                Interviews
              </p>
              <div className="border-t border-cyan-400/5 mb-2" />
              <div className="space-y-1">
                {interviews.slice(0, 10).map((interview) => (
                  <div key={interview.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => { onSelectInterview(interview); onClose(); }}
                      className="w-full flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-left transition-all hover:bg-white/[0.04] hover:border-white/[0.08]"
                    >
                      <div className="h-8 w-8 rounded-full border border-cyan-400/10 bg-cyan-400/[0.04] flex items-center justify-center shrink-0">
                        <Mic className="h-3.5 w-3.5 text-cyan-400/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/60 truncate">
                          {interview.type} Interview
                          {interview.language ? ` · ${interview.language}` : ''}
                        </p>
                        <p className="text-[9px] text-white/25 mt-0.5">
                          {interview.status === 'completed' ? 'Completed' : interview.status}
                          {interview.score > 0 && ` · ${interview.score}/100`}
                        </p>
                      </div>
                      {interview.status === 'completed' && (
                        <Trophy className="h-3 w-3 text-amber-400/40 shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingDeleteInterview(interview); }}
                      className="absolute top-1.5 right-1.5 rounded-md p-1 text-white/0 group-hover:text-white/30 hover:!text-red-400 hover:bg-red-400/10 transition-colors"
                      aria-label="Delete interview"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation for conversations */}
      {pendingDelete && (
        <DeleteModal
          title={pendingDelete.title}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Delete confirmation for interviews */}
      {pendingDeleteInterview && (
        <DeleteModal
          title={`${pendingDeleteInterview.type} Interview`}
          onConfirm={handleDeleteInterview}
          onCancel={() => setPendingDeleteInterview(null)}
        />
      )}
    </>
  );
}

export default HistoryDrawer;
