import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import {
  getTableLayoutMode,
  resolveTableLayoutMode,
  updateTableWideWidth,
  type TableLayoutMode,
} from './FeishuTableLayout';
import {
  clearTableSelection,
  getWholeTableSelection,
  renderTableSelection,
  renderTableSelectionHtml,
  type CellPoint,
  type SelectionState,
} from './FeishuTableSelection';
import { persistTableColumnWidths, restorePersistedTableColumnWidths } from './FeishuTableColumnWidths';
import { hasNativeTextSelection } from './table-native-selection';
import { resolveTablePointerIntent } from './table-pointer-intent';

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

function getCellFromPoint(clientX: number, clientY: number): HTMLTableCellElement | null {
  if (typeof document.elementFromPoint !== 'function') return null;
  return getCell(document.elementFromPoint(clientX, clientY));
}

function getStickyTopOffset(wrapper: HTMLElement): number {
  const viewer = wrapper.closest('.feishu-viewer');
  const rawTopbarHeight = viewer instanceof HTMLElement
    ? getComputedStyle(viewer).getPropertyValue('--feishu-topbar-height')
    : '';
  const topbarHeight = Number.parseFloat(rawTopbarHeight);
  return (Number.isFinite(topbarHeight) ? topbarHeight : 56) + 3;
}

function focusWithoutScroll(node: HTMLElement | null): void {
  if (!node) return;
  try {
    node.focus({ preventScroll: true });
  } catch {
    node.focus();
  }
}

function eventPathContains(event: Event, node: Node): boolean { return event.composedPath().includes(node) }

function mergeClassName(base: string, className?: string): string { return className ? `${base} ${className}` : base }

