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

      // Don't hide when hovering the insert button itself
      if (target.closest('.feishu-table-insert-btn') || target.closest('.feishu-table-border-line')) {
        return;
      }

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

      const THRESHOLD = 15; // px distance from border to trigger

      // Check if mouse is near ANY row border (full width of the table)
      const rows = Array.from(table.querySelectorAll('tr'));
      let nearestRow: { index: number; y: number; dist: number } | null = null;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const borderY = row.getBoundingClientRect().top;
        const dist = Math.abs(mouseY - borderY);
        if (dist < THRESHOLD && (!nearestRow || dist < nearestRow.dist)) {
          nearestRow = { index: i, y: borderY - editorRect.top, dist };
        }
      }
      // Bottom edge (append row)
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const bottomEdge = lastRow.getBoundingClientRect().bottom;
        const dist = Math.abs(mouseY - bottomEdge);
        if (dist < THRESHOLD && (!nearestRow || dist < nearestRow.dist)) {
          nearestRow = { index: rows.length, y: bottomEdge - editorRect.top, dist };
        }
      }

      // Check if mouse is near ANY column border (full height of the table)
      const firstRow = table.querySelector('tr');
      let nearestCol: { index: number; x: number; dist: number } | null = null;

      if (firstRow) {
        const cells = Array.from(firstRow.cells);
        for (let i = 1; i < cells.length; i++) {
          const cell = cells[i];
          if (!cell) continue;
          const borderX = cell.getBoundingClientRect().left;
          const dist = Math.abs(mouseX - borderX);
          if (dist < THRESHOLD && (!nearestCol || dist < nearestCol.dist)) {
            nearestCol = { index: i, x: borderX - editorRect.left, dist };
          }
        }
        // Right edge (append column)
        const lastCell = cells[cells.length - 1];
        if (lastCell) {
          const rightEdge = lastCell.getBoundingClientRect().right;
          const dist = Math.abs(mouseX - rightEdge);
          if (dist < THRESHOLD && (!nearestCol || dist < nearestCol.dist)) {
            nearestCol = { index: cells.length, x: rightEdge - editorRect.left, dist };
          }
        }
      }

      // Position button outside the table: rows → left side, cols → top side
      const rowBtnX = tableRect.left - editorRect.left - 20;
      const colBtnY = tableRect.top - editorRect.top - 20;

      // Prefer the closest match (row or col)
      if (nearestRow && nearestCol) {
        if (nearestRow.dist <= nearestCol.dist) {
          setButton({ type: 'row', x: rowBtnX, y: nearestRow.y, index: nearestRow.index });
        } else {
          setButton({ type: 'col', x: nearestCol.x, y: colBtnY, index: nearestCol.index });
        }
      } else if (nearestRow) {
        setButton({ type: 'row', x: rowBtnX, y: nearestRow.y, index: nearestRow.index });
      } else if (nearestCol) {
        setButton({ type: 'col', x: nearestCol.x, y: colBtnY, index: nearestCol.index });
      } else {
        setButton(null);
      }
    };

    // Listen on parent to also catch hover on the insert button itself
    const listenTarget = editorDom.parentElement ?? editorDom;
    listenTarget.addEventListener('mousemove', handleMouseMove);

    return () => {
      listenTarget.removeEventListener('mousemove', handleMouseMove);
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

  if (!button || !tableEl || !editorDomRef.current) return null;

  // Calculate the highlight line position and length
  const tableRect = tableEl.getBoundingClientRect();
  const editorRect = editorDomRef.current.getBoundingClientRect();

  const lineStyle: React.CSSProperties = button.type === 'col'
    ? {
        left: button.x,
        top: tableRect.top - editorRect.top,
        width: '2px',
        height: tableRect.height,
      }
    : {
        left: tableRect.left - editorRect.left,
        top: button.y,
        width: tableRect.width,
        height: '2px',
      };

  return (
    <>
      {/* Highlight line at the border */}
      <div className="feishu-table-border-line" style={lineStyle} />
      {/* Insert button centered on the border */}
      <button
        className="feishu-table-insert-btn"
        style={{ top: button.y, left: button.x }}
        onClick={handleClick}
        onMouseDown={(e) => e.preventDefault()}
        title={button.type === 'col' ? '插入列' : '插入行'}
        aria-label={button.type === 'col' ? '插入列' : '插入行'}
      >
        +
      </button>
    </>
  );
}
