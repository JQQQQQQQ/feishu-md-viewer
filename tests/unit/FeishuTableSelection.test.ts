import { describe, expect, it } from 'vitest';
import {
  clearTableSelection,
  renderTableSelection,
  renderTableSelectionHtml,
  type SelectionState,
} from '@/viewer/components/Markdown/FeishuTableSelection';

function createTable(): HTMLTableElement {
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>A</th>
        <th>B</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>2</td>
      </tr>
      <tr>
        <td>3</td>
        <td>4</td>
      </tr>
      <tr>
        <td>5</td>
        <td>6</td>
      </tr>
    </tbody>
  `;
  return table;
}

function createMergedTable(): HTMLTableElement {
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th rowspan="2">项目</th>
        <th colspan="2">进度</th>
      </tr>
      <tr>
        <th>负责人</th>
        <th>状态</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td rowspan="2">Markdown</td>
        <td>小 Q</td>
        <td>已完成</td>
      </tr>
      <tr>
        <td colspan="2">后续进行 GitHub README 兼容性验收</td>
      </tr>
    </tbody>
  `;
  return table;
}

describe('FeishuTableSelection', () => {
  it('keeps visual selection to a single data row when selecting multiple columns in that row', () => {
    const table = createTable();
    const selection: SelectionState = {
      anchor: { row: 2, col: 0 },
      focus: { row: 2, col: 1 },
    };

    const text = renderTableSelection(table, selection);

    expect(text).toBe('A\tB\n3\t4');
    expect(table.querySelectorAll('td.feishu-table__cell--selected')).toHaveLength(2);
    expect(table.rows[2]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[2]?.cells[1]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[1]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(false);
    expect(table.rows[3]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(false);
  });

  it('includes header for multi-cell copy without expanding visual selection to intermediate rows', () => {
    const table = createTable();
    const selection: SelectionState = {
      anchor: { row: 1, col: 0 },
      focus: { row: 2, col: 0 },
    };

    const text = renderTableSelection(table, selection);
    const html = renderTableSelectionHtml(table, selection);

    expect(text).toBe('A\n1\n3');
    expect(html).toContain('<table style="');
    expect(html).toContain('<thead>');
    expect(html).toContain('<th scope="col" bgcolor="#f5f6f7" style="');
    expect(html).toContain('font-weight:600');
    expect(html).toContain('background-color:#f5f6f7');
    expect(html).toContain('>A</th>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<td bgcolor="#ffffff" style="');
    expect(html).toContain('font-weight:400');
    expect(html).toContain('>1</td>');
    expect(html).toContain('>3</td>');
    expect(table.querySelectorAll('td.feishu-table__cell--selected')).toHaveLength(2);
    expect(table.querySelectorAll('th.feishu-table__header--selected')).toHaveLength(0);
  });

  it('clears existing selection markers', () => {
    const table = createTable();
    table.querySelectorAll('th,td').forEach((cell) => {
      cell.classList.add('feishu-table__cell--selected', 'feishu-table__header--selected');
    });

    clearTableSelection(table);
    expect(table.querySelectorAll('.feishu-table__cell--selected,.feishu-table__header--selected')).toHaveLength(0);
  });

  it('maps a click on a merged header row to its logical column', () => {
    const table = createMergedTable();
    const selection: SelectionState = {
      anchor: { row: 1, col: 2 },
      focus: { row: 1, col: 2 },
    };

    const text = renderTableSelection(table, selection);

    expect(text).toBe('状态');
    expect(table.rows[1]?.cells[0]?.classList.contains('feishu-table__header--selected')).toBe(false);
    expect(table.rows[1]?.cells[1]?.classList.contains('feishu-table__header--selected')).toBe(true);
  });

  it('selects a merged data cell once when its covered logical column is targeted', () => {
    const table = createMergedTable();
    const selection: SelectionState = {
      anchor: { row: 2, col: 2 },
      focus: { row: 2, col: 2 },
    };

    const text = renderTableSelection(table, selection);

    expect(text).toBe('已完成');
    expect(table.querySelectorAll('td.feishu-table__cell--selected')).toHaveLength(1);
    expect(table.rows[2]?.cells[2]?.classList.contains('feishu-table__cell--selected')).toBe(true);
  });

  it('keeps merged spans in rich clipboard output', () => {
    const table = createMergedTable();
    const selection: SelectionState = {
      anchor: { row: 3, col: 1 },
      focus: { row: 3, col: 2 },
    };

    const html = renderTableSelectionHtml(table, selection);

    expect(html).toContain('colspan="2"');
    expect(html).toContain('>后续进行 GitHub README 兼容性验收</td>');
  });

  it('keeps every merged header row inside the copied table head', () => {
    const table = createMergedTable();
    const selection: SelectionState = {
      anchor: { row: 1, col: 0 },
      focus: { row: 3, col: 2 },
    };

    const html = renderTableSelectionHtml(table, selection);
    const copiedTable = document.createElement('div');
    copiedTable.innerHTML = html;

    const copiedHead = copiedTable.querySelector('thead');
    expect(copiedHead?.querySelectorAll('tr')).toHaveLength(2);
    expect(copiedHead?.textContent).toContain('负责人');
    expect(copiedHead?.textContent).toContain('状态');
    expect(copiedTable.querySelector('tbody')?.querySelectorAll('th')).toHaveLength(0);
  });

  it('does not duplicate row-spanning cells into the following copied rows', () => {
    const table = createMergedTable();
    const selection: SelectionState = {
      anchor: { row: 1, col: 0 },
      focus: { row: 3, col: 2 },
    };

    const html = renderTableSelectionHtml(table, selection);
    const copiedTable = document.createElement('div');
    copiedTable.innerHTML = html;

    expect(copiedTable.querySelectorAll('thead th').length).toBe(4);
    expect(copiedTable.querySelectorAll('thead th')[0]?.getAttribute('rowspan')).toBe('2');
    expect(copiedTable.querySelectorAll('thead th')[0]?.textContent).toBe('项目');
    expect(copiedTable.querySelectorAll('tbody td').length).toBe(4);
    expect(copiedTable.querySelectorAll('tbody td')[0]?.getAttribute('rowspan')).toBe('2');
    expect(copiedTable.querySelectorAll('tbody td')[0]?.textContent).toBe('Markdown');
    expect(copiedTable.querySelectorAll('tbody td')[3]?.textContent).toContain('后续进行');
  });

  it('writes Excel-compatible background attributes for copied headers', () => {
    const table = createMergedTable();
    const selection: SelectionState = {
      anchor: { row: 1, col: 0 },
      focus: { row: 3, col: 2 },
    };

    const html = renderTableSelectionHtml(table, selection);
    const copiedTable = document.createElement('div');
    copiedTable.innerHTML = html;

    const headerCells = Array.from(copiedTable.querySelectorAll('thead th'));
    expect(headerCells).toHaveLength(4);
    headerCells.forEach((cell) => {
      expect(cell.getAttribute('bgcolor')).toBe('#f5f6f7');
      expect(cell.getAttribute('style')).toContain('background-color:#f5f6f7');
    });
  });
});
