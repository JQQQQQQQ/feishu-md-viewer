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
    expect(html).toContain('<th style="');
    expect(html).toContain('font-weight:600');
    expect(html).toContain('background:#f5f6f7');
    expect(html).toContain('>A</th>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<td style="');
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
});
