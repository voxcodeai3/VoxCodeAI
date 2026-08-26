import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

export default function CodeEditor({ content, language, onChange, readOnly = false }) {
  const editorRef = useRef(null);

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;

    // Custom dark theme matching VoxCode aesthetic.
    monaco.editor.defineTheme('voxcode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4a5568', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c792ea' },
        { token: 'string', foreground: 'c3e88d' },
        { token: 'number', foreground: 'f78c6c' },
        { token: 'type', foreground: 'ffcb6b' },
        { token: 'function', foreground: '82aaff' },
        { token: 'variable', foreground: 'eeffff' },
        { token: 'operator', foreground: '89ddff' },
      ],
      colors: {
        'editor.background': '#0a0f1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#111827',
        'editor.selectionBackground': '#264f7899',
        'editorCursor.foreground': '#7dd3fc',
        'editorLineNumber.foreground': '#3b4a6b',
        'editorLineNumber.activeForeground': '#7dd3fc',
        'editor.inactiveSelectionBackground': '#264f7844',
        'editorIndentGuide.background': '#1a2240',
        'editorIndentGuide.activeBackground': '#2a3a5c',
        'editorBracketMatch.background': '#264f7844',
        'editorBracketMatch.border': '#7dd3fc55',
        'scrollbar.shadow': '#00000000',
        'scrollbarSlider.background': '#1e293b88',
        'scrollbarSlider.hoverBackground': '#334155aa',
        'scrollbarSlider.activeBackground': '#475569aa',
      },
    });
    monaco.editor.setTheme('voxcode-dark');

    // Keyboard shortcuts.
    editor.addAction({
      id: 'voxcode-copy',
      label: 'Copy Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel().getValueInRange(selection);
        if (selectedText) navigator.clipboard?.writeText(selectedText);
      },
    });
  };

  // Sync external content changes (e.g., AI insert).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    if (model.getValue() !== content) {
      model.setValue(content || '');
    }
  }, [content]);

  const handleChange = (value) => {
    onChange?.(value || '');
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language || 'javascript'}
        value={content || ''}
        onChange={handleChange}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 12 },
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          bracketPairColorization: { enabled: true },
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          readOnly,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          formatOnPaste: true,
          formatOnType: false,
          suggest: { showWords: false },
        }}
        loading={
          <div className="flex h-full items-center justify-center text-xs text-white/20">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
