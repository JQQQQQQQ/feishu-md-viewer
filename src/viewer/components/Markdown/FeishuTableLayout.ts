export type TableLayoutMode = 'normal' | 'right' | 'balanced' | 'fit';

import { createTableGrid } from './FeishuTableSelection';

export interface TableScrollPresentation {
  leftReveal: number;
  mainScrollLeft: number;
}

/**
 * 将原生滚动距离拆成“左侧露出”和固定视口内部的滚动距离。
 *
 * 左侧最多移动到窗口左侧 10% 的安全线；超过安全线的距离交给内部
 * scrollport，避免外框继续变宽或把正文整体向左推移。
 */
export function resolveTableScrollPresentation(
  scrollLeft: number,
  tableLeft: number,
  viewportWidth: number,
): TableScrollPresentation {
  const safeScrollLeft = Number.isFinite(scrollLeft) ? Math.max(0, scrollLeft) : 0;
  const safeTableLeft = Number.isFinite(tableLeft) ? tableLeft : 0;
  const safeViewportWidth = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const maxLeftReveal = Math.max(0, safeTableLeft - safeViewportWidth * 0.1);
  const leftReveal = Math.min(safeScrollLeft, maxLeftReveal);
  const mainScrollLeft = safeScrollLeft - leftReveal;

  return {
    leftReveal,
    mainScrollLeft,
  };
}

export function getTableContentOffset(scrollLeft: number, tableLeft: number, viewportWidth: number): number {
  return Math.min(Math.max(0, scrollLeft), Math.max(0, tableLeft - viewportWidth * TABLE_VIEWPORT_LEFT_RATIO));
}

export function getTableResizeScrollTarget(
  pointerX: number,
  bounds: { left: number; right: number },
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): number | null {
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  if (maxScrollLeft <= 0 || !Number.isFinite(pointerX)) return null;
  if (pointerX >= bounds.right - 24) return maxScrollLeft === scrollLeft ? null : maxScrollLeft;
  if (pointerX <= bounds.left + 24) return scrollLeft === 0 ? null : 0;
  return null;
}

/**
 * 返回整列边框拖拽时单帧应追加的原生滚动距离。
 * 指针越靠近边缘，滚动越快；到达边界或离开热区则停止。
 */
export function getTableRailDragScrollDelta(
  pointerX: number,
  bounds: { left: number; right: number },
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): number {
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  if (maxScrollLeft <= 0 || !Number.isFinite(pointerX)) return 0;

  const edgeSize = 28;
  const minSpeed = 6;
  const maxSpeed = 24;
  const speedForDistance = (distance: number) => {
    const strength = Math.min(1, Math.max(0, (edgeSize - distance) / edgeSize));
    return Math.round(minSpeed + (maxSpeed - minSpeed) * strength);
  };

  const safeScrollLeft = Math.min(maxScrollLeft, Math.max(0, scrollLeft));
  if (pointerX >= bounds.right - edgeSize && safeScrollLeft < maxScrollLeft) {
    return Math.min(speedForDistance(bounds.right - pointerX), maxScrollLeft - safeScrollLeft);
  }
  if (pointerX <= bounds.left + edgeSize && safeScrollLeft > 0) {
    return -Math.min(speedForDistance(pointerX - bounds.left), safeScrollLeft);
  }
  return 0;
}

type ContentPressure = 'low' | 'medium' | 'high';

const CONTENT_AWARE_COLUMN_THRESHOLD = 4;
const RIGHT_WIDE_COLUMN_THRESHOLD = 6;
const BALANCED_WIDE_COLUMN_THRESHOLD = 9;
const BALANCED_CONTENT_COLUMN_THRESHOLD = 7;
const AUTO_FIT_MIN_COLUMN_WIDTH = 64;
const AUTO_FIT_COMPACT_MAX_WIDTH = 144;
const AUTO_FIT_TEXT_MAX_WIDTH = 320;
const LONG_CELL_TEXT_THRESHOLD = 56;
const VERY_LONG_CELL_TEXT_THRESHOLD = 150;
const LONG_UNBROKEN_TEXT_THRESHOLD = 24;
const VERY_LONG_UNBROKEN_TEXT_THRESHOLD = 48;
const MAX_WIDE_TABLE_WIDTH = 1320;
const TABLE_VIEWPORT_LEFT_RATIO = 0.1;
const TABLE_VIEWPORT_RIGHT_RATIO = 0.9;
const HORIZONTAL_OVERFLOW_TOLERANCE_PX = 1;

interface TableBaseBox {
  left: number;
  width: number;
}

function getColumnCount(table: HTMLTableElement): number {
  return Math.max(...Array.from(table.rows).map((row) => Array.from(row.cells)
    .reduce((count, cell) => count + Math.max(1, cell.colSpan), 0)), 0);
}

