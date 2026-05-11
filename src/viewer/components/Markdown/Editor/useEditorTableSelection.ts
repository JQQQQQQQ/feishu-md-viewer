import { useEffect, useRef } from 'react';
import {
  clearTableSelection,
  getWholeTableSelection,
  renderTableSelection,
  renderTableSelectionHtml,
  type CellPoint,
  type SelectionState,
} from '../FeishuTableSelection';

interface CopiedTable {
  text: string;
  html: string;
}

function getCell(target: EventTarget | null): HTMLTableCellElement | null {
  return target instanceof Element ? target.closest('th,td') : null;
}

function getCellFromPoint(event: MouseEvent): HTMLTableCellElement | null {
  const pathCell = event.composedPath().map((target) => getCell(target)).find(Boolean);
  if (pathCell) return pathCell;

  return getCell(document.elementFromPoint(event.clientX, event.clientY));
}

function getCellPoint(cell: HTMLTableCellElement): CellPoint {
  return {
    row: cell.parentElement instanceof HTMLTableRowElement ? cell.parentElement.rowIndex : 0,
    col: cell.cellIndex,
  };
}

function isInside(node: Node | null, event: Event): boolean {
  return Boolean(node && event.composedPath().includes(node));
}

function clearContainerTableSelection(container: HTMLElement): void {
  container.querySelectorAll('table').forEach((table) => {
    if (table instanceof HTMLTableElement) clearTableSelection(table);
  });
}

export function useEditorTableSelection(container: HTMLElement | null, enabled: boolean) {
  const activeTableRef = useRef<HTMLTableElement | null>(null);
  const selectionRef = useRef<SelectionState | null>(null);
  const copiedRef = useRef<CopiedTable>({ text: '', html: '' });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!container) return undefined;
    if (!enabled) {
      clearContainerTableSelection(container);
      activeTableRef.current = null;
      selectionRef.current = null;
      copiedRef.current = { text: '', html: '' };
      isDraggingRef.current = false;
      return undefined;
    }

    const applySelection = (table: HTMLTableElement, selection: SelectionState) => {
      activeTableRef.current = table;
      selectionRef.current = selection;
      copiedRef.current = {
        text: renderTableSelection(table, selection),
        html: renderTableSelectionHtml(table, selection),
      };
    };

    const clearSelection = () => {
      if (activeTableRef.current) clearTableSelection(activeTableRef.current);
      activeTableRef.current = null;
      selectionRef.current = null;
      copiedRef.current = { text: '', html: '' };
      isDraggingRef.current = false;
    };

    const extendSelectionToCell = (cell: HTMLTableCellElement) => {
      const table = activeTableRef.current;
      const selection = selectionRef.current;
      if (!table || !selection || !table.contains(cell)) return;

      applySelection(table, {
        anchor: selection.anchor,
        focus: getCellPoint(cell),
      });
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;

      const cell = getCell(event.target);
      const table = cell?.closest('table');
      if (!cell || !(table instanceof HTMLTableElement) || !container.contains(table)) return;

      event.preventDefault();
      event.stopPropagation();
      window.getSelection()?.removeAllRanges();
      isDraggingRef.current = true;
      applySelection(table, { anchor: getCellPoint(cell), focus: getCellPoint(cell) });
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const cell = getCellFromPoint(event);
      if (cell) extendSelectionToCell(cell);
    };

    const handleMouseOver = (event: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const cell = getCell(event.target);
      if (cell) extendSelectionToCell(cell);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const table = activeTableRef.current;
      if (!table || isInside(table, event)) return;
      clearSelection();
    };

    const handleCopy = (event: ClipboardEvent) => {
      if (!copiedRef.current.text) return;

      event.preventDefault();
      event.clipboardData?.setData('text/plain', copiedRef.current.text);
      event.clipboardData?.setData('text/html', copiedRef.current.html);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      const table = activeTableRef.current;
      if (event.key.toLowerCase() === 'a' && table) {
        const wholeTable = getWholeTableSelection(table);
        if (!wholeTable) return;

        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        applySelection(table, wholeTable);
        return;
      }

      // Let the browser emit the native copy event so we can provide both
      // text/plain and text/html for Excel-style pasting.
    };

    container.addEventListener('mousedown', handleMouseDown, true);
    container.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [container]);
}
