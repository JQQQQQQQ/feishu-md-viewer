import { useEffect, useState, useCallback, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import { toggleStrongCommand } from '@milkdown/preset-commonmark';
import { toggleEmphasisCommand } from '@milkdown/preset-commonmark';
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm';

interface ToolbarPosition {
  top: number;
  left: number;
}

export function FloatingToolbar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 });
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
          const { state } = view;
          const { from, to } = state.selection;

          if (from === to) {
            setVisible(false);
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
    (commandKey: Parameters<typeof callCommand>[0]) => {
      const editor = getEditor();
      if (!editor) return;
      editor.action(callCommand(commandKey));
    },
    [getEditor],
  );

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="feishu-floating-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        onClick={() => runCommand(toggleStrongCommand.key)}
        title="加粗"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => runCommand(toggleEmphasisCommand.key)}
        title="斜体"
      >
        <em>I</em>
      </button>
      <button
        onClick={() => runCommand(toggleStrikethroughCommand.key)}
        title="删除线"
      >
        <s>S</s>
      </button>
    </div>
  );
}
