import { useState, useEffect } from 'react';
import { X, User, Plus, Check } from 'lucide-react';
import { useLearnerProfile } from '../../context/LearnerProfileContext';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const STYLES = [
  { value: 'step_by_step', label: 'Step by Step' },
  { value: 'socratic', label: 'Socratic' },
  { value: 'example_first', label: 'Examples First' },
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'practice_focused', label: 'Practice Focused' },
];

function TagInput({ value = [], onChange, placeholder, max = 10 }) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || value.length >= max) return;
    if (value.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput('');
      return;
    }
    onChange([...value, trimmed]);
    setInput('');
  };

  const remove = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-2.5 py-0.5 text-[10px] text-cyan-300/80"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              className="ml-0.5 text-cyan-400/40 hover:text-red-400 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      {value.length < max && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 placeholder:text-white/20 focus:border-cyan-400/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.06] px-2 text-cyan-300/60 hover:text-cyan-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function LearnerProfilePanel({ isOpen, onClose }) {
  const { profile, updateProfile } = useLearnerProfile();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setForm({
        experienceLevel: profile.experienceLevel || null,
        preferredLanguages: [...(profile.preferredLanguages || [])],
        learningGoals: [...(profile.learningGoals || [])],
        strengths: [...(profile.strengths || [])],
        weaknesses: [...(profile.weaknesses || [])],
        interests: [...(profile.interests || [])],
        preferredTeachingStyle: profile.preferredTeachingStyle || null,
      });
      setSaved(false);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* non-fatal */
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[90vw] max-w-[520px] max-h-[85vh] rounded-3xl border border-cyan-400/15 bg-[#060c18]/95 backdrop-blur-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] flex items-center justify-center">
              <User className="h-4 w-4 text-cyan-300/70" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">LEARNING PROFILE</p>
              <p className="text-[10px] text-white/30">Customize how VoxCode teaches you</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Experience Level */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-white/40 mb-2">
              Experience Level
            </label>
            <div className="flex gap-2">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updateField('experienceLevel', lvl)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-all ${
                    form.experienceLevel === lvl
                      ? 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-300'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60 hover:border-white/[0.1]'
                  }`}
                >
                  {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Languages */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-white/40 mb-2">
              Preferred Languages
            </label>
            <TagInput
              value={form.preferredLanguages}
              onChange={(v) => updateField('preferredLanguages', v)}
              placeholder="e.g. JavaScript, React"
              max={10}
            />
          </div>

          {/* Teaching Style */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-white/40 mb-2">
              Teaching Style
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => updateField('preferredTeachingStyle', s.value)}
                  className={`rounded-lg border px-3 py-2 text-[11px] text-left transition-all ${
                    form.preferredTeachingStyle === s.value
                      ? 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-300'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60 hover:border-white/[0.1]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Learning Goals */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-white/40 mb-2">
              Learning Goals
            </label>
            <TagInput
              value={form.learningGoals}
              onChange={(v) => updateField('learningGoals', v)}
              placeholder="e.g. Learn React, Prepare for interviews"
              max={10}
            />
          </div>

          {/* Strengths */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-white/40 mb-2">
              Strong Areas
            </label>
            <TagInput
              value={form.strengths}
              onChange={(v) => updateField('strengths', v)}
              placeholder="e.g. JavaScript basics, CSS"
              max={15}
            />
          </div>

          {/* Weaknesses */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-white/40 mb-2">
              Areas to Improve
            </label>
            <TagInput
              value={form.weaknesses}
              onChange={(v) => updateField('weaknesses', v)}
              placeholder="e.g. Async programming, Closures"
              max={15}
            />
          </div>

          {/* Interests */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-white/40 mb-2">
              Interests
            </label>
            <TagInput
              value={form.interests}
              onChange={(v) => updateField('interests', v)}
              placeholder="e.g. Web dev, Game dev, AI"
              max={10}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.04] px-6 py-4 flex items-center justify-between">
          <p className="text-[10px] text-white/20">
            VoxCode also learns from your conversations automatically.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-2 text-xs text-cyan-300 hover:bg-cyan-400/[0.15] transition-all disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Saved
              </>
            ) : saving ? (
              'Saving...'
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LearnerProfilePanel;
