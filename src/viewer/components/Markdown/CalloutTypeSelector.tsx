import { useCallback, useEffect, useRef, useState } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import type { Node as ProseNode } from '@milkdown/prose/model';

type CalloutType = 'quote' | 'NOTE' | 'TIP' | 'WARNING' | 'IMPORTANT' | 'CAUTION';

interface SelectorPosition {
  top: number;
  left: number;
}

interface BlockquoteInfo {
  pos: number;
  node: ProseNode;
  currentType: CalloutType;
}

interface FirstTextInfo {
  pos: number;
  text: string;
}

const CALLOUT_OPTIONS: { value: CalloutType; label: string }[] = [
  { value: 'quote', label: '引用' },
  { value: 'NOTE', label: '提示' },
  { value: 'TIP', label: '建议' },
  { value: 'WARNING', label: '警告' },
  { value: 'IMPORTANT', label: '重点' },
  { value: 'CAUTION', label: '风险' },
];

const CALLOUT_MARKER = /^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\][ \t]*(?:\n)?/i;

function getCalloutType(text: string): CalloutType {
  const match = CALLOUT_MARKER.exec(text);
  return (match?.[1]?.toUpperCase() as CalloutType | undefined) ?? 'quote';
}

function findBlockquoteInfo(state: {
  selection: { $from: { depth: number; node: (depth: number) => ProseNode; before: (depth: number) => number } };
}): BlockquoteInfo | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== 'blockquote') continue;

    return {
      node,
      pos: $from.before(depth),
      currentType: getCalloutType(node.textContent),
    };
  }
  return null;
}

function findFirstText(node: ProseNode, blockquotePos: number): FirstTextInfo | null {
  let result: FirstTextInfo | null = null;
  node.descendants((child, pos) => {
    if (result) return false;
    if (!child.isText) return true;
    result = {
      pos: blockquotePos + 1 + pos,
      text: child.text ?? '',
    };
    return false;
  });
  return result;
}

function findFirstEditablePos(node: ProseNode, blockquotePos: number): number {
  let pos = blockquotePos + 1;
  node.descendants((child, childPos) => {
    if (child.isTextblock) {
      pos = blockquotePos + 1 + childPos + 1;
      return false;
    }
    return true;
  });
  return pos;
}

export function CalloutTypeSelector() {
  const [loading, getEditor] = useInstance();
  const [visible, setVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [position, setPosition] = useState<SelectorPosition>({ top: 0, left: 0 });
  const [currentType, setCurrentType] = useState<CalloutType>('quote');
  const blockquoteInfoRef = useRef<BlockquoteInfo | null>(null);

  useEffect(() => {
    if (loading) return;

    const timer = window.setInterval(() => {
      const editor = getEditor();
      if (!editor) return;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const info = findBlockquoteInfo(view.state);
          if (!info) {
            setVisible(false);
            setDropdownOpen(false);
            blockquoteInfoRef.current = null;
            return;
          }

          const domNode = view.nodeDOM(info.pos);
          if (!(domNode instanceof HTMLElement)) {
            setVisible(false);
            return;
          }

          blockquoteInfoRef.current = info;
          setCurrentType(info.currentType);

          const blockRect = domNode.getBoundingClientRect();
          const editorRect = view.dom.getBoundingClientRect();
          setPosition({
            top: blockRect.top - editorRect.top + 6,
            left: blockRect.right - editorRect.left - 120,
          });
          setVisible(true);
        });
      } catch {
        setVisible(false);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [loading, getEditor]);

  const handleTypeChange = useCallback((type: CalloutType) => {
    const editor = getEditor();
    const info = blockquoteInfoRef.current;
    if (!editor || !info) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(info.pos);
      if (!node || node.type.name !== 'blockquote') return;

      const firstText = findFirstText(node, info.pos);
      const nextMarker = type === 'quote' ? '' : `[!${type}] `;
      let tr = view.state.tr;

      if (firstText) {
        const match = CALLOUT_MARKER.exec(firstText.text);
        if (match) {
          tr = nextMarker
            ? tr.replaceWith(
                firstText.pos + match.index,
                firstText.pos + match.index + match[0].length,
                view.state.schema.text(nextMarker),
              )
            : tr.delete(firstText.pos + match.index, firstText.pos + match.index + match[0].length);
        } else if (nextMarker) {
          tr = tr.insertText(nextMarker, firstText.pos);
        }
      } else if (nextMarker) {
        tr = tr.insertText(nextMarker, findFirstEditablePos(node, info.pos));
      }

      if (tr.docChanged) view.dispatch(tr);
    });

    setCurrentType(type);
    setDropdownOpen(false);
  }, [getEditor]);

  if (!visible) return null;

  const currentLabel = CALLOUT_OPTIONS.find((option) => option.value === currentType)?.label ?? '引用';

  return (
    <div
      className="feishu-code-lang feishu-callout-type"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        className="feishu-code-lang__trigger"
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDropdownOpen((open) => !open);
        }}
        aria-label="切换 Callout 类型"
        aria-expanded={dropdownOpen}
        title="切换 Callout 类型"
      >
        {currentLabel}
        <span className="feishu-code-lang__arrow">{dropdownOpen ? '▴' : '▾'}</span>
      </button>
      {dropdownOpen && (
        <div className="feishu-code-lang__dropdown" role="listbox">
          {CALLOUT_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`feishu-code-lang__option ${option.value === currentType ? 'active' : ''}`}
              type="button"
              role="option"
              aria-selected={option.value === currentType}
              onClick={() => handleTypeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
