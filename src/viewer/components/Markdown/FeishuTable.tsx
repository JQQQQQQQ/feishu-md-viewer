import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { getTableLayoutMode, updateTableWideWidth, type TableLayoutMode } from './FeishuTableLayout';
import {
  clearTableSelection,
  getWholeTableSelection,
  renderTableSelection,
  renderTableSelectionHtml,
  type CellPoint,
  type SelectionState,
} from './FeishuTableSelection';
import { persistTableColumnWidths, restorePersistedTableColumnWidths } from './FeishuTableColumnWidths';

interface FeishuTableProps extends HTMLAttributes<HTMLTableElement> { children?: ReactNode }

const RESIZE_EDGE_THRESHOLD = 6;
const MIN_COLUMN_WIDTH = 80;

function getCell(target: EventTarget | null): HTMLTableCellElement | null {
  return target instanceof Element ? target.closest('th,td') : null;
}

function getCellFromEvent(event: Event): HTMLTableCellElement | null {
  const path = event.composedPath();
  for (const target of path) {
    const cell = getCell(target);
    if (cell) return cell;
  }

  return getCell(event.target);
}

function eventPathContains(event: Event, node: Node): boolean { return event.composedPath().includes(node) }

function mergeClassName(base: string, className?: string): string { return className ? `${base} ${className}` : base }

function getActiveElement(node: HTMLElement): Element | null {
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.activeElement : document.activeElement;
}

function getCellPoint(cell: HTMLTableCellElement): CellPoint {
  return {
    row: cell.parentElement instanceof HTMLTableRowElement ? cell.parentElement.rowIndex : 0,
    col: cell.cellIndex,
  };
}

function getResizableColumnIndex(cell: HTMLTableCellElement, clientX: number): number | null {
  const rect = cell.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const nearRightEdge = Math.abs(clientX - rect.right) <= RESIZE_EDGE_THRESHOLD;
  const nearLeftEdge = cell.cellIndex > 0 && Math.abs(clientX - rect.left) <= RESIZE_EDGE_THRESHOLD;

  if (nearRightEdge) return cell.cellIndex;
  if (nearLeftEdge) return cell.cellIndex - 1;
  return null;
}

function applyColumnWidth(table: HTMLTableElement, colIndex: number, width: number): void {
  Array.from(table.rows).forEach((row) => {
    const cell = row.cells[colIndex];
    if (!cell) return;

    cell.style.width = `${width}px`;
    cell.style.minWidth = `${width}px`;
  });
}

