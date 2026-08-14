export interface CellPoint { row: number; col: number }

export interface SelectionState { anchor: CellPoint; focus: CellPoint }

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

function getCopyRows(selection: SelectionState): number[] {
  const bounds = getBounds(selection);
  const rows: number[] = [];

  if (shouldIncludeHeaderRow(selection)) rows.push(0);
  for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex += 1) {
    rows.push(rowIndex);
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
  'background:#f5f6f7',
  'border:1px solid #dee0e3',
  'white-space:pre-wrap',
].join(';');

const BODY_CELL_COPY_STYLE = [
  'padding:8px 12px',
  'text-align:left',
  'font-weight:400',
  'background:#ffffff',
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
  const copyRows = getCopyRows(selection);
  const rows = Array.from(table.rows);
  const selectedRows: string[] = [];

  clearTableSelection(table);

  for (let rowIndex = visualBounds.startRow; rowIndex <= visualBounds.endRow; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;

    for (let colIndex = visualBounds.startCol; colIndex <= visualBounds.endCol; colIndex += 1) {
      const cell = row.cells[colIndex];
      if (!cell) continue;

      cell.classList.add(
        cell.tagName.toLowerCase() === 'th'
          ? 'feishu-table__header--selected'
          : 'feishu-table__cell--selected'
      );
    }
  }

  for (const rowIndex of copyRows) {
    const row = rows[rowIndex];
    if (!row) continue;

    const selectedCells: string[] = [];
    for (let colIndex = visualBounds.startCol; colIndex <= visualBounds.endCol; colIndex += 1) {
      const cell = row.cells[colIndex];
      if (!cell) {
        selectedCells.push('');
        continue;
      }

      selectedCells.push(getCellText(cell));
    }

    selectedRows.push(selectedCells.join('\t'));
  }

  return selectedRows.join('\n');
}

export function renderTableSelectionHtml(table: HTMLTableElement, selection: SelectionState): string {
  const bounds = getBounds(selection);
  const copyRows = getCopyRows(selection);
  const rows = Array.from(table.rows);
  const headRows: string[] = [];
  const bodyRows: string[] = [];

  for (const rowIndex of copyRows) {
    const row = rows[rowIndex];
    if (!row) continue;

    const selectedCells: string[] = [];
    let headerCellCount = 0;
    let renderedCellCount = 0;
    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex += 1) {
      const cell = row.cells[colIndex];
      const tag = cell?.tagName.toLowerCase() === 'th' ? 'th' : 'td';
      const style = tag === 'th' ? HEADER_CELL_COPY_STYLE : BODY_CELL_COPY_STYLE;
      const scope = tag === 'th' ? ' scope="col"' : '';
      selectedCells.push(`<${tag}${scope} style="${style}">${escapeHtml(cell ? getCellText(cell) : '')}</${tag}>`);
      renderedCellCount += 1;
      if (tag === 'th') headerCellCount += 1;
    }

    const rowHtml = `<tr>${selectedCells.join('')}</tr>`;
    const isHeaderRow = renderedCellCount > 0 && headerCellCount === renderedCellCount;
    if (isHeaderRow && headRows.length === 0) {
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
  const colCount = Math.max(...rows.map((row) => row.cells.length), 0);
  if (rowCount === 0 || colCount === 0) return null;

  return {
    anchor: { row: 0, col: 0 },
    focus: { row: rowCount - 1, col: colCount - 1 },
  };
}
