export interface CellPoint { row: number; col: number }

export interface SelectionState { anchor: CellPoint; focus: CellPoint }

export interface TableCellRange {
  cell: HTMLTableCellElement;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

export interface TableGrid {
  columnCount: number;
  ranges: TableCellRange[];
  cellAt(row: number, col: number): HTMLTableCellElement | null;
  rangeOf(cell: HTMLTableCellElement): TableCellRange | null;
}

function readSpan(cell: HTMLTableCellElement, attribute: 'rowspan' | 'colspan'): number {
  const value = Number.parseInt(cell.getAttribute(attribute) ?? '1', 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function createTableGrid(table: HTMLTableElement): TableGrid {
  const rows = Array.from(table.rows);
  const occupancy: Array<Array<HTMLTableCellElement | undefined>> = [];
  const ranges: TableCellRange[] = [];
  const rangeByCell = new Map<HTMLTableCellElement, TableCellRange>();

  rows.forEach((row, rowIndex) => {
    occupancy[rowIndex] ??= [];
    let colIndex = 0;

    Array.from(row.cells).forEach((cell) => {
      while (occupancy[rowIndex]?.[colIndex]) colIndex += 1;

      const rowSpan = readSpan(cell, 'rowspan');
      const colSpan = readSpan(cell, 'colspan');
      const range: TableCellRange = {
        cell,
        rowStart: rowIndex,
        rowEnd: Math.min(rows.length - 1, rowIndex + rowSpan - 1),
        colStart: colIndex,
        colEnd: colIndex + colSpan - 1,
      };
      ranges.push(range);
      rangeByCell.set(cell, range);

      for (let targetRow = range.rowStart; targetRow <= range.rowEnd; targetRow += 1) {
        const targetRowCells = occupancy[targetRow] ?? (occupancy[targetRow] = []);
        for (let targetCol = range.colStart; targetCol <= range.colEnd; targetCol += 1) {
          // Keep the first cell when malformed HTML contains overlapping spans.
          targetRowCells[targetCol] ??= cell;
        }
      }

      colIndex = range.colEnd + 1;
    });
  });

  const columnCount = Math.max(...occupancy.map((row) => row.length), 0);
  return {
    columnCount,
    ranges,
    cellAt: (row, col) => occupancy[row]?.[col] ?? null,
    rangeOf: (cell) => rangeByCell.get(cell) ?? null,
  };
}

export function getLogicalCellPoint(table: HTMLTableElement, cell: HTMLTableCellElement): CellPoint {
  const range = createTableGrid(table).rangeOf(cell);
  if (range) return { row: range.rowStart, col: range.colStart };

  return {
    row: cell.parentElement instanceof HTMLTableRowElement ? cell.parentElement.rowIndex : 0,
    col: cell.cellIndex,
  };
}

/**
 * Resolve a drag endpoint against the full logical span of a merged cell.
 *
 * A DOM cell that spans multiple columns has one physical `cellIndex`, but a
 * drag ending anywhere in that cell must include every logical column it
 * covers.  The anchor tells us which edge to use when the drag enters the
 * merged range from the left/right or top/bottom.
 */
export function getLogicalCellFocusPoint(
  table: HTMLTableElement,
  cell: HTMLTableCellElement,
  anchor: CellPoint,
): CellPoint {
  const grid = createTableGrid(table);
  const range = grid.rangeOf(cell);
  if (!range) return getLogicalCellPoint(table, cell);

  const row = anchor.row <= range.rowStart ? range.rowEnd : range.rowStart;
  const col = anchor.col <= range.colStart ? range.colEnd : range.colStart;
  return { row, col };
}

export function getLogicalCellAt(table: HTMLTableElement, row: number, col: number): HTMLTableCellElement | null {
  return createTableGrid(table).cellAt(row, col);
}

function getBounds(selection: SelectionState) {
  return {
    startRow: Math.min(selection.anchor.row, selection.focus.row),
    endRow: Math.max(selection.anchor.row, selection.focus.row),
    startCol: Math.min(selection.anchor.col, selection.focus.col),
    endCol: Math.max(selection.anchor.col, selection.focus.col),
  };
}

function shouldIncludeHeaderRow(selection: SelectionState): boolean {
  const bounds = getBounds(selection);
  const selectedCellCount = (bounds.endRow - bounds.startRow + 1) * (bounds.endCol - bounds.startCol + 1);
  return bounds.startRow > 0 && selectedCellCount > 1;
}

function getCopyRows(selection: SelectionState, table?: HTMLTableElement): number[] {
  const bounds = getBounds(selection);
  const rows: number[] = [];
  const addRow = (rowIndex: number) => {
    if (!rows.includes(rowIndex)) rows.push(rowIndex);
  };

  if (shouldIncludeHeaderRow(selection)) {
    const tableRows = table ? Array.from(table.rows) : [];
    const headerRows = table?.tHead
      ? tableRows
        .map((row, rowIndex) => row.parentElement === table.tHead ? rowIndex : -1)
        .filter((rowIndex) => rowIndex >= 0)
      : [0];
    headerRows.forEach(addRow);
  }
  for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex += 1) {
    addRow(rowIndex);
  }

  return rows;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TABLE_COPY_STYLE = [
  'border-collapse:collapse',
  'border-spacing:0',
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  'font-size:12px',
  'color:#1f2329',
].join(';');

const HEADER_CELL_COPY_STYLE = [
  'padding:8px 12px',
  'text-align:left',
  'font-weight:600',
  'background-color:#f5f6f7',
  'border:1px solid #dee0e3',
  'white-space:pre-wrap',
].join(';');

const BODY_CELL_COPY_STYLE = [
  'padding:8px 12px',
  'text-align:left',
  'font-weight:400',
  'background-color:#ffffff',
  'border:1px solid #ebedf0',
  'white-space:pre-wrap',
].join(';');

function getCellText(cell: HTMLTableCellElement): string {
  return (cell.innerText || cell.textContent || '').trim();
}

export function clearTableSelection(table: HTMLTableElement): void {
  table.querySelectorAll('.feishu-table__cell--selected, .feishu-table__header--selected')
    .forEach((cell) => {
      cell.classList.remove('feishu-table__cell--selected', 'feishu-table__header--selected');
    });
}

export function renderTableSelection(table: HTMLTableElement, selection: SelectionState): string {
  const visualBounds = getBounds(selection);
  const copyRows = getCopyRows(selection, table);
  const rows = Array.from(table.rows);
  const grid = createTableGrid(table);
  const selectedRows: string[] = [];
  const selectedCells = new Set<HTMLTableCellElement>();

  clearTableSelection(table);

  for (let rowIndex = visualBounds.startRow; rowIndex <= visualBounds.endRow; rowIndex += 1) {
    for (let colIndex = visualBounds.startCol; colIndex <= visualBounds.endCol; colIndex += 1) {
      const cell = grid.cellAt(rowIndex, colIndex);
      if (!cell) continue;
      if (selectedCells.has(cell)) continue;
      selectedCells.add(cell);

      cell.classList.add(
        cell.tagName.toLowerCase() === 'th'
          ? 'feishu-table__header--selected'
          : 'feishu-table__cell--selected'
      );
    }
  }

  for (const rowIndex of copyRows) {
    if (!rows[rowIndex]) continue;

    const selectedCells: string[] = [];
    const copiedCells = new Set<HTMLTableCellElement>();
    for (let colIndex = visualBounds.startCol; colIndex <= visualBounds.endCol; colIndex += 1) {
      const cell = grid.cellAt(rowIndex, colIndex);
      if (!cell) {
        selectedCells.push('');
        continue;
      }

      if (copiedCells.has(cell)) {
        selectedCells.push('');
        continue;
      }

      copiedCells.add(cell);
      selectedCells.push(getCellText(cell));
    }

    selectedRows.push(selectedCells.join('\t'));
  }

  return selectedRows.join('\n');
}

export function renderTableSelectionHtml(table: HTMLTableElement, selection: SelectionState): string {
  const bounds = getBounds(selection);
  const copyRows = getCopyRows(selection, table);
  const rows = Array.from(table.rows);
  const grid = createTableGrid(table);
  const headRows: string[] = [];
  const bodyRows: string[] = [];

  for (const rowIndex of copyRows) {
    const row = rows[rowIndex];
    if (!row) continue;

    const selectedCells: string[] = [];
    const renderedCells = new Set<HTMLTableCellElement>();
    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex += 1) {
      const cell = grid.cellAt(rowIndex, colIndex);
      const range = cell ? grid.rangeOf(cell) : null;
      // A rowspan is already emitted in the row where it starts.  Emitting a
      // placeholder again in following rows shifts Excel's grid and creates
      // a fake blank cell beside the merged header/body area.
      if (cell && range && range.rowStart < rowIndex) continue;
      if (cell && renderedCells.has(cell)) continue;
      if (cell) renderedCells.add(cell);

      const tag = cell?.tagName.toLowerCase() === 'th' ? 'th' : 'td';
      const style = tag === 'th' ? HEADER_CELL_COPY_STYLE : BODY_CELL_COPY_STYLE;
      // Excel's HTML clipboard importer is more reliable with the legacy
      // `bgcolor` attribute in addition to inline CSS, especially for merged
      // cells and multi-row table heads.
      const backgroundColor = tag === 'th' ? '#f5f6f7' : '#ffffff';
      const backgroundAttribute = ` bgcolor="${backgroundColor}"`;
      const scope = tag === 'th' ? ' scope="col"' : '';
      const isCellAnchor = Boolean(range && range.rowStart === rowIndex && range.colStart === colIndex);
      const rowSpan = isCellAnchor && range
        ? Math.min(range.rowEnd, bounds.endRow) - rowIndex + 1
        : 1;
      const colSpan = isCellAnchor && range
        ? Math.min(range.colEnd, bounds.endCol) - colIndex + 1
        : 1;
      const rowSpanAttribute = rowSpan > 1 ? ` rowspan="${rowSpan}"` : '';
      const colSpanAttribute = colSpan > 1 ? ` colspan="${colSpan}"` : '';
      selectedCells.push(`<${tag}${scope}${rowSpanAttribute}${colSpanAttribute}${backgroundAttribute} style="${style}">${escapeHtml(cell ? getCellText(cell) : '')}</${tag}>`);
    }

    const rowHtml = `<tr>${selectedCells.join('')}</tr>`;
    const isSourceHeaderRow = row.parentElement === table.tHead;
    if (isSourceHeaderRow) {
      headRows.push(rowHtml);
      continue;
    }

    bodyRows.push(rowHtml);
  }

  const theadHtml = headRows.length > 0 ? `<thead>${headRows.join('')}</thead>` : '';
  const tbodyHtml = bodyRows.length > 0 ? `<tbody>${bodyRows.join('')}</tbody>` : '';

  return `<table style="${TABLE_COPY_STYLE}">${theadHtml}${tbodyHtml}</table>`;
}

export function getWholeTableSelection(table: HTMLTableElement): SelectionState | null {
  const rows = Array.from(table.rows);
  const rowCount = rows.length;
  const colCount = createTableGrid(table).columnCount;
  if (rowCount === 0 || colCount === 0) return null;

  return {
    anchor: { row: 0, col: 0 },
    focus: { row: rowCount - 1, col: colCount - 1 },
  };
}