export function FeishuTable({ children, className, ...props }: FeishuTableProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const selectionRef = useRef<SelectionState | null>(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const copiedRef = useRef({ text: '', html: '' });
  const [layoutMode, setLayoutMode] = useState<TableLayoutMode>('normal');

  const applySelection = useCallback((selection: SelectionState) => {
    const table = tableRef.current;
    if (!table) return;

    selectionRef.current = selection;
    copiedRef.current = {
      text: renderTableSelection(table, selection),
      html: renderTableSelectionHtml(table, selection),
    };
  }, []);

  const extendSelectionToCell = useCallback((cell: HTMLTableCellElement) => {
    if (!selectionRef.current) return;

    applySelection({
      anchor: selectionRef.current.anchor,
      focus: getCellPoint(cell),
    });
  }, [applySelection]);

  const resetSelection = useCallback(() => {
    const table = tableRef.current;
    if (table) clearTableSelection(table);
    selectionRef.current = null;
    copiedRef.current = { text: '', html: '' };
  }, []);

  const handleMouseDown = useCallback((event: MouseEvent<HTMLTableElement>) => {
    if (event.button !== 0) return;

    const cell = getCell(event.target);
    if (!cell) return;

    const table = tableRef.current;
    const resizableColIndex = getResizableColumnIndex(cell, event.clientX);
    if (table && resizableColIndex !== null) {
      event.preventDefault();
      event.stopPropagation();
      isResizingRef.current = true;
      isDraggingRef.current = false;

      const referenceCell = Array.from(table.rows)
        .map((row) => row.cells[resizableColIndex])
        .find(Boolean);
      const startX = event.clientX;
      const startWidth = referenceCell?.getBoundingClientRect().width ?? cell.getBoundingClientRect().width;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleResizeMove = (moveEvent: globalThis.MouseEvent) => {
        const nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX);
        applyColumnWidth(table, resizableColIndex, nextWidth);
      };

      const handleResizeEnd = () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        persistTableColumnWidths(table);
        isResizingRef.current = false;
      };

      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return;
    }

    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    wrapperRef.current?.focus();

    const point = getCellPoint(cell);
    isDraggingRef.current = true;
    applySelection({ anchor: point, focus: point });
  }, [applySelection]);

  const handleMouseOver = useCallback((event: MouseEvent<HTMLTableElement>) => {
    if (isResizingRef.current || !isDraggingRef.current || !selectionRef.current) return;

    const cell = getCell(event.target);
    if (!cell) return;

    extendSelectionToCell(cell);
  }, [extendSelectionToCell]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const table = tableRef.current;
    if (!wrapper || !table) return undefined;

    const updateWideLayout = () => {
      const nextMode = getTableLayoutMode(table);
      updateTableWideWidth(wrapper, nextMode);
      setLayoutMode(nextMode);
    };

    restorePersistedTableColumnWidths(table);
    updateWideLayout();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWideLayout);
      return () => window.removeEventListener('resize', updateWideLayout);
    }

    const observer = new ResizeObserver(updateWideLayout);
    observer.observe(wrapper);
    observer.observe(table);
    window.addEventListener('resize', updateWideLayout);

    return () => {
      observer.disconnect(); window.removeEventListener('resize', updateWideLayout);
    };
  }, [children]);

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (isResizingRef.current) return;
      if (!isDraggingRef.current) {
        const wrapper = wrapperRef.current;
        const table = tableRef.current;
        const cell = getCellFromEvent(event) ?? getCell(document.elementFromPoint(event.clientX, event.clientY));
        if (!wrapper || !table || !cell || !table.contains(cell)) {
          if (wrapper) wrapper.style.cursor = '';
          return;
        }

        wrapper.style.cursor = getResizableColumnIndex(cell, event.clientX) === null ? '' : 'col-resize';
        return;
      }

      const cell = getCellFromEvent(event) ?? getCell(document.elementFromPoint(event.clientX, event.clientY));
      if (!cell || !tableRef.current?.contains(cell)) return;

      extendSelectionToCell(cell);
    };

    const handleMouseUp = () => { isDraggingRef.current = false };

    const handleCopy = (event: ClipboardEvent) => {
      if (!copiedRef.current.text) return;

      event.preventDefault();
      event.clipboardData?.setData('text/plain', copiedRef.current.text);
      event.clipboardData?.setData('text/html', copiedRef.current.html);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const wrapper = wrapperRef.current;
      const table = tableRef.current;
      const activeElement = wrapper ? getActiveElement(wrapper) : null;
      const isTableActive = Boolean(wrapper && activeElement && wrapper.contains(activeElement));

      if (event.key.toLowerCase() === 'a' && isTableActive && table) {
        const nextSelection = getWholeTableSelection(table);
        if (!nextSelection) return;

        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        applySelection(nextSelection);
        return;
      }

      if (!copiedRef.current.text || event.key.toLowerCase() !== 'c') return;

      event.preventDefault();
      void navigator.clipboard?.writeText(copiedRef.current.text);
    };

    const handleMouseDown = (event: globalThis.MouseEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper || eventPathContains(event, wrapper)) return;
      resetSelection();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [applySelection, extendSelectionToCell, resetSelection]);

  return (
    <div
      ref={wrapperRef}
      className={[
        'feishu-table-wrapper',
        layoutMode === 'right' ? 'feishu-table-wrapper--wide-right' : '',
        layoutMode === 'balanced' ? 'feishu-table-wrapper--wide-balanced' : '',
      ].filter(Boolean).join(' ')}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Escape') resetSelection();
      }}
    >
      <table
        ref={tableRef}
        {...props}
        className={mergeClassName('feishu-table', className)}
        onMouseDown={handleMouseDown}
        onMouseOver={handleMouseOver}
      >
        {children}
      </table>
    </div>
  );
}
