import { useEffect, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';

/**
 * Table column/row resize by dragging borders inside the table.
 * Shows col-resize cursor on vertical cell borders, row-resize on horizontal.
 * Dragging adjusts width/height via DOM style manipulation (no ProseMirror changes).
 *
 * Fix: Uses refs and closure-based drag handling to avoid React re-render issues.
 * The entire drag cycle (mousedown → mousemove → mouseup) is handled in a single
 * closure without any React state changes that could break event listeners.
 */
export function TableResize() {
  const [loading, getEditor] = useInstance();
  const isDraggingRef = useRef(false);

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
      // Don't change cursor while dragging (drag uses document-level listeners)
      if (isDraggingRef.current) return;

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
      const nearLeftEdge =
        Math.abs(mouseX - cellRect.left) < BORDER_THRESHOLD && cell.cellIndex > 0;
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
      const nearLeftEdge =
        Math.abs(mouseX - cellRect.left) < BORDER_THRESHOLD && cell.cellIndex > 0;
      const nearBottomEdge = Math.abs(mouseY - cellRect.bottom) < BORDER_THRESHOLD;

      if (nearRightEdge || nearLeftEdge) {
        e.preventDefault();
        isDraggingRef.current = true;

        const colIndex = nearRightEdge ? cell.cellIndex : cell.cellIndex - 1;
        const row = cell.parentElement as HTMLTableRowElement | null;
        const refCell = row?.cells[colIndex];
        if (!refCell) return;

        const startX = mouseX;
        const startWidth = refCell.getBoundingClientRect().width;

        // Switch to auto layout to allow resize
        table.style.tableLayout = 'auto';

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (ev: MouseEvent) => {
          const delta = ev.clientX - startX;
          const newWidth = Math.max(50, startWidth + delta);

          // Apply width to all cells in this column
          const rows = table.querySelectorAll('tr');
          rows.forEach((r) => {
            const c = (r as HTMLTableRowElement).cells[colIndex];
            if (c) {
              c.style.width = `${newWidth}px`;
              c.style.minWidth = `${newWidth}px`;
            }
          });
        };

        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          isDraggingRef.current = false;
          dom.style.cursor = '';
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      } else if (nearBottomEdge) {
        e.preventDefault();
        isDraggingRef.current = true;

        const row = cell.closest('tr');
        if (!row) return;

        const startY = mouseY;
        const startHeight = row.getBoundingClientRect().height;

        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        const onMove = (ev: MouseEvent) => {
          const delta = ev.clientY - startY;
          const newHeight = Math.max(30, startHeight + delta);
          row.style.height = `${newHeight}px`;
        };

        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          isDraggingRef.current = false;
          dom.style.cursor = '';
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }
    };

    dom.addEventListener('mousemove', handleMouseMove);
    dom.addEventListener('mousedown', handleMouseDown);

    return () => {
      dom.removeEventListener('mousemove', handleMouseMove);
      dom.removeEventListener('mousedown', handleMouseDown);
      dom.style.cursor = '';
    };
  }, [loading, getEditor]);

  return null; // This component only adds event listeners, renders nothing
}
