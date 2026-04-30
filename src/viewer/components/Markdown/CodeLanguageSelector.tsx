import { useEffect, useState, useCallback, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import { updateCodeBlockLanguageCommand } from '@milkdown/preset-commonmark';

interface SelectorPosition {
  top: number;
  left: number;
}

const LANGUAGES = [
  { value: '', label: '纯文本' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'swift', label: 'Swift' },
  { value: 'dart', label: 'Dart' },
];

function findCodeBlockInfo(state: {
  selection: { $from: { depth: number; node: (d: number) => { type: { name: string }; attrs: Record<string, unknown> }; before: (d: number) => number } };
}): { pos: number; language: string } | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'code_block') {
      return {
        pos: $from.before(d),
        language: (node.attrs.language as string) || '',
      };
    }
  }
  return null;
}

export function CodeLanguageSelector() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<SelectorPosition>({ top: 0, left: 0 });
  const [currentLanguage, setCurrentLanguage] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, getEditor] = useInstance();
  const containerRef = useRef<HTMLDivElement>(null);
  const codeBlockPosRef = useRef<number>(-1);

  useEffect(() => {
    if (loading) return;

    const checkCodeBlockFocus = () => {
      const editor = getEditor();
      if (!editor) return;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state } = view;

          const info = findCodeBlockInfo(state);
          if (!info) {
            setVisible(false);
            setDropdownOpen(false);
            return;
          }

          codeBlockPosRef.current = info.pos;
          setCurrentLanguage(info.language);

          // Position at the top-right corner of the code block
          const domNode = view.nodeDOM(info.pos);
          if (!domNode || !(domNode instanceof HTMLElement)) {
            setVisible(false);
            return;
          }

          const blockRect = domNode.getBoundingClientRect();
          const editorRect = view.dom.getBoundingClientRect();

          setPosition({
            top: blockRect.top - editorRect.top + 4,
            left: blockRect.right - editorRect.left - 120,
          });
          setVisible(true);
        });
      } catch {
        // Editor may not be ready
      }
    };

    const interval = setInterval(checkCodeBlockFocus, 250);
    return () => clearInterval(interval);
  }, [loading, getEditor]);

  const handleLanguageChange = useCallback(
    (language: string) => {
      const editor = getEditor();
      if (!editor) return;

      const pos = codeBlockPosRef.current;
      if (pos < 0) return;

      editor.action(callCommand(updateCodeBlockLanguageCommand.key, { pos, language }));
      setCurrentLanguage(language);
      setDropdownOpen(false);
    },
    [getEditor],
  );

  const handleToggleDropdown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen((prev) => !prev);
  }, []);

  if (!visible) return null;

  const displayLabel = LANGUAGES.find((l) => l.value === currentLanguage)?.label || currentLanguage || '纯文本';

  return (
    <div
      ref={containerRef}
      className="feishu-code-lang"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        className="feishu-code-lang__trigger"
        onClick={handleToggleDropdown}
        title="选择语言"
        aria-label="选择代码语言"
        aria-expanded={dropdownOpen}
      >
        {displayLabel}
        <span className="feishu-code-lang__arrow">{dropdownOpen ? '▴' : '▾'}</span>
      </button>
      {dropdownOpen && (
        <div className="feishu-code-lang__dropdown" role="listbox">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              className={`feishu-code-lang__option ${lang.value === currentLanguage ? 'active' : ''}`}
              role="option"
              aria-selected={lang.value === currentLanguage}
              onClick={() => handleLanguageChange(lang.value)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