async function writeTableClipboard(text: string, html: string): Promise<void> {
  const clipboard = navigator.clipboard;
  if (clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    });

    try {
      await clipboard.write([item]);
      return;
    } catch {
      // Fall through to the plain-text path for browsers or permissions that reject rich clipboard writes.
    }
  }

  await clipboard?.writeText(text);
}

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
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const stickyHeaderTableRef = useRef<HTMLTableElement>(null);
  const selectionRef = useRef<SelectionState | null>(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragStartYRef = useRef<number | null>(null);
  const anchorRowHeightRef = useRef<number | null>(null);
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

  const extendSelectionToCell = useCallback((cell: HTMLTableCellElement, clientY: number) => {
    if (!selectionRef.current) return;
    const selection = selectionRef.current;
    const nextFocus = getCellPoint(cell);
    if (
      dragStartYRef.current !== null
      && anchorRowHeightRef.current !== null
      && nextFocus.row !== selection.anchor.row
    ) {
      const movedY = Math.abs(clientY - dragStartYRef.current);
      const lockThreshold = Math.max(6, anchorRowHeightRef.current * 0.45);
      if (movedY < lockThreshold) {
        nextFocus.row = selection.anchor.row;
      }
    }

    applySelection({
      anchor: selection.anchor,
      focus: nextFocus,
    });
  }, [applySelection]);

  const resetSelection = useCallback(() => {
    const table = tableRef.current;
    if (table) clearTableSelection(table);
    selectionRef.current = null;
    copiedRef.current = { text: '', html: '' };
    dragStartYRef.current = null;
    anchorRowHeightRef.current = null;
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
      dragStartYRef.current = null;
      anchorRowHeightRef.current = null;

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

    const pointerIntent = resolveTablePointerIntent(event.nativeEvent, wrapperRef.current!, cell);
    if (pointerIntent === 'text') {
      resetSelection();
      return;
    }
    if (pointerIntent === 'interactive') return;

    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    focusWithoutScroll(wrapperRef.current);

    const point = getCellPoint(cell);
    isDraggingRef.current = true;
    dragStartYRef.current = event.clientY;
    const anchorRowHeight = cell.getBoundingClientRect().height;
    anchorRowHeightRef.current = Number.isFinite(anchorRowHeight) ? anchorRowHeight : null;
    applySelection({ anchor: point, focus: point });
  }, [applySelection, resetSelection]);

  const handleMouseOver = useCallback((event: MouseEvent<HTMLTableElement>) => {
    if (isResizingRef.current || !isDraggingRef.current || !selectionRef.current) return;

    const cell = getCell(event.target);
    if (!cell) return;

    extendSelectionToCell(cell, event.clientY);
  }, [extendSelectionToCell]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const table = tableRef.current;
    if (!wrapper || !table) return undefined;

    const updateWideLayout = () => {
      const preferredMode = getTableLayoutMode(table);
      const nextMode = resolveTableLayoutMode(wrapper, table, preferredMode);
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
    if (wrapper.parentElement) observer.observe(wrapper.parentElement);
    const main = wrapper.closest('.feishu-app-shell__main');
    if (main instanceof HTMLElement) observer.observe(main);
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
        const cell = getCellFromEvent(event) ?? getCellFromPoint(event.clientX, event.clientY);
        if (!wrapper || !table || !cell || !table.contains(cell)) {
          if (wrapper) wrapper.style.cursor = '';
          return;
        }

        wrapper.style.cursor = getResizableColumnIndex(cell, event.clientX) === null ? '' : 'col-resize';
        return;
      }

      const cell = getCellFromEvent(event) ?? getCellFromPoint(event.clientX, event.clientY);
      if (!cell || !tableRef.current?.contains(cell)) return;

      extendSelectionToCell(cell, event.clientY);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      dragStartYRef.current = null;
      anchorRowHeightRef.current = null;
    };

    const handleCopy = (event: ClipboardEvent) => {
      const wrapper = wrapperRef.current;
      if (wrapper && hasNativeTextSelection(wrapper)) return;
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

      if (event.key.toLowerCase() === 'c' && wrapper && hasNativeTextSelection(wrapper)) return;

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
      void writeTableClipboard(copiedRef.current.text, copiedRef.current.html);
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

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const table = tableRef.current;
    const stickyHeader = stickyHeaderRef.current;
    const stickyTable = stickyHeaderTableRef.current;
    if (!wrapper || !table || !stickyHeader || !stickyTable) return undefined;

    let frame = 0;

    const hideStickyHeader = () => {
      stickyHeader.style.display = 'none';
    };

    const syncCloneHeader = () => {
      const head = table.tHead;
      stickyTable.replaceChildren();
      if (!head) return;

      const clonedHead = head.cloneNode(true);
      stickyTable.appendChild(clonedHead);
      stickyTable.className = `${table.className} feishu-table--sticky-clone`;
      stickyTable.removeAttribute('id');
    };

    const syncCloneColumnWidths = () => {
      const sourceRow = table.tHead?.rows[0];
      const clonedRow = stickyTable.tHead?.rows[0];
      if (!sourceRow || !clonedRow) return;

      const sourceCells = Array.from(sourceRow.cells);
      const cloneCells = Array.from(clonedRow.cells);
      sourceCells.forEach((cell, index) => {
        const cloneCell = cloneCells[index];
        if (!(cloneCell instanceof HTMLElement)) return;

        const width = Math.round(cell.getBoundingClientRect().width);
        cloneCell.style.width = `${width}px`;
        cloneCell.style.minWidth = `${width}px`;
        cloneCell.style.maxWidth = `${width}px`;
      });
    };

    const updateStickyHeader = () => {
      frame = 0;
      const sourceRow = table.tHead?.rows[0];
      if (!sourceRow || stickyTable.tHead?.rows[0] == null) {
        hideStickyHeader();
        return;
      }

      const topOffset = getStickyTopOffset(wrapper);
      const tableRect = table.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const headerHeight = Math.round(sourceRow.getBoundingClientRect().height);

      const shouldShow = tableRect.top < topOffset && tableRect.bottom > topOffset + headerHeight;
      if (!shouldShow) {
        hideStickyHeader();
        return;
      }

      syncCloneColumnWidths();

      stickyHeader.style.display = 'block';
      stickyHeader.style.top = `${Math.round(topOffset)}px`;
      stickyHeader.style.left = `${Math.round(wrapperRect.left)}px`;
      stickyHeader.style.width = `${Math.round(wrapperRect.width)}px`;
      stickyHeader.style.height = `${headerHeight}px`;

      stickyTable.style.width = `${Math.round(table.getBoundingClientRect().width)}px`;
      stickyTable.style.transform = `translateX(${-Math.round(wrapper.scrollLeft)}px)`;
    };

    const scheduleUpdate = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(updateStickyHeader);
    };

    syncCloneHeader();
    scheduleUpdate();

    document.addEventListener('scroll', scheduleUpdate, true);
    window.addEventListener('resize', scheduleUpdate);
    wrapper.addEventListener('scroll', scheduleUpdate, { passive: true });

    const observer = new MutationObserver(() => {
      syncCloneHeader();
      scheduleUpdate();
    });
    observer.observe(table, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => scheduleUpdate());
    resizeObserver?.observe(wrapper);
    resizeObserver?.observe(table);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      hideStickyHeader();
      observer.disconnect();
      resizeObserver?.disconnect();
      wrapper.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      document.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [children]);

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
      <div ref={stickyHeaderRef} className="feishu-table__sticky-head" aria-hidden="true">
        <table ref={stickyHeaderTableRef} className="feishu-table feishu-table--sticky-clone" />
      </div>
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