const COMPACT_COLUMN_LABEL = /(?:编号|序号|状态|类型|优先级|日期|时间|负责人|作者|数量|价格|版本|id|key)/i;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 根据表头语义和内容长度分配一次性首屏列宽。
 * 返回 null 表示最低可读宽度本身就超过阅读区，应继续使用原生横向滚动。
 */
export function getTableAutoFitColumnWidths(
  table: HTMLTableElement,
  availableWidth: number,
): number[] | null {
  const safeAvailableWidth = Math.floor(availableWidth);
  if (safeAvailableWidth <= 0) return null;

  const grid = createTableGrid(table);
  const columnCount = grid.columnCount;
  if (columnCount === 0) return null;

  const columns = Array.from({ length: columnCount }, () => ({
    headerLength: 0,
    contentLength: 0,
    label: '',
  }));

  grid.ranges.forEach((range) => {
    const text = (range.cell.textContent ?? '').replace(/\s+/g, ' ').trim();
    const lengthPerColumn = Math.max(1, Math.ceil(text.length / Math.max(1, range.colEnd - range.colStart + 1)));
    for (let index = range.colStart; index <= range.colEnd; index += 1) {
      const column = columns[index];
      if (!column) continue;
      if (range.cell.tagName.toLowerCase() === 'th') {
        column.headerLength = Math.max(column.headerLength, lengthPerColumn);
        column.label = text;
      } else {
        column.contentLength = Math.max(column.contentLength, lengthPerColumn);
      }
    }
  });

  const minimumWidths = columns.map((column) => (
    COMPACT_COLUMN_LABEL.test(column.label) ? AUTO_FIT_MIN_COLUMN_WIDTH : AUTO_FIT_MIN_COLUMN_WIDTH + 8
  ));
  const minimumTotal = minimumWidths.reduce((sum, width) => sum + width, 0);
  if (minimumTotal > safeAvailableWidth) return null;

  const desiredWidths = columns.map((column, index) => {
    const compact = COMPACT_COLUMN_LABEL.test(column.label);
    const textLength = Math.max(column.headerLength, column.contentLength);
    const contentWidth = (compact ? 4.5 : 6) * textLength;
    const minimumWidth = minimumWidths[index] ?? AUTO_FIT_MIN_COLUMN_WIDTH;
    return clamp(
      minimumWidth + contentWidth,
      minimumWidth,
      compact ? AUTO_FIT_COMPACT_MAX_WIDTH : AUTO_FIT_TEXT_MAX_WIDTH,
    );
  });
  const desiredTotal = desiredWidths.reduce((sum, width) => sum + width, 0);
  const widths = desiredTotal <= safeAvailableWidth
    ? [...desiredWidths]
    : desiredWidths.map((width, index) => {
      const availableAboveMinimum = safeAvailableWidth - minimumTotal;
      const desiredAboveMinimum = desiredTotal - minimumTotal;
      const minimumWidth = minimumWidths[index] ?? AUTO_FIT_MIN_COLUMN_WIDTH;
      return minimumWidth
        + (desiredAboveMinimum > 0
          ? (width - minimumWidth) * availableAboveMinimum / desiredAboveMinimum
          : 0);
    });

  const flexibleColumns = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => !COMPACT_COLUMN_LABEL.test(column.label));
  const extra = safeAvailableWidth - widths.reduce((sum, width) => sum + width, 0);
  if (extra > 0) {
    const recipients = flexibleColumns.length > 0 ? flexibleColumns : columns.map((_, index) => ({ column: columns[index], index }));
    recipients.forEach(({ index }) => {
      if (widths[index] !== undefined) widths[index] += extra / recipients.length;
    });
  }

  const rounded = widths.map((width) => Math.max(1, Math.round(width)));
  const roundingDelta = safeAvailableWidth - rounded.reduce((sum, width) => sum + width, 0);
  const lastIndex = rounded.length - 1;
  if (lastIndex >= 0 && rounded[lastIndex] !== undefined) {
    rounded[lastIndex] += roundingDelta;
  }
  return rounded;
}

export function getTableAutoFitAvailableWidth(wrapper: HTMLElement): number {
  const parent = wrapper.parentElement;
  const rect = parent?.getBoundingClientRect() ?? wrapper.getBoundingClientRect();
  const style = parent ? getComputedStyle(parent) : null;
  const paddingLeft = Number.parseFloat(style?.paddingLeft ?? '') || 0;
  const paddingRight = Number.parseFloat(style?.paddingRight ?? '') || 0;
  const contentLeft = rect.left + paddingLeft;
  const rightBoundary = window.innerWidth * TABLE_VIEWPORT_RIGHT_RATIO;
  return Math.floor(Math.min(
    MAX_WIDE_TABLE_WIDTH,
    window.innerWidth * 0.8,
    Math.max(0, rightBoundary - contentLeft - paddingRight),
  ));
}

