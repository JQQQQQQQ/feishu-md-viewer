import { useEffect, useState } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';

interface ResizeState {
  type: 'col' | 'row';
  table: HTMLTableElement;
  index: number;
  startPos: number;
  startSize: number;
}

/**
 * Table column/row resize by dragging borders inside the table.
 * Shows col-resize cursor on vertical cell borders, row-resize on horizontal.
 * Dragging adjusts width/height via DOM style manipulation (no ProseMirror changes).
 */
export function TableResize() {
  const [loading, getEditor] = useInstance();
  const [resizing, setResizing] = useState<ResizeState | null>(null);

  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;

    let editorDom: HTMLElement | null = null;
    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        editorDom = view.dom;
      });
    } catch {
      return;
    }
    if (!editorDom) return;

    const dom: HTMLElement = editorDom;
    const BORDER_THRESHOLD = 5; // px from border to trigger resize cursor

    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) return; // Don't change cursor while dragging

      const target = e.target as HTMLElement;
      const cell = target.closest('td, th') as HTMLTableCellElement | null;
      if (!cell) {
        dom.style.cursor = '';
        return;
      }

      const cellRect = cell.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Check if near the RIGHT edge of the cell (column resize)
      const nearRightEdge = Math.abs(mouseX - cellRect.right) < BORDER_THRESHOLD;
      // Check if near the LEFT edge of the cell (column resize, for non-first cells)
      const nearLeftEdge = Math.abs(mouseX - cellRect.left) < BORDER_THRESHOLD && cell.cellIndex > 0;
      // Check if near the BOTTOM edge of the cell (row resize)
      const nearBottomEdge = Math.abs(mouseY - cellRect.bottom) < BORDER_THRESHOLD;

      if (nearRightEdge || nearLeftEdge) {
        dom.style.cursor = 'col-resize';
      } else if (nearBottomEdge) {
        dom.style.cursor = 'row-resize';
      } else {
        dom.style.cursor = '';
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('td, th') as HTMLTableCellElement | null;
      if (!cell) return;

      const table = cell.closest('table');
      if (!table || !(table instanceof HTMLTableElement)) return;

      const cellRect = cell.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const nearRightEdge = Math.abs(mouseX - cellRect.right) < BORDER_THRESHOLD;
      const nearLeftEdge = Math.abs(mouseX - cellRect.left) < BORDER_THRESHOLD && cell.cellIndex > 0;
      const nearBottomEdge = Math.abs(mouseY - cellRect.bottom) < BORDER_THRESHOLD;

      if (nearRightEdge) {
        e.preventDefault();
        const colIndex = cell.cellIndex;
        setResizing({
          type: 'col',
          table,
          index: colIndex,
          startPos: mouseX,
          startSize: cellRect.width,
        });
      } else if (nearLeftEdge) {
        e.preventDefault();
        const colIndex = cell.cellIndex - 1;
        const row = cell.parentElement as HTMLTableRowElement | null;
        const prevCell = row?.cells[colIndex];
        if (prevCell) {
          setResizing({
            type: 'col',
            table,
            index: colIndex,
            startPos: mouseX,
            startSize: prevCell.getBoundingClientRect().width,
          });
        }
      } else if (nearBottomEdge) {
        e.preventDefault();
        const row = cell.closest('tr');
        if (!row) return;
        const rowIndex = row.rowIndex;
        setResizing({
          type: 'row',
          table,
          index: rowIndex,
          startPos: mouseY,
          startSize: row.getBoundingClientRect().height,
        });
      }
    };

    dom.addEventListener('mousemove', handleMouseMove);
    dom.addEventListener('mousedown', handleMouseDown);

    return () => {
      dom.removeEventListener('mousemove', handleMouseMove);
      dom.removeEventListener('mousedown', handleMouseDown);
      dom.style.cursor = '';
    };
  }, [loading, getEditor, resizing]);

  // Handle drag
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { type, table, index, startPos, startSize } = resizing;

      if (type === 'col') {
        const delta = e.clientX - startPos;
        const newWidth = Math.max(50, startSize + delta); // min 50px

        // Set width on all cells in this column
        const rows = table.querySelectorAll('tr');
        rows.forEach((row) => {
          const cell = (row as HTMLTableRowElement).cells[index];
          if (cell) {
            cell.style.width = `${newWidth}px`;
            cell.style.minWidth = `${newWidth}px`;
          }
        });

        // Use auto layout to allow resize
        table.style.tableLayout = 'auto';
      } else {
        const delta = e.clientY - startPos;
        const newHeight = Math.max(30, startSize + delta); // min 30px
        const row = table.rows[index];
        if (row) {
          row.style.height = `${newHeight}px`;
        }
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = resizing.type === 'col' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  return null; // This component only adds event listeners, renders nothing
}
