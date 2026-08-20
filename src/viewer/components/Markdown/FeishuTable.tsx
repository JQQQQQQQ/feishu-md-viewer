import { useCallback, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import {
  getTableLayoutMode,
  getTableRailDragScrollDelta,
  getTableResizeScrollTarget,
  resolveTableScrollPresentation,
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
const DIRECTORY_ACTIVE_SCROLL_SIGNAL = 9;

let tableScrollSourceSequence = 0;
const revealedTableScrollSources = new Map<string, number>();

function getAggregateLeftReveal(): number {
  return Math.max(0, ...revealedTableScrollSources.values());
}

function dispatchAggregateTableScrollState(
  target: EventTarget,
  sourceId: string,
  sourceLeftReveal: number,
  maxScrollLeft: number,
): void {
  const leftReveal = getAggregateLeftReveal();
  const active = revealedTableScrollSources.size > 0;
  target.dispatchEvent(new CustomEvent('feishu-table-horizontal-scroll', {
    bubbles: true,
    detail: {
      sourceId,
      active,
      leftReveal,
      sourceLeftReveal,
      revealedSourceIds: Array.from(revealedTableScrollSources.keys()),
      // AppShell currently consumes a numeric compatibility field.  Any
      // positive aggregate reveal must map to its existing hidden state.
      scrollLeft: active
        ? Math.max(DIRECTORY_ACTIVE_SCROLL_SIGNAL, leftReveal)
        : 0,
      maxScrollLeft,
    },
  }));
}

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
  // The reading progress bar was removed; the sticky clone now sits directly
  // below the fixed top bar without an extra gap.
  return Number.isFinite(topbarHeight) ? topbarHeight : 56;
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

function removeCloneIds(root: Element): void {
  root.removeAttribute('id');
  root.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  root.querySelectorAll('a[href], button, input, textarea, select, [tabindex], [contenteditable="true"]')
    .forEach((element) => element.setAttribute('tabindex', '-1'));
}

function getSourceCellFromLeftReveal(
  source: HTMLTableElement | null,
  leftRevealCell: HTMLTableCellElement,
): HTMLTableCellElement | null {
  if (!source || !(leftRevealCell.parentElement instanceof HTMLTableRowElement)) return null;
  return source.rows[leftRevealCell.parentElement.rowIndex]?.cells[leftRevealCell.cellIndex] ?? null;
}

function syncReadonlyTableClone(source: HTMLTableElement, clone: HTMLTableElement | null, cloneClass: string): void {
  if (!clone) return;

  clone.replaceChildren(...Array.from(source.children).map((child) => child.cloneNode(true)));
  clone.className = `${source.className} ${cloneClass}`;
  removeCloneIds(clone);
}

function syncLeftRevealClone(
  source: HTMLTableElement,
  clone: HTMLTableElement | null,
  leftReveal: number,
  refresh = false,
): void {
  if (!clone) return;
  if (leftReveal <= 0) {
    clone.replaceChildren();
    return;
  }
  if (refresh || clone.childElementCount === 0) {
    syncReadonlyTableClone(source, clone, 'feishu-table--left-reveal-clone');
  }
}

function getRenderedLeftReveal(wrapper: HTMLElement): number {
  const value = Number.parseFloat(wrapper.style.getPropertyValue('--feishu-table-left-reveal'));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

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
    cell.style.maxWidth = `${width}px`;
  });
}

interface SelectionRailSegment {
  offset: number;
  size: number;
}

interface SelectionRails {
  columns: SelectionRailSegment[];
  rows: SelectionRailSegment[];
}

interface RailSelection {
  axis: 'column' | 'row';
  start: number;
  end: number;
}

function getSelectionRails(table: HTMLTableElement): SelectionRails {
  const rows = Array.from(table.rows);
  const firstRow = rows[0];
  const columns = firstRow
    ? Array.from(firstRow.cells).map((cell) => ({
        offset: cell.offsetLeft,
        size: cell.offsetWidth || 1,
      }))
    : [];
  return {
    columns,
    rows: rows.map((row) => ({
      offset: row.offsetTop,
      size: row.offsetHeight || 1,
    })),
  };
}