function getLongestUnbrokenTextLength(text: string): number {
  return Math.max(...text.split(/\s+/).map((segment) => segment.length), 0);
}

function hasCodeLikeContent(cell: HTMLTableCellElement): boolean {
  if (cell.querySelector('code, pre, .feishu-inline-code')) return true;

  const text = cell.textContent?.trim() ?? '';
  return /(?:\/|\\|->|::|[A-Za-z0-9]+_[A-Za-z0-9_]+|\.[A-Za-z]{2,5}\b)/.test(text);
}

function getContentPressure(table: HTMLTableElement): ContentPressure {
  const cells = Array.from(table.querySelectorAll('th,td')) as HTMLTableCellElement[];
  if (cells.length === 0) return 'low';

  let longCellCount = 0;
  let longUnbrokenCount = 0;
  let codeLikeCount = 0;
  let maxTextLength = 0;
  let maxUnbrokenLength = 0;

  cells.forEach((cell) => {
    const text = cell.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const textLength = text.length;
    const unbrokenLength = getLongestUnbrokenTextLength(text);

    if (textLength >= LONG_CELL_TEXT_THRESHOLD) longCellCount += 1;
    if (unbrokenLength >= LONG_UNBROKEN_TEXT_THRESHOLD) longUnbrokenCount += 1;
    if (hasCodeLikeContent(cell)) codeLikeCount += 1;

    maxTextLength = Math.max(maxTextLength, textLength);
    maxUnbrokenLength = Math.max(maxUnbrokenLength, unbrokenLength);
  });

  if (
    maxTextLength >= VERY_LONG_CELL_TEXT_THRESHOLD ||
    maxUnbrokenLength >= VERY_LONG_UNBROKEN_TEXT_THRESHOLD ||
    longUnbrokenCount >= 4 ||
    (codeLikeCount >= 4 && longCellCount >= 2)
  ) {
    return 'high';
  }

  if (
    maxTextLength >= LONG_CELL_TEXT_THRESHOLD ||
    maxUnbrokenLength >= LONG_UNBROKEN_TEXT_THRESHOLD ||
    longCellCount >= 2 ||
    longUnbrokenCount >= 2 ||
    codeLikeCount >= 2
  ) {
    return 'medium';
  }

  return 'low';
}

export function getTableLayoutMode(table: HTMLTableElement): TableLayoutMode {
  const columnCount = getColumnCount(table);
  const contentPressure = getContentPressure(table);

  if (columnCount >= BALANCED_WIDE_COLUMN_THRESHOLD) return 'balanced';
  if (columnCount >= BALANCED_CONTENT_COLUMN_THRESHOLD && contentPressure === 'high') return 'balanced';
  if (columnCount >= RIGHT_WIDE_COLUMN_THRESHOLD) return 'right';
  if (columnCount >= CONTENT_AWARE_COLUMN_THRESHOLD && contentPressure !== 'low') return 'right';
  return 'normal';
}

function setModeClass(wrapper: HTMLElement, mode: TableLayoutMode): void {
  wrapper.classList.toggle('feishu-table-wrapper--wide-right', mode === 'right');
  wrapper.classList.toggle('feishu-table-wrapper--wide-balanced', mode === 'balanced');
  wrapper.classList.toggle('feishu-table-wrapper--fit', mode === 'fit');
}

function canFitTableToViewport(wrapper: HTMLElement, table: HTMLTableElement): boolean {
  return table.dataset.feishuTableCustomWidths !== 'true'
    && getTableAutoFitColumnWidths(table, getTableAutoFitAvailableWidth(wrapper)) !== null;
}

function hasHorizontalOverflow(wrapper: HTMLElement, table: HTMLTableElement): boolean {
  const wrapperOverflow = wrapper.scrollWidth - wrapper.clientWidth > HORIZONTAL_OVERFLOW_TOLERANCE_PX;
  const tableOverflow = table.scrollWidth - wrapper.clientWidth > HORIZONTAL_OVERFLOW_TOLERANCE_PX;
  return wrapperOverflow || tableOverflow;
}

