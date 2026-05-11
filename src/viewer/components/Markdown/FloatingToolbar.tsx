import { useEffect, useState, useCallback, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
} from '@milkdown/preset-commonmark';
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm';
import { TextSelection } from '@milkdown/prose/state';

interface ToolbarPosition {
  top: number;
  left: number;
}

export function FloatingToolbar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 });
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [loading, getEditor] = useInstance();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const lastSelectionRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });

  useEffect(() => {
    if (loading) return;

    const handleSelectionChange = () => {
      const editor = getEditor();
      if (!editor) return;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const editorRoot = view.dom.closest('.feishu-wysiwyg__editor');
          if (editorRoot?.querySelector('.feishu-table-handle-toolbar')) {
            setVisible(false);
            setLinkInputOpen(false);
            lastSelectionRef.current = { from: 0, to: 0 };
            return;
          }

          const { state } = view;
          const { from, to } = state.selection;

          if (from === to) {
            setVisible(false);
            setLinkInputOpen(false);
            lastSelectionRef.current = { from: 0, to: 0 };
            return;
          }

          // Only update position if selection changed
          if (
            lastSelectionRef.current.from === from &&
            lastSelectionRef.current.to === to
          ) {
            return;
          }
          lastSelectionRef.current = { from, to };

          // Get the position of the selection in the DOM
          const start = view.coordsAtPos(from);
          const end = view.coordsAtPos(to);

          // Position toolbar above the selection, relative to the editor container
          const editorRect = view.dom.getBoundingClientRect();
          setPosition({
            top: start.top - editorRect.top - 45,
            left: (start.left + end.left) / 2 - editorRect.left,
          });
          setVisible(true);
        });
      } catch {
        // Editor may not be ready yet
      }
    };

    const interval = setInterval(handleSelectionChange, 200);
    return () => clearInterval(interval);
  }, [loading, getEditor]);

  const runCommand = useCallback(
    (commandKey: Parameters<typeof callCommand>[0], payload?: unknown) => {
      const editor = getEditor();
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { from, to } = lastSelectionRef.current;

        if (from !== to && from >= 0 && to <= view.state.doc.content.size) {
          const selection = TextSelection.create(view.state.doc, from, to);
          view.dispatch(view.state.tr.setSelection(selection));
        }

        callCommand(commandKey, payload)(ctx);
        view.dom.blur();
        setVisible(true);
      });
    },
    [getEditor],
  );

  const handleInsertLink = useCallback(() => {
    setVisible(true);
    setLinkInputOpen(true);
  }, []);

  const handleApplyLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) return;
    runCommand(toggleLinkCommand.key, { href: url });
    setLinkInputOpen(false);
    setLinkUrl('');
  }, [linkUrl, runCommand]);

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="feishu-floating-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          runCommand(toggleStrongCommand.key);
        }}
        title="加粗"
        type="button"
      >
        <strong>B</strong>
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          runCommand(toggleEmphasisCommand.key);
        }}
        title="斜体"
        type="button"
      >
        <em>I</em>
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          runCommand(toggleStrikethroughCommand.key);
        }}
        title="删除线"
        type="button"
      >
        <s>S</s>
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          runCommand(toggleInlineCodeCommand.key);
        }}
        title="行内代码"
        type="button"
      >
        <code>{'{}'}</code>
      </button>
      <div className="feishu-floating-toolbar__divider" />
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          handleInsertLink();
        }}
        title="插入链接"
        type="button"
      >
        Link
      </button>
      {linkInputOpen && (
        <div
          className="feishu-floating-toolbar__link-popover"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyLink();
              if (e.key === 'Escape') setLinkInputOpen(false);
            }}
            placeholder="https://"
            autoFocus
          />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleApplyLink();
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
