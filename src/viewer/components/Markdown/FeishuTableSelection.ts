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

function getCopyBounds(selection: SelectionState) {
  const bounds = getBounds(selection);
  return {
    ...bounds,
    startRow: shouldIncludeHeaderRow(selection) ? 0 : bounds.startRow,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  const bounds = getCopyBounds(selection);
  const rows = Array.from(table.rows);
  const selectedRows: string[] = [];

  clearTableSelection(table);

  for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;

    const selectedCells: string[] = [];
    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex += 1) {
      const cell = row.cells[colIndex];
      if (!cell) {
        selectedCells.push('');
        continue;
      }

      cell.classList.add(
        cell.tagName.toLowerCase() === 'th'
          ? 'feishu-table__header--selected'
          : 'feishu-table__cell--selected'
      );
      selectedCells.push(getCellText(cell));
    }

    selectedRows.push(selectedCells.join('\t'));
  }

  return selectedRows.join('\n');
}

export function renderTableSelectionHtml(table: HTMLTableElement, selection: SelectionState): string {
  const bounds = getCopyBounds(selection);
  const rows = Array.from(table.rows);
  const selectedRows: string[] = [];

  for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;

    const selectedCells: string[] = [];
    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex += 1) {
      const cell = row.cells[colIndex];
      const tag = cell?.tagName.toLowerCase() === 'th' ? 'th' : 'td';
      selectedCells.push(`<${tag}>${escapeHtml(cell ? getCellText(cell) : '')}</${tag}>`);
    }

    selectedRows.push(`<tr>${selectedCells.join('')}</tr>`);
  }

  return `<table><tbody>${selectedRows.join('')}</tbody></table>`;
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
