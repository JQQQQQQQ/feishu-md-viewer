import { useEffect, useState, useCallback, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import { TextSelection } from '@milkdown/prose/state';
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
} from '@milkdown/preset-gfm';

interface ButtonState {
  type: 'col' | 'row';
  x: number;
  y: number;
  index: number;
}

/**
 * Feishu-style table border controls.
 * Shows a SINGLE "+" button at the nearest column/row border
 * when the mouse is near the top or left edge of a table.
 */
export function TableOperations() {
  const [loading, getEditor] = useInstance();
  const [button, setButton] = useState<ButtonState | null>(null);
  const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);
  const editorDomRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;

    let dom: HTMLElement | null = null;

    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        dom = view.dom;
      });
    } catch {
      return;
    }

    if (!dom) return;
    // Capture the non-null reference for use in the closure
    const editorDom: HTMLElement = dom;
    editorDomRef.current = editorDom;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const table = target.closest('table');

      if (!table || !(table instanceof HTMLTableElement)) {
        setButton(null);
        setTableEl(null);
        return;
      }

      setTableEl(table);
      const tableRect = table.getBoundingClientRect();
      const editorRect = editorDom.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Near top edge: within 24px above or 8px below the table top
      const nearTop = mouseY >= tableRect.top - 24 && mouseY <= tableRect.top + 8;
      // Near left edge: within 24px left or 8px inside the table left
      const nearLeft = mouseX >= tableRect.left - 24 && mouseX <= tableRect.left + 8;

      if (nearTop) {
        const firstRow = table.querySelector('tr');
        if (!firstRow) {
          setButton(null);
          return;
        }
        const cells = Array.from(firstRow.cells);
        let closestIndex = -1;
        let closestDist = Infinity;
        let closestX = 0;

        // Check borders between columns (left edge of each cell starting from index 1)
        for (let i = 1; i < cells.length; i++) {
          const cell = cells[i];
          if (!cell) continue;
          const cellRect = cell.getBoundingClientRect();
          const borderX = cellRect.left;
          const dist = Math.abs(mouseX - borderX);
          if (dist < closestDist) {
            closestDist = dist;
            closestIndex = i;
            closestX = borderX - editorRect.left;
          }
        }

        // Also check right edge of last cell (append column)
        const lastCell = cells[cells.length - 1];
        if (lastCell) {
          const rightEdge = lastCell.getBoundingClientRect().right;
          const dist = Math.abs(mouseX - rightEdge);
          if (dist < closestDist) {
            closestDist = dist;
            closestIndex = cells.length;
            closestX = rightEdge - editorRect.left;
          }
        }

        if (closestIndex >= 0 && closestDist < 40) {
          setButton({
            type: 'col',
            x: closestX,
            y: tableRect.top - editorRect.top - 14,
            index: closestIndex,
          });
        } else {
          setButton(null);
        }
      } else if (nearLeft) {
        const rows = Array.from(table.querySelectorAll('tr'));
        let closestIndex = -1;
        let closestDist = Infinity;
        let closestY = 0;

        // Check borders between rows (top edge of each row starting from index 1)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const rowRect = row.getBoundingClientRect();
          const borderY = rowRect.top;
          const dist = Math.abs(mouseY - borderY);
          if (dist < closestDist) {
            closestDist = dist;
            closestIndex = i;
            closestY = borderY - editorRect.top;
          }
        }

        // Also check bottom of last row (append row)
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
          const bottomEdge = lastRow.getBoundingClientRect().bottom;
          const dist = Math.abs(mouseY - bottomEdge);
          if (dist < closestDist) {
            closestDist = dist;
            closestIndex = rows.length;
            closestY = bottomEdge - editorRect.top;
          }
        }

        if (closestIndex >= 0 && closestDist < 40) {
          setButton({
            type: 'row',
            x: tableRect.left - editorRect.left - 14,
            y: closestY,
            index: closestIndex,
          });
        } else {
          setButton(null);
        }
      } else {
        setButton(null);
      }
    };

    editorDom.addEventListener('mousemove', handleMouseMove);

    return () => {
      editorDom.removeEventListener('mousemove', handleMouseMove);
    };
  }, [loading, getEditor]);

  const handleClick = useCallback(() => {
    if (!button || !tableEl) return;
    const editor = getEditor();
    if (!editor) return;

    const firstRow = tableEl.querySelector('tr');
    const numCols = firstRow ? firstRow.cells.length : 0;
    const rows = tableEl.querySelectorAll('tr');
    const numRows = rows.length;

    let targetRow: number;
    let targetCol: number;
    let command: typeof addColAfterCommand;

    if (button.type === 'col') {
      if (button.index < numCols) {
        targetRow = 0;
        targetCol = button.index;
        command = addColBeforeCommand;
      } else {
        targetRow = 0;
        targetCol = numCols - 1;
        command = addColAfterCommand;
      }
    } else {
      if (button.index < numRows) {
        targetRow = button.index;
        targetCol = 0;
        command = addRowBeforeCommand;
      } else {
        targetRow = numRows - 1;
        targetCol = 0;
        command = addRowAfterCommand;
      }
    }

    const cell = tableEl.querySelector(
      `tr:nth-child(${targetRow + 1}) > td:nth-child(${targetCol + 1}), ` +
      `tr:nth-child(${targetRow + 1}) > th:nth-child(${targetCol + 1})`
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

      // Small delay to let selection settle before executing command
      setTimeout(() => {
        editor.action(callCommand(command.key));
      }, 10);
    } catch {
      // posAtDOM can fail if DOM is out of sync
    }

    setButton(null);
  }, [button, tableEl, getEditor]);

  if (!button) return null;

  return (
    <button
      className="feishu-table-insert-btn"
      style={{ top: button.y, left: button.x }}
      onClick={handleClick}
      onMouseDown={(e) => e.preventDefault()}
      title={button.type === 'col' ? '插入列' : '插入行'}
      aria-label={button.type === 'col' ? `在第${button.index}列处插入列` : `在第${button.index}行处插入行`}
    >
      +
    </button>
  );
}
