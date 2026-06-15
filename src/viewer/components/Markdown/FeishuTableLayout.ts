export type TableLayoutMode = 'normal' | 'right' | 'balanced';

type ContentPressure = 'low' | 'medium' | 'high';

const CONTENT_AWARE_COLUMN_THRESHOLD = 4;
const RIGHT_WIDE_COLUMN_THRESHOLD = 6;
const BALANCED_WIDE_COLUMN_THRESHOLD = 9;
const BALANCED_CONTENT_COLUMN_THRESHOLD = 7;
const LONG_CELL_TEXT_THRESHOLD = 56;
const VERY_LONG_CELL_TEXT_THRESHOLD = 150;
const LONG_UNBROKEN_TEXT_THRESHOLD = 24;
const VERY_LONG_UNBROKEN_TEXT_THRESHOLD = 48;
const TABLE_VIEWPORT_GUTTER = 48;
const MAX_WIDE_TABLE_WIDTH = 1320;
const HORIZONTAL_OVERFLOW_TOLERANCE_PX = 1;

interface TableBaseBox {
  left: number;
  width: number;
}

interface TableLayoutBounds {
  left: number;
  width: number;
}

function getColumnCount(table: HTMLTableElement): number {
  return Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0);
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
  const prevWideWidth = wrapper.style.getPropertyValue('--feishu-table-wide-width');
  const prevWideOffset = wrapper.style.getPropertyValue('--feishu-table-wide-offset');

  setModeClass(wrapper, mode);
  updateTableWideWidth(wrapper, mode);

  try {
    return run();
  } finally {
    wrapper.classList.toggle('feishu-table-wrapper--wide-right', prevIsRight);
    wrapper.classList.toggle('feishu-table-wrapper--wide-balanced', prevIsBalanced);
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
  if (preferredMode !== 'right') {
    return preferredMode;
  }

  const overflowAfterRightExpand = withTemporaryLayoutMode(wrapper, 'right', () =>
    hasHorizontalOverflow(wrapper, table),
  );

  return overflowAfterRightExpand ? 'balanced' : 'right';
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

function getTableLayoutBounds(wrapper: HTMLElement): TableLayoutBounds {
  const main = wrapper.closest('.feishu-app-shell__main');
  const mainLeft = main instanceof HTMLElement ? main.getBoundingClientRect().left : 0;
  const left = mainLeft + TABLE_VIEWPORT_GUTTER;
  const right = window.innerWidth - TABLE_VIEWPORT_GUTTER;

  return {
    left,
    width: Math.max(0, right - left),
  };
}

export function updateTableWideWidth(wrapper: HTMLElement, mode: TableLayoutMode): void {
  if (mode === 'normal') {
    wrapper.style.removeProperty('--feishu-table-wide-width');
    wrapper.style.removeProperty('--feishu-table-wide-offset');
    return;
  }

  const baseBox = getTableBaseBox(wrapper);
  const layoutBounds = getTableLayoutBounds(wrapper);
  const rightWidth = layoutBounds.left + layoutBounds.width - baseBox.left;
  const nextWidth = Math.min(
    MAX_WIDE_TABLE_WIDTH,
    Math.max(baseBox.width, mode === 'right' ? rightWidth : layoutBounds.width)
  );
  const nextOffset = mode === 'balanced'
    ? Math.round(layoutBounds.left + (layoutBounds.width - nextWidth) / 2 - baseBox.left)
    : 0;

  wrapper.style.setProperty('--feishu-table-wide-width', `${Math.round(nextWidth)}px`);
  wrapper.style.setProperty('--feishu-table-wide-offset', `${nextOffset}px`);
}
