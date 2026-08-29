import { useState, useCallback, useRef, useEffect } from 'react';
import { X, PanelLeftClose, PanelLeft, Code2, Send, Sparkles, Volume2, VolumeX, CheckCircle, AlertTriangle, Loader2, History } from 'lucide-react';
import { useCodingWorkspace } from '../../context/CodingWorkspaceContext';
import { useAI } from '../../context/AIContext';
import { useVoice } from '../../context/VoiceContext';
import { useProject } from '../../context/ProjectContext';
import { useVersions } from '../../context/VersionContext';
import CodeEditor from './CodeEditor';
import FileTabs from './FileTabs';
import FileExplorer from './FileExplorer';
import EditorToolbar from './EditorToolbar';
import OutputPanel from './OutputPanel';
import CodeDiff from './CodeDiff';
import NewFileDialog from './NewFileDialog';
import InsertOptionsDialog from './InsertOptionsDialog';
import VersionHistoryPanel from './VersionHistoryPanel';

export default function CodeWorkspace({ isOpen, onClose }) {
  const {
    files, activeFile, activeFileData, fileList,
    updateFileContent, createFile, renameActiveFile,
  } = useCodingWorkspace();
  const { sendMessage, isThinking } = useAI();
  const { voiceEnabled, toggleVoice } = useVoice();
  const { currentProject, saveStatus, conflict, resolveConflict, updateFiles, addFile, removeFile, renameFile, setActiveFile: setProjectActiveFile, saveProject } = useProject();
  const { fetchVersions } = useVersions();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [aiResult, setAiResult] = useState(null); // { type, code, explanation, original }
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState(null);
  const [mobileTab, setMobileTab] = useState('code'); // 'files' | 'code' | 'ai'
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [generateInput, setGenerateInput] = useState('');
  const [showGenerateInput, setShowGenerateInput] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  const editorRef = useRef(null);
  const generateInputRef = useRef(null);

  const handleAction = useCallback((actionId) => {
    const code = selectedCode || activeFileData?.content || '';
    const lang = activeFileData?.language || 'javascript';
    const filename = activeFile || 'untitled';

    // Generate shows an input for the user to describe what they want.
    if (actionId === 'generate') {
      setShowGenerateInput(true);
      setTimeout(() => generateInputRef.current?.focus(), 50);
      return;
    }

    let prompt = '';
    switch (actionId) {
      case 'explain':
        prompt = code
          ? `Explain this code:\n\`\`\`${lang}\n${code}\n\`\`\``
          : `Explain the code in ${filename}.`;
        break;
      case 'debug':
        prompt = code
          ? `Debug this code:\n\`\`\`${lang}\n${code}\n\`\`\``
          : `Debug the code in ${filename}.`;
        break;
      case 'refactor':
        prompt = code
          ? `Refactor this code to be cleaner and more efficient:\n\`\`\`${lang}\n${code}\n\`\`\``
          : `Refactor the code in ${filename}.`;
        break;
      case 'document':
        prompt = code
          ? `Add documentation comments to this code:\n\`\`\`${lang}\n${code}\n\`\`\``
          : `Add documentation to the code in ${filename}.`;
        break;
      default:
        return;
    }

    sendMessage(prompt, 'text');
  }, [selectedCode, activeFileData, activeFile, sendMessage]);

  const handleGenerateSubmit = useCallback(() => {
    const description = generateInput.trim();
    if (!description) return;
    const lang = activeFileData?.language || 'javascript';
    const filename = activeFile || 'untitled';
    const code = activeFileData?.content || '';

    let prompt = `Generate ${lang} code for: ${description}\n\nFile: ${filename}`;
    if (code.trim()) {
      prompt += `\nCurrent file content:\n\`\`\`${lang}\n${code}\n\`\`\``;
    } else {
      prompt += `\nThe file is empty — create a complete implementation.`;
    }
    prompt += `\n\nReturn ONLY the code inside a code block. No explanation needed.`;

    setShowGenerateInput(false);
    setGenerateInput('');
    sendMessage(prompt, 'text');
  }, [generateInput, activeFileData, activeFile, sendMessage]);

  const handleEditorSelect = useCallback((text) => {
    setSelectedCode(text);
  }, []);

  const handleAcceptDiff = useCallback(() => {
    if (!aiResult?.code || !activeFile) return;
    updateFileContent(activeFile, aiResult.code);
    setAiResult(null);
  }, [aiResult, activeFile, updateFileContent]);

  const handleRejectDiff = useCallback(() => {
    setAiResult(null);
  }, []);

  const handleInsertAtCursor = useCallback(() => {
    if (!pendingCode) return;
    const current = activeFileData?.content || '';
    updateFileContent(activeFile, current + '\n' + pendingCode);
    setPendingCode(null);
  }, [pendingCode, activeFile, activeFileData, updateFileContent]);

  const handleReplaceFile = useCallback(() => {
    if (!pendingCode) return;
    updateFileContent(activeFile, pendingCode);
    setPendingCode(null);
  }, [pendingCode, activeFile, updateFileContent]);

  const handleCreateNewFile = useCallback(() => {
    setPendingCode(null);
    setNewFileOpen(true);
  }, []);

  const handleRestoreVersion = useCallback(async (restoredProject) => {
    if (restoredProject?.files) {
      const restoredFiles = {};
      for (const f of restoredProject.files) {
        restoredFiles[f.path] = { content: f.content, language: f.language };
      }
      updateFiles(restoredFiles, restoredProject.activeFile);
    }
    if (restoredProject?._id) {
      fetchVersions(restoredProject._id);
    }
  }, [updateFiles, fetchVersions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#060a14]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-cyan-400/10 bg-[#080d1a] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-1.5 text-white/30 hover:text-white/60 transition-colors lg:hidden"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-cyan-300/60" />
            <span className="text-xs font-medium text-white/70">
              {currentProject ? currentProject.name : 'CODING WORKSPACE'}
            </span>
          </div>
          <span className="text-[10px] text-white/20 hidden sm:inline">
            {fileList.length} file{fileList.length !== 1 ? 's' : ''}
          </span>
          {currentProject && (
            <span className={`text-[10px] flex items-center gap-1 ${
              saveStatus === 'saved' ? 'text-emerald-400/50' :
              saveStatus === 'saving' ? 'text-amber-400/50' :
              saveStatus === 'unsaved' ? 'text-white/30' :
              saveStatus === 'error' ? 'text-red-400/50' :
              'text-white/30'
            }`}>
              {saveStatus === 'saving' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {saveStatus === 'saved' && <CheckCircle className="h-2.5 w-2.5" />}
              {saveStatus === 'error' && <AlertTriangle className="h-2.5 w-2.5" />}
              {saveStatus === 'saving' ? 'Saving...' :
               saveStatus === 'saved' ? 'Saved' :
               saveStatus === 'unsaved' ? 'Unsaved' :
               saveStatus === 'error' ? 'Save failed' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {currentProject && (
            <button
              type="button"
              onClick={() => setVersionHistoryOpen(true)}
              className="rounded-lg p-1.5 text-white/30 hover:text-cyan-300 transition-colors"
              title="Version History"
            >
              <History className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleVoice}
            className="rounded-lg p-1.5 text-white/30 hover:text-white/60 transition-colors"
            title={voiceEnabled ? 'Mute voice' : 'Unmute voice'}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/30 hover:text-red-400 transition-colors"
            aria-label="Close workspace"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="flex border-b border-white/[0.04] bg-[#080d1a] lg:hidden">
        {['files', 'code', 'ai'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              mobileTab === tab
                ? 'text-cyan-300 border-b-2 border-b-cyan-400/40'
                : 'text-white/30 hover:text-white/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — file explorer */}
        <div className={`${
          sidebarOpen ? 'w-52' : 'w-0'
        } transition-all duration-200 overflow-hidden border-r border-white/[0.04] bg-[#080d1a] shrink-0 ${
          mobileTab !== 'files' ? 'hidden lg:block' : ''
        }`}>
          <FileExplorer onNewFile={() => setNewFileOpen(true)} />
        </div>

        {/* Editor area */}
        <div className={`flex-1 flex flex-col min-w-0 ${
          mobileTab !== 'code' ? 'hidden lg:flex' : 'flex'
        }`}>
          <FileTabs />
          <EditorToolbar
            onAction={handleAction}
            isThinking={isThinking}
            selectedCode={selectedCode}
          />

          {/* Generate prompt input */}
          {showGenerateInput && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-400/15 bg-violet-400/[0.03]">
              <Sparkles className="h-3.5 w-3.5 text-violet-400/50 shrink-0" />
              <input
                ref={generateInputRef}
                type="text"
                value={generateInput}
                onChange={(e) => setGenerateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateSubmit();
                  if (e.key === 'Escape') { setShowGenerateInput(false); setGenerateInput(''); }
                }}
                placeholder="Describe what to generate, e.g. 'a REST API with Express routes for users'"
                className="flex-1 bg-transparent text-xs text-white/70 placeholder-white/20 outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateSubmit}
                disabled={!generateInput.trim() || isThinking}
                className="rounded-lg px-2.5 py-1 text-[10px] bg-violet-400/10 text-violet-300 border border-violet-400/20 hover:bg-violet-400/20 transition-all disabled:opacity-30"
              >
                <Send className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => { setShowGenerateInput(false); setGenerateInput(''); }}
                className="text-[10px] text-white/20 hover:text-white/40 transition-colors"
              >
                ESC
              </button>
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 min-h-0">
            {activeFileData ? (
              <CodeEditor
                ref={editorRef}
                content={activeFileData.content}
                language={activeFileData.language}
                onChange={(val) => updateFileContent(activeFile, val)}
                onSelect={handleEditorSelect}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-white/20">
                No file open. Create or select a file.
              </div>
            )}
          </div>

          {/* Diff view — when AI suggests changes */}
          {aiResult && (
            <div className="border-t border-white/[0.06] p-3 bg-[#0a0f1e]">
              <CodeDiff
                original={aiResult.original}
                modified={aiResult.code}
                language={activeFileData?.language}
                onAccept={handleAcceptDiff}
                onReject={handleRejectDiff}
              />
            </div>
          )}
        </div>

        {/* Output panel — AI explanations */}
        <div className={`w-72 border-l border-white/[0.04] bg-[#080d1a] shrink-0 ${
          mobileTab !== 'ai' ? 'hidden lg:block' : 'flex-1'
        }`}>
          <OutputPanel
            onInsertCode={(code) => {
              const current = activeFileData?.content || '';
              updateFileContent(activeFile, current + '\n' + code);
            }}
            onReplaceCode={(code) => {
              updateFileContent(activeFile, code);
            }}
          />
        </div>
      </div>

      {/* Dialogs */}
      <NewFileDialog isOpen={newFileOpen} onClose={() => setNewFileOpen(false)} />
      <InsertOptionsDialog
        isOpen={insertDialogOpen}
        onClose={() => setInsertDialogOpen(false)}
        onInsert={handleInsertAtCursor}
        onReplace={handleReplaceFile}
        onCreateNew={handleCreateNewFile}
        language={activeFileData?.language}
      />

      {/* Conflict UI */}
      {conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-[90vw] max-w-sm rounded-2xl border border-amber-400/15 bg-[#060c18]/95 backdrop-blur-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400/60" />
              <h2 className="text-sm font-semibold text-white/80">Project Updated Elsewhere</h2>
            </div>
            <p className="text-xs text-white/40">
              This project has newer changes from another session. Choose how to proceed.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => resolveConflict('keep_mine')}
                className="flex-1 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5 text-[11px] text-cyan-300 hover:bg-cyan-400/[0.12] transition-all"
              >
                Keep My Changes
              </button>
              <button
                type="button"
                onClick={() => resolveConflict('load_latest')}
                className="flex-1 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-[11px] text-amber-300 hover:bg-amber-400/[0.12] transition-all"
              >
                Load Latest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Panel */}
      {currentProject && (
        <VersionHistoryPanel
          isOpen={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          projectId={currentProject._id}
          onRestore={handleRestoreVersion}
        />
      )}
    </div>
  );
}