function withTemporaryLayoutMode<T>(
  wrapper: HTMLElement,
  mode: TableLayoutMode,
  run: () => T,
): T {
  const prevIsRight = wrapper.classList.contains('feishu-table-wrapper--wide-right');
  const prevIsBalanced = wrapper.classList.contains('feishu-table-wrapper--wide-balanced');
  const prevIsFit = wrapper.classList.contains('feishu-table-wrapper--fit');
  const prevWideWidth = wrapper.style.getPropertyValue('--feishu-table-wide-width');
  const prevWideOffset = wrapper.style.getPropertyValue('--feishu-table-wide-offset');

  setModeClass(wrapper, mode);
  updateTableWideWidth(wrapper, mode);

  try {
    return run();
  } finally {
    wrapper.classList.toggle('feishu-table-wrapper--wide-right', prevIsRight);
    wrapper.classList.toggle('feishu-table-wrapper--wide-balanced', prevIsBalanced);
    wrapper.classList.toggle('feishu-table-wrapper--fit', prevIsFit);
    if (prevWideWidth) {
      wrapper.style.setProperty('--feishu-table-wide-width', prevWideWidth);
    } else {
      wrapper.style.removeProperty('--feishu-table-wide-width');
    }

    if (prevWideOffset) {
      wrapper.style.setProperty('--feishu-table-wide-offset', prevWideOffset);
    } else {
      wrapper.style.removeProperty('--feishu-table-wide-offset');
    }
  }
}

export function resolveTableLayoutMode(
  wrapper: HTMLElement,
  table: HTMLTableElement,
  preferredMode: TableLayoutMode,
): TableLayoutMode {
  if (
    table.dataset.feishuTableAutoFit === 'true'
    && table.dataset.feishuTableCustomWidths !== 'true'
  ) {
    return 'fit';
  }

  if (preferredMode === 'normal') {
    return preferredMode;
  }

  if (preferredMode === 'balanced' && canFitTableToViewport(wrapper, table)) {
    return 'fit';
  }

  const overflowAfterRightExpand = withTemporaryLayoutMode(wrapper, 'right', () =>
    hasHorizontalOverflow(wrapper, table),
  );

  if (!overflowAfterRightExpand) return 'right';

  return canFitTableToViewport(wrapper, table) ? 'fit' : 'balanced';
}

function getTableBaseBox(wrapper: HTMLElement): TableBaseBox {
  const parent = wrapper.parentElement;
  if (!parent) {
    const rect = wrapper.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  }

  const rect = parent.getBoundingClientRect();
  const style = getComputedStyle(parent);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;

  return {
    left: rect.left + paddingLeft,
    width: Math.max(0, rect.width - paddingLeft - paddingRight),
  };
}

export function updateTableWideWidth(
  wrapper: HTMLElement,
  mode: TableLayoutMode,
  _contentWidth?: number,
  scrollLeft = 0,
): void {
  if (mode === 'normal') {
    wrapper.style.removeProperty('--feishu-table-wide-width');
    wrapper.style.removeProperty('--feishu-table-wide-offset');
    return;
  }

  const baseBox = getTableBaseBox(wrapper);
  const viewportRight = window.innerWidth * TABLE_VIEWPORT_RIGHT_RATIO;
  // Both wide modes keep the wrapper at its real reading-column start.  Width
  // must therefore be derived from that same physical left edge; mixing in a
  // synthetic mainLeft + gutter origin lets balanced tables cross the 90vw
  // right boundary whenever the actual wrapper begins farther to the right.
  const defaultWidth = Math.max(0, viewportRight - baseBox.left);
  // The outer frame follows the table while it fits in the reading viewport.
  // Once the table is wider than that viewport, the frame stops at the right
  // boundary and the table provides the horizontal overflow inside it.
  const measuredWidth = Number.isFinite(_contentWidth) && (_contentWidth ?? 0) > 0
    ? _contentWidth as number
    : defaultWidth;
  const viewportLeft = window.innerWidth * TABLE_VIEWPORT_LEFT_RATIO;
  const baseLeft = baseBox.left;
  const maxShift = Math.max(0, baseLeft - viewportLeft);
  const appliedShift = Math.min(Math.max(0, scrollLeft), maxShift);
  const maxWideWidth = Math.min(MAX_WIDE_TABLE_WIDTH, window.innerWidth * 0.8);
  const initialWidth = Math.max(0, Math.min(measuredWidth, defaultWidth));
  const nextWidth = Math.min(maxWideWidth, initialWidth);
  // Wide tables keep their left edge aligned with the reading column.  The
  // wrapper owns horizontal scrolling; never shift the table into the TOC
  // gutter when a very wide table is rendered.
  const nextOffset = 0;

  // Never round a fractional boundary upward: even half a pixel would violate
  // the hard 90vw right-edge invariant.
  wrapper.style.setProperty('--feishu-table-wide-width', `${Math.floor(nextWidth)}px`);
  wrapper.style.setProperty('--feishu-table-wide-offset', `${nextOffset}px`);
  wrapper.style.setProperty('--feishu-table-content-offset', `${Math.round(appliedShift)}px`);
}