export function FeishuTable({ children, className, ...props }: FeishuTableProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollportRef = useRef<HTMLDivElement>(null);
  const leftRevealRef = useRef<HTMLDivElement>(null);
  const leftRevealTableRef = useRef<HTMLTableElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const stickyLeftRevealRef = useRef<HTMLDivElement>(null);
  const stickyLeftRevealTableRef = useRef<HTMLTableElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const stickyHeaderTableRef = useRef<HTMLTableElement>(null);
  const selectionRef = useRef<SelectionState | null>(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const railDragRef = useRef<{ axis: RailSelection['axis']; anchor: number } | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const anchorRowHeightRef = useRef<number | null>(null);
  const copiedRef = useRef({ text: '', html: '' });
  const leftRevealCloneFrameRef = useRef<number | null>(null);
  const directorySourceIdRef = useRef('');
  if (!directorySourceIdRef.current) {
    tableScrollSourceSequence += 1;
    directorySourceIdRef.current = `feishu-table-${tableScrollSourceSequence}`;
  }
  const [layoutMode, setLayoutMode] = useState<TableLayoutMode>('normal');
  const [selectionRails, setSelectionRails] = useState<SelectionRails>({ columns: [], rows: [] });
  const [railSelection, setRailSelection] = useState<RailSelection | null>(null);

  useEffect(() => {
    stickyHeaderRef.current?.setAttribute('inert', '');
    stickyLeftRevealRef.current?.setAttribute('inert', '');
  }, []);

  const syncHorizontalScroll = useCallback(() => {
    const wrapper = wrapperRef.current;
    const scrollport = scrollportRef.current;
    const table = tableRef.current;
    if (!wrapper || !scrollport || !table) return;

    const maxScrollLeft = Math.max(0, scrollport.scrollWidth - scrollport.clientWidth);
    const hasHorizontalOverflow = maxScrollLeft > 1;
    if (!hasHorizontalOverflow && scrollport.scrollLeft !== 0) {
      scrollport.scrollLeft = 0;
    }

    const nativeScrollLeft = hasHorizontalOverflow
      ? Math.min(Math.max(0, scrollport.scrollLeft), maxScrollLeft)
      : 0;
    const tableLeft = scrollport.getBoundingClientRect().left
      || wrapper.getBoundingClientRect().left;
    const presentation = resolveTableScrollPresentation(nativeScrollLeft, tableLeft, window.innerWidth);
    const leftReveal = hasHorizontalOverflow ? presentation.leftReveal : 0;
    const scrollbarHeight = Math.max(0, scrollport.offsetHeight - scrollport.clientHeight);

    wrapper.style.setProperty('--feishu-table-left-reveal', `${leftReveal}px`);
    wrapper.style.setProperty('--feishu-table-left-reveal-content-offset', `${presentation.mainScrollLeft}px`);
    wrapper.style.setProperty('--feishu-table-native-scroll-left', `${nativeScrollLeft}px`);
    wrapper.style.setProperty('--feishu-table-scrollbar-height', `${scrollbarHeight}px`);
    wrapper.classList.toggle('feishu-table-wrapper--left-revealed', leftReveal > 0);
    wrapper.classList.toggle(
      'feishu-table-wrapper--can-scroll-left',
      presentation.mainScrollLeft > 1,
    );
    wrapper.classList.toggle(
      'feishu-table-wrapper--can-scroll-right',
      hasHorizontalOverflow && nativeScrollLeft < maxScrollLeft - 1,
    );
    if (leftReveal <= 0 && leftRevealCloneFrameRef.current !== null) {
      window.cancelAnimationFrame(leftRevealCloneFrameRef.current);
      leftRevealCloneFrameRef.current = null;
    }
    syncLeftRevealClone(table, leftRevealTableRef.current, leftReveal);

    const sourceId = directorySourceIdRef.current;
    const wasRevealed = revealedTableScrollSources.has(sourceId);
    if (leftReveal > 0) {
      revealedTableScrollSources.set(sourceId, leftReveal);
    } else {
      revealedTableScrollSources.delete(sourceId);
    }
    const isRevealed = revealedTableScrollSources.has(sourceId);
    if (wasRevealed === isRevealed) return;

    dispatchAggregateTableScrollState(wrapper, sourceId, leftReveal, maxScrollLeft);
  }, []);

  const scheduleLeftRevealCloneRefresh = useCallback(() => {
    const wrapper = wrapperRef.current;
    const table = tableRef.current;
    const clone = leftRevealTableRef.current;
    if (!wrapper || !table || !clone) return;

    const leftReveal = getRenderedLeftReveal(wrapper);
    if (leftReveal <= 0) {
      if (leftRevealCloneFrameRef.current !== null) {
        window.cancelAnimationFrame(leftRevealCloneFrameRef.current);
        leftRevealCloneFrameRef.current = null;
      }
      syncLeftRevealClone(table, clone, 0);
      return;
    }
    if (leftRevealCloneFrameRef.current !== null) return;

    const flush = () => {
      leftRevealCloneFrameRef.current = null;
      const currentWrapper = wrapperRef.current;
      const currentTable = tableRef.current;
      const currentClone = leftRevealTableRef.current;
      if (!currentWrapper || !currentTable || !currentClone) return;
      syncLeftRevealClone(
        currentTable,
        currentClone,
        getRenderedLeftReveal(currentWrapper),
        true,
      );
    };

    if (typeof window.requestAnimationFrame !== 'function') {
      flush();
      return;
    }
    leftRevealCloneFrameRef.current = window.requestAnimationFrame(flush);
  }, []);

  useEffect(() => () => {
    if (leftRevealCloneFrameRef.current === null) return;
    window.cancelAnimationFrame(leftRevealCloneFrameRef.current);
    leftRevealCloneFrameRef.current = null;
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const eventTarget = wrapper?.closest('.feishu-app-shell__main')
      ?? wrapper?.parentElement
      ?? wrapper;
    const sourceId = directorySourceIdRef.current;
    return () => {
      if (!revealedTableScrollSources.delete(sourceId) || !eventTarget) return;
      dispatchAggregateTableScrollState(eventTarget, sourceId, 0, 0);
    };
  }, []);

  const applySelection = useCallback((selection: SelectionState, nextRailSelection: RailSelection | null = null) => {
    const table = tableRef.current;
    if (!table) return;

    selectionRef.current = selection;
    copiedRef.current = {
      text: renderTableSelection(table, selection),
      html: renderTableSelectionHtml(table, selection),
    };
    setRailSelection(nextRailSelection);
    scheduleLeftRevealCloneRefresh();
  }, [scheduleLeftRevealCloneRefresh]);

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
    setRailSelection(null);
    railDragRef.current = null;
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
      wrapperRef.current?.classList.add('feishu-table-wrapper--resizing');
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

        const resizeWrapper = wrapperRef.current;
        const resizeScrollport = scrollportRef.current;
        if (resizeWrapper && resizeScrollport) {
          const scrollportRect = resizeScrollport.getBoundingClientRect();
          const scrollTarget = getTableResizeScrollTarget(
            moveEvent.clientX,
            { left: scrollportRect.left, right: scrollportRect.right },
            resizeScrollport.scrollLeft,
            resizeScrollport.scrollWidth,
            resizeScrollport.clientWidth,
          );
          if (scrollTarget !== null) {
            resizeScrollport.scrollLeft = scrollTarget;
            resizeScrollport.dispatchEvent(new Event('scroll', { bubbles: false }));
          }
          const preferredMode = getTableLayoutMode(table);
          const activeMode = resolveTableLayoutMode(resizeWrapper, table, preferredMode);
          updateTableWideWidth(
            resizeWrapper,
            activeMode,
            activeMode === 'normal' ? undefined : table.scrollWidth,
          );
          scheduleLeftRevealCloneRefresh();
          syncHorizontalScroll();
        }
      };

      const handleResizeEnd = () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        wrapperRef.current?.classList.remove('feishu-table-wrapper--resizing');
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
  }, [applySelection, resetSelection, scheduleLeftRevealCloneRefresh, syncHorizontalScroll]);

  const applyRailSelection = useCallback((axis: RailSelection['axis'], anchor: number, focus: number) => {
    const table = tableRef.current;
    if (!table) return;

    const start = Math.min(anchor, focus);
    const end = Math.max(anchor, focus);
    if (axis === 'column') {
      const rowCount = table.rows.length;
      applySelection(
        { anchor: { row: 0, col: anchor }, focus: { row: Math.max(0, rowCount - 1), col: focus } },
        { axis, start, end },
      );
      return;
    }

    const colCount = table.rows[anchor]?.cells.length ?? 0;
    applySelection(
      { anchor: { row: anchor, col: 0 }, focus: { row: focus, col: Math.max(0, colCount - 1) } },
      { axis, start, end },
    );
  }, [applySelection]);

  const handleLeftRevealMouseDown = useCallback((event: MouseEvent<HTMLTableElement>) => {
    if (event.button !== 0) return;

    const leftRevealCell = getCell(event.target);
    const sourceCell = leftRevealCell
      ? getSourceCellFromLeftReveal(tableRef.current, leftRevealCell)
      : null;
    if (!leftRevealCell || !sourceCell) return;

    const pointerIntent = resolveTablePointerIntent(event.nativeEvent, wrapperRef.current!, leftRevealCell);
    if (pointerIntent === 'text') {
      resetSelection();
      return;
    }
    if (pointerIntent === 'interactive') return;

    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    focusWithoutScroll(wrapperRef.current);

    const point = getCellPoint(sourceCell);
    isDraggingRef.current = true;
    dragStartYRef.current = event.clientY;
    const anchorRowHeight = sourceCell.getBoundingClientRect().height;
    anchorRowHeightRef.current = Number.isFinite(anchorRowHeight) ? anchorRowHeight : null;
    applySelection({ anchor: point, focus: point });
  }, [applySelection, resetSelection]);

  const handleLeftRevealMouseOver = useCallback((event: MouseEvent<HTMLTableElement>) => {
    if (isResizingRef.current || !isDraggingRef.current || !selectionRef.current) return;

    const leftRevealCell = getCell(event.target);
    const sourceCell = leftRevealCell
      ? getSourceCellFromLeftReveal(tableRef.current, leftRevealCell)
      : null;
    if (!sourceCell) return;
    extendSelectionToCell(sourceCell, event.clientY);
  }, [extendSelectionToCell]);

  const handleMouseOver = useCallback((event: MouseEvent<HTMLTableElement>) => {
    const cell = getCell(event.target);
    if (!cell) return;

    const railDrag = railDragRef.current;
    if (railDrag) {
      applyRailSelection(
        railDrag.axis,
        railDrag.anchor,
        railDrag.axis === 'column'
          ? cell.cellIndex
          : cell.parentElement instanceof HTMLTableRowElement
            ? cell.parentElement.rowIndex
            : railDrag.anchor,
      );
      return;
    }

    if (isResizingRef.current || !isDraggingRef.current || !selectionRef.current) return;

    extendSelectionToCell(cell, event.clientY);
  }, [applyRailSelection, extendSelectionToCell]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const scrollport = scrollportRef.current;
    const table = tableRef.current;
    if (!wrapper || !scrollport || !table) return undefined;

    const updateWideLayout = () => {
      const preferredMode = getTableLayoutMode(table);
      const nextMode = resolveTableLayoutMode(wrapper, table, preferredMode);
      const renderedTableWidth = Math.ceil(
        Math.max(table.scrollWidth, table.getBoundingClientRect().width),
      );
      if (table.scrollWidth <= scrollport.clientWidth + 1) {
        scrollport.scrollLeft = 0;
      }
      updateTableWideWidth(
        wrapper,
        nextMode,
        nextMode === 'normal' ? undefined : renderedTableWidth,
      );
      scheduleLeftRevealCloneRefresh();
      syncHorizontalScroll();
      setLayoutMode(nextMode);
    };

    restorePersistedTableColumnWidths(table);
    updateWideLayout();
    const layoutFrame = typeof requestAnimationFrame === 'undefined'
      ? 0
      : requestAnimationFrame(updateWideLayout);
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWideLayout);
      return () => {
        if (layoutFrame !== 0) cancelAnimationFrame(layoutFrame);
        window.removeEventListener('resize', updateWideLayout);
      };
    }

    const observer = new ResizeObserver(updateWideLayout);
    observer.observe(wrapper);
    observer.observe(scrollport);
    observer.observe(table);
    if (wrapper.parentElement) observer.observe(wrapper.parentElement);
    const main = wrapper.closest('.feishu-app-shell__main');
    if (main instanceof HTMLElement) observer.observe(main);
    window.addEventListener('resize', updateWideLayout);

    return () => {
      if (layoutFrame !== 0) cancelAnimationFrame(layoutFrame);
      observer.disconnect(); window.removeEventListener('resize', updateWideLayout);
    };
  }, [children, scheduleLeftRevealCloneRefresh, syncHorizontalScroll]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return undefined;

    const updateRails = () => setSelectionRails(getSelectionRails(table));
    updateRails();
    window.addEventListener('resize', updateRails);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateRails);
    observer?.observe(table);
    return () => {
      window.removeEventListener('resize', updateRails);
      observer?.disconnect();
    };
  }, [children]);

  useEffect(() => {
    let railDragFrame = 0;
    let railDragPointer: { x: number; y: number } | null = null;

    const stopRailDragAutoScroll = () => {
      railDragPointer = null;
      if (railDragFrame !== 0) {
        window.cancelAnimationFrame(railDragFrame);
        railDragFrame = 0;
      }
    };

    const scrollColumnRailAtPointer = (): boolean => {
      const drag = railDragRef.current;
      const pointer = railDragPointer;
      const scrollport = scrollportRef.current;
      const table = tableRef.current;
      if (!pointer || drag?.axis !== 'column' || !scrollport || !table) return false;

      const bounds = scrollport.getBoundingClientRect();
      const delta = getTableRailDragScrollDelta(
        pointer.x,
        { left: bounds.left, right: bounds.right },
        scrollport.scrollLeft,
        scrollport.scrollWidth,
        scrollport.clientWidth,
      );
      if (delta === 0) return false;

      scrollport.scrollLeft += delta;
      scrollport.dispatchEvent(new Event('scroll', { bubbles: false }));

      const contentX = scrollport.scrollLeft + pointer.x - bounds.left;
      const targetColumn = getSelectionRails(table).columns.findIndex((segment) => (
        contentX >= segment.offset && contentX < segment.offset + segment.size
      ));
      if (targetColumn >= 0) applyRailSelection('column', drag.anchor, targetColumn);
      return true;
    };

    const scheduleRailDragAutoScroll = () => {
      if (railDragFrame !== 0 || typeof window.requestAnimationFrame !== 'function') return;
      railDragFrame = window.requestAnimationFrame(() => {
        railDragFrame = 0;
        if (scrollColumnRailAtPointer()) scheduleRailDragAutoScroll();
      });
    };

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (isResizingRef.current) return;
      if (railDragRef.current?.axis === 'column') {
        railDragPointer = { x: event.clientX, y: event.clientY };
        if (scrollColumnRailAtPointer()) scheduleRailDragAutoScroll();
        return;
      }
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
      stopRailDragAutoScroll();
      isDraggingRef.current = false;
      railDragRef.current = null;
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
      stopRailDragAutoScroll();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [applySelection, extendSelectionToCell, resetSelection]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const scrollport = scrollportRef.current;
    const table = tableRef.current;
    const stickyHeader = stickyHeaderRef.current;
    const stickyTable = stickyHeaderTableRef.current;
    const stickyLeftReveal = stickyLeftRevealRef.current;
    const stickyLeftRevealTable = stickyLeftRevealTableRef.current;
    if (
      !wrapper
      || !scrollport
      || !table
      || !stickyHeader
      || !stickyTable
      || !stickyLeftReveal
      || !stickyLeftRevealTable
    ) return undefined;

    let frame = 0;

    const hideStickyHeader = () => {
      stickyHeader.style.display = 'none';
      stickyHeader.classList.remove('feishu-table__sticky-head--with-left-reveal');
      stickyLeftReveal.style.display = 'none';
    };

    const syncCloneHeader = () => {
      const head = table.tHead;
      stickyTable.replaceChildren();
      stickyLeftRevealTable.replaceChildren();
      if (!head) return;

      stickyTable.appendChild(head.cloneNode(true));
      stickyLeftRevealTable.appendChild(head.cloneNode(true));
      stickyTable.className = `${table.className} feishu-table--sticky-clone`;
      stickyLeftRevealTable.className = `${table.className} feishu-table--sticky-clone`;
      stickyTable.removeAttribute('id');
      removeCloneIds(stickyTable);
      removeCloneIds(stickyLeftRevealTable);
    };

    const syncRevealTable = () => {
      scheduleLeftRevealCloneRefresh();
    };

    const syncCloneColumnWidthsFor = (cloneTable: HTMLTableElement) => {
      const sourceRow = table.tHead?.rows[0];
      const clonedRow = cloneTable.tHead?.rows[0];
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

    const syncCloneColumnWidths = () => {
      syncCloneColumnWidthsFor(stickyTable);
      syncCloneColumnWidthsFor(stickyLeftRevealTable);
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
      const scrollportRect = scrollport.getBoundingClientRect();
      const headerHeight = Math.round(sourceRow.getBoundingClientRect().height);
      const maxScrollLeft = Math.max(0, scrollport.scrollWidth - scrollport.clientWidth);
      const nativeScrollLeft = maxScrollLeft > 1
        ? Math.min(Math.max(0, scrollport.scrollLeft), maxScrollLeft)
        : 0;
      const presentation = resolveTableScrollPresentation(
        nativeScrollLeft,
        scrollportRect.left,
        window.innerWidth,
      );
      const leftReveal = maxScrollLeft > 1 ? presentation.leftReveal : 0;

      const shouldShow = tableRect.top < topOffset && tableRect.bottom > topOffset + headerHeight;
      if (!shouldShow) {
        hideStickyHeader();
        return;
      }

      syncCloneColumnWidths();

      stickyHeader.style.display = 'block';
      stickyHeader.style.top = `${Math.round(topOffset)}px`;
      stickyHeader.style.left = `${Math.round(scrollportRect.left)}px`;
      stickyHeader.style.width = `${Math.round(scrollportRect.width)}px`;
      stickyHeader.style.height = `${headerHeight}px`;

      stickyTable.style.width = `${Math.round(table.getBoundingClientRect().width)}px`;
      stickyTable.style.transform = `translateX(${-Math.round(nativeScrollLeft)}px)`;

      stickyHeader.classList.toggle('feishu-table__sticky-head--with-left-reveal', leftReveal > 0);
      if (leftReveal > 0) {
        stickyLeftReveal.style.display = 'block';
        stickyLeftReveal.style.top = `${Math.round(topOffset)}px`;
        stickyLeftReveal.style.left = `${scrollportRect.left - leftReveal}px`;
        stickyLeftReveal.style.width = `${leftReveal}px`;
        stickyLeftReveal.style.height = `${headerHeight}px`;
        stickyLeftRevealTable.style.width = `${Math.round(table.getBoundingClientRect().width)}px`;
        stickyLeftRevealTable.style.transform = `translateX(${-presentation.mainScrollLeft}px)`;
      } else {
        stickyLeftReveal.style.display = 'none';
      }
    };

    const scheduleUpdate = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(updateStickyHeader);
    };

    syncCloneHeader();
    syncRevealTable();
    syncHorizontalScroll();
    scheduleUpdate();

    document.addEventListener('scroll', scheduleUpdate, true);
    window.addEventListener('resize', scheduleUpdate);
    scrollport.addEventListener('scroll', scheduleUpdate, { passive: true });
    const handleHorizontalScroll = () => syncHorizontalScroll();
    scrollport.addEventListener('scroll', handleHorizontalScroll, { passive: true });

    const observer = new MutationObserver(() => {
      syncCloneHeader();
      syncRevealTable();
      scheduleUpdate();
    });
    observer.observe(table, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    });

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => scheduleUpdate());
    resizeObserver?.observe(wrapper);
    resizeObserver?.observe(scrollport);
    resizeObserver?.observe(table);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      hideStickyHeader();
      observer.disconnect();
      resizeObserver?.disconnect();
      scrollport.removeEventListener('scroll', scheduleUpdate);
      scrollport.removeEventListener('scroll', handleHorizontalScroll);
      window.removeEventListener('resize', scheduleUpdate);
      document.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [children, scheduleLeftRevealCloneRefresh, syncHorizontalScroll]);

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
      <div ref={leftRevealRef} className="feishu-table__left-reveal" aria-hidden="true">
        <table
          ref={leftRevealTableRef}
          className={mergeClassName('feishu-table feishu-table--left-reveal-clone', className)}
          onMouseDown={handleLeftRevealMouseDown}
          onMouseOver={handleLeftRevealMouseOver}
        />
      </div>
      <div ref={stickyLeftRevealRef} className="feishu-table__sticky-left-reveal" aria-hidden="true">
        <table ref={stickyLeftRevealTableRef} className="feishu-table feishu-table--sticky-clone" />
      </div>
      <div ref={stickyHeaderRef} className="feishu-table__sticky-head" aria-hidden="true">
        <table ref={stickyHeaderTableRef} className="feishu-table feishu-table--sticky-clone" />
      </div>
      <div className="feishu-table__selection-rails" aria-hidden="true">
        <div className="feishu-table__selection-rail feishu-table__selection-rail--top">
          {selectionRails.columns.map((segment, col) => {
            const selected = railSelection?.axis === 'column'
              && railSelection.start <= col
              && railSelection.end >= col;
            const style = { left: segment.offset, width: segment.size } satisfies CSSProperties;
            return (
              <span
                key={`column-${col}`}
                className={`feishu-table__selection-rail-segment${selected ? ' is-selected' : ''}`}
                style={style}
                role="presentation"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  railDragRef.current = { axis: 'column', anchor: col };
                  applyRailSelection('column', col, col);
                }}
                onMouseEnter={() => {
                  const drag = railDragRef.current;
                  if (drag?.axis === 'column') applyRailSelection('column', drag.anchor, col);
                }}
              />
            );
          })}
        </div>
        <div className="feishu-table__selection-rail feishu-table__selection-rail--left">
          {selectionRails.rows.map((segment, row) => {
            const selected = railSelection?.axis === 'row'
              && railSelection.start <= row
              && railSelection.end >= row;
            const style = { top: segment.offset, height: segment.size } satisfies CSSProperties;
            return (
              <span
                key={`row-${row}`}
                className={`feishu-table__selection-rail-segment${selected ? ' is-selected' : ''}`}
                style={style}
                role="presentation"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  railDragRef.current = { axis: 'row', anchor: row };
                  applyRailSelection('row', row, row);
                }}
                onMouseEnter={() => {
                  const drag = railDragRef.current;
                  if (drag?.axis === 'row') applyRailSelection('row', drag.anchor, row);
                }}
              />
            );
          })}
        </div>
      </div>
      <div ref={scrollportRef} className="feishu-table__scrollport">
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
    </div>
  );
}
