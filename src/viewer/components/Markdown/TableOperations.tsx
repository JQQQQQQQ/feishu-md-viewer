import { useEffect, useState, useCallback, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import { TextSelection } from '@milkdown/prose/state';
import {
  addColAfterCommand,
  addRowAfterCommand,
  selectRowCommand,
  selectColCommand,
  deleteSelectedCellsCommand,
} from '@milkdown/preset-gfm';

interface BorderPosition {
  x: number;
  y: number;
}

interface CellPosition {
  centerX: number;
  centerY: number;
  index: number;
}

/**
 * Feishu-style table border controls.
 * Shows "+" buttons between columns/rows for insertion,
 * and handle buttons for column/row deletion on hover.
 */
export function TableOperations() {
  const [loading, getEditor] = useInstance();
  const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);
  const [hovering, setHovering] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect table hover via mousemove on the editor root
  useEffect(() => {
    if (loading) return;

    const editor = getEditor();
    if (!editor) return;

    let cleanupFn: (() => void) | undefined;

    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);

        const handleMouseMove = (e: MouseEvent) => {
          const target = (e.target as HTMLElement).closest('table');
          if (target && target instanceof HTMLTableElement) {
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current);
              hideTimeoutRef.current = null;
            }
            setTableEl(target);
            setHovering(true);
          } else {
            // Delay hiding to allow interaction with overlay buttons
            if (!hideTimeoutRef.current) {
              hideTimeoutRef.current = setTimeout(() => {
                if (!overlayRef.current?.matches(':hover')) {
                  setHovering(false);
                }
                hideTimeoutRef.current = null;
              }, 200);
            }
          }
        };

        view.dom.addEventListener('mousemove', handleMouseMove);
        cleanupFn = () => {
          view.dom.removeEventListener('mousemove', handleMouseMove);
        };
      });
    } catch {
      // Editor not ready
    }

    return () => {
      if (cleanupFn) cleanupFn();
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [loading, getEditor]);

  // Move cursor into a specific cell, then execute a command
  const moveCursorToCell = useCallback(
    (rowIndex: number, colIndex: number, callback: () => void) => {
      if (!tableEl) return;
      const editor = getEditor();
      if (!editor) return;

      const cell = tableEl.querySelector(
        `tr:nth-child(${rowIndex + 1}) > td:nth-child(${colIndex + 1}), ` +
        `tr:nth-child(${rowIndex + 1}) > th:nth-child(${colIndex + 1})`
      );
      if (!cell) return;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const pos = view.posAtDOM(cell, 0);
          const sel = TextSelection.create(view.state.doc, pos);
          view.dispatch(view.state.tr.setSelection(sel));
          view.focus();
        });

        // Small delay to let selection settle before command
        setTimeout(callback, 10);
      } catch {
        // posAtDOM can fail if DOM is out of sync
      }
    },
    [tableEl, getEditor],
  );

  const insertColumnAt = useCallback(
    (colIndex: number) => {
      // Insert after column at colIndex (0-based)
      // Move cursor to first row, target column, then addColAfter
      moveCursorToCell(0, colIndex, () => {
        const editor = getEditor();
        if (!editor) return;
        editor.action(callCommand(addColAfterCommand.key));
      });
    },
    [moveCursorToCell, getEditor],
  );

  const insertRowAt = useCallback(
    (rowIndex: number) => {
      // Insert after row at rowIndex (0-based)
      // Move cursor to target row, first column, then addRowAfter
      moveCursorToCell(rowIndex, 0, () => {
        const editor = getEditor();
        if (!editor) return;
        editor.action(callCommand(addRowAfterCommand.key));
      });
    },
    [moveCursorToCell, getEditor],
  );

  const deleteColumn = useCallback(
    (colIndex: number) => {
      const editor = getEditor();
      if (!editor) return;
      editor.action(callCommand(selectColCommand.key, { index: colIndex }));
      setTimeout(() => {
        editor.action(callCommand(deleteSelectedCellsCommand.key));
      }, 10);
    },
    [getEditor],
  );

  const deleteRow = useCallback(
    (rowIndex: number) => {
      const editor = getEditor();
      if (!editor) return;
      editor.action(callCommand(selectRowCommand.key, { index: rowIndex }));
      setTimeout(() => {
        editor.action(callCommand(deleteSelectedCellsCommand.key));
      }, 10);
    },
    [getEditor],
  );

  if (!hovering || !tableEl) return null;

  // Compute positions relative to the editor container
  const editorEl = tableEl.closest('.feishu-wysiwyg__editor');
  if (!editorEl) return null;

  const tableRect = tableEl.getBoundingClientRect();
  const editorRect = editorEl.getBoundingClientRect();

  // Get column borders from first row cells
  const firstRow = tableEl.querySelector('tr');
  const cells = firstRow ? Array.from(firstRow.cells) : [];

  const colBorders: BorderPosition[] = [];
  cells.forEach((cell, i) => {
    if (i > 0) {
      const rect = cell.getBoundingClientRect();
      colBorders.push({
        x: rect.left - editorRect.left,
        y: tableRect.top - editorRect.top - 12,
      });
    }
  });

  // Get row borders from tr elements
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  const rowBorders: BorderPosition[] = [];
  rows.forEach((row, i) => {
    if (i > 0) {
      const rect = row.getBoundingClientRect();
      rowBorders.push({
        x: tableRect.left - editorRect.left - 12,
        y: rect.top - editorRect.top,
      });
    }
  });

  // Column handle positions (center of each column header)
  const colHandles: CellPosition[] = cells.map((cell, i) => {
    const rect = cell.getBoundingClientRect();
    return {
      centerX: rect.left + rect.width / 2 - editorRect.left,
      centerY: tableRect.top - editorRect.top - 20,
      index: i,
    };
  });

  // Row handle positions (center-left of each row)
  const rowHandles: CellPosition[] = rows.map((row, i) => {
    const rect = row.getBoundingClientRect();
    return {
      centerX: tableRect.left - editorRect.left - 20,
      centerY: rect.top + rect.height / 2 - editorRect.top,
      index: i,
    };
  });

  return (
    <div
      ref={overlayRef}
      className="feishu-table-border-controls"
      style={{
        top: 0,
        left: 0,
        width: editorRect.width,
        height: editorRect.height,
      }}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Column insert "+" buttons at top border between columns */}
      {colBorders.map((pos, i) => (
        <button
          key={`col-add-${i}`}
          className="feishu-table-border-controls__col-btn"
          style={{ left: pos.x, top: pos.y }}
          onClick={() => insertColumnAt(i)}
          onMouseDown={(e) => e.preventDefault()}
          title="插入列"
          aria-label={`在第${i + 1}列后插入列`}
        >
          <span>+</span>
        </button>
      ))}

      {/* Row insert "+" buttons at left border between rows */}
      {rowBorders.map((pos, i) => (
        <button
          key={`row-add-${i}`}
          className="feishu-table-border-controls__row-btn"
          style={{ left: pos.x, top: pos.y }}
          onClick={() => insertRowAt(i)}
          onMouseDown={(e) => e.preventDefault()}
          title="插入行"
          aria-label={`在第${i + 1}行后插入行`}
        >
          <span>+</span>
        </button>
      ))}

      {/* Column handles for selection/deletion */}
      {colHandles.map((handle) => (
        <button
          key={`col-handle-${handle.index}`}
          className="feishu-table-border-controls__col-handle"
          style={{ left: handle.centerX, top: handle.centerY }}
          onClick={() => deleteColumn(handle.index)}
          onMouseDown={(e) => e.preventDefault()}
          title="删除列"
          aria-label={`删除第${handle.index + 1}列`}
        >
          &times;
        </button>
      ))}

      {/* Row handles for selection/deletion */}
      {rowHandles.map((handle) => (
        <button
          key={`row-handle-${handle.index}`}
          className="feishu-table-border-controls__row-handle"
          style={{ left: handle.centerX, top: handle.centerY }}
          onClick={() => deleteRow(handle.index)}
          onMouseDown={(e) => e.preventDefault()}
          title="删除行"
          aria-label={`删除第${handle.index + 1}行`}
        >
          &times;
        </button>
      ))}
    </div>
  );
}
