import { useEffect, useState, useCallback, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import {
  addColBeforeCommand,
  addColAfterCommand,
  addRowBeforeCommand,
  addRowAfterCommand,
  selectRowCommand,
  selectColCommand,
  deleteSelectedCellsCommand,
} from '@milkdown/preset-gfm';

interface ToolbarPosition {
  top: number;
  left: number;
}

interface ProseMirrorNode {
  type: { name: string };
  childCount: number;
  nodeSize: number;
  child: (index: number) => ProseMirrorNode;
}

interface ResolvedPos {
  depth: number;
  node: (d: number) => ProseMirrorNode;
  before: (d: number) => number;
}

interface EditorState {
  selection: { from: number; $from: ResolvedPos };
}

function isInsideTable(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table') {
      return true;
    }
  }
  return false;
}

function getCurrentCellInfo(state: EditorState): { rowIndex: number; colIndex: number } | null {
  const { $from } = state.selection;
  let rowIndex = -1;
  let colIndex = -1;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
      // Find column index among siblings
      const parentRow = $from.node(d - 1);
      const cellPos = $from.before(d);
      const rowStart = $from.before(d - 1) + 1;
      let offset = rowStart;
      for (let i = 0; i < parentRow.childCount; i++) {
        if (offset === cellPos) {
          colIndex = i;
          break;
        }
        offset += parentRow.child(i).nodeSize;
      }
    }
    if (node.type.name === 'table_row' || node.type.name === 'table_header_row') {
      // Find row index among siblings
      const table = $from.node(d - 1);
      const rowPos = $from.before(d);
      const tableStart = $from.before(d - 1) + 1;
      let offset = tableStart;
      for (let i = 0; i < table.childCount; i++) {
        if (offset === rowPos) {
          rowIndex = i;
          break;
        }
        offset += table.child(i).nodeSize;
      }
    }
  }

  if (rowIndex >= 0 && colIndex >= 0) {
    return { rowIndex, colIndex };
  }
  return null;
}

export function TableOperations() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 });
  const [loading, getEditor] = useInstance();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const cellInfoRef = useRef<{ rowIndex: number; colIndex: number } | null>(null);

  useEffect(() => {
    if (loading) return;

    const checkTableFocus = () => {
      const editor = getEditor();
      if (!editor) return;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state } = view;

          if (!isInsideTable(state)) {
            setVisible(false);
            return;
          }

          const cellInfo = getCurrentCellInfo(state);
          if (!cellInfo) {
            setVisible(false);
            return;
          }

          cellInfoRef.current = cellInfo;

          // Get DOM position of the current cell
          const { from } = state.selection;
          const coords = view.coordsAtPos(from);
          const editorRect = view.dom.getBoundingClientRect();

          setPosition({
            top: coords.top - editorRect.top - 40,
            left: coords.left - editorRect.left,
          });
          setVisible(true);
        });
      } catch {
        // Editor may not be ready
      }
    };

    const interval = setInterval(checkTableFocus, 250);
    return () => clearInterval(interval);
  }, [loading, getEditor]);

  const runCommand = useCallback(
    (commandKey: Parameters<typeof callCommand>[0], payload?: unknown) => {
      const editor = getEditor();
      if (!editor) return;
      editor.action(callCommand(commandKey, payload));
    },
    [getEditor],
  );

  const handleDeleteRow = useCallback(() => {
    const editor = getEditor();
    if (!editor || !cellInfoRef.current) return;
    const { rowIndex } = cellInfoRef.current;
    editor.action(callCommand(selectRowCommand.key, { index: rowIndex }));
    // Slight delay to let selection update
    setTimeout(() => {
      editor.action(callCommand(deleteSelectedCellsCommand.key));
    }, 10);
  }, [getEditor]);

  const handleDeleteCol = useCallback(() => {
    const editor = getEditor();
    if (!editor || !cellInfoRef.current) return;
    const { colIndex } = cellInfoRef.current;
    editor.action(callCommand(selectColCommand.key, { index: colIndex }));
    setTimeout(() => {
      editor.action(callCommand(deleteSelectedCellsCommand.key));
    }, 10);
  }, [getEditor]);

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="feishu-table-ops"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        onClick={() => runCommand(addColBeforeCommand.key)}
        title="左侧插入列"
        aria-label="左侧插入列"
      >
        ⇤+
      </button>
      <button
        onClick={() => runCommand(addColAfterCommand.key)}
        title="右侧插入列"
        aria-label="右侧插入列"
      >
        +⇥
      </button>
      <button
        onClick={handleDeleteCol}
        title="删除列"
        aria-label="删除列"
      >
        ×列
      </button>
      <div className="feishu-table-ops__divider" />
      <button
        onClick={() => runCommand(addRowBeforeCommand.key)}
        title="上方插入行"
        aria-label="上方插入行"
      >
        ↑+
      </button>
      <button
        onClick={() => runCommand(addRowAfterCommand.key)}
        title="下方插入行"
        aria-label="下方插入行"
      >
        +↓
      </button>
      <button
        onClick={handleDeleteRow}
        title="删除行"
        aria-label="删除行"
      >
        ×行
      </button>
    </div>
  );
}
