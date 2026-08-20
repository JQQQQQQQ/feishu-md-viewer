import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTableColumnWidths,
  getTableWidthStorageKey,
  persistTableColumnWidths,
  readPersistedTableColumnWidths,
  restorePersistedTableColumnWidths,
} from '@/viewer/components/Markdown/FeishuTableColumnWidths';

function createTable(rows: string[][]): HTMLTableElement {
  const table = document.createElement('table');
  rows.forEach((cells) => {
    const row = table.insertRow();
    cells.forEach((text) => {
      row.insertCell().textContent = text;
    });
  });

  return table;
}

describe('FeishuTableColumnWidths', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/docs/table-test.md');
  });

  it('persists widths for the same document and table fingerprint', () => {
    const table = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ]);

    applyTableColumnWidths(table, [180, 260]);
    persistTableColumnWidths(table);

    const sameTable = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ]);

    expect(readPersistedTableColumnWidths(sameTable)).toEqual([180, 260]);
  });

  it('does not reuse widths for a different table fingerprint', () => {
    const table = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ]);
    applyTableColumnWidths(table, [180, 260]);
    persistTableColumnWidths(table);

    const otherTable = createTable([
      ['Name', 'Status'],
      ['Build', 'Passing'],
    ]);

    expect(readPersistedTableColumnWidths(otherTable)).toBeNull();
  });

  it('applies widths to every cell in each stored column', () => {
    const table = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
      ['TOC Navigation', 'Shell'],
    ]);

    applyTableColumnWidths(table, [144, 288]);

    expect(table.rows[0].cells[0].style.width).toBe('144px');
    expect(table.rows[1].cells[0].style.minWidth).toBe('144px');
    expect(table.rows[1].cells[0].style.maxWidth).toBe('144px');
    expect(table.rows[2].cells[1].style.width).toBe('288px');
  });

  it('ignores invalid storage payloads', () => {
    const table = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ]);

    window.localStorage.setItem(getTableWidthStorageKey(table), '{broken json');

    expect(readPersistedTableColumnWidths(table)).toBeNull();
    expect(restorePersistedTableColumnWidths(table)).toBe(false);
  });

  it('keeps widths scoped to the current document URL', () => {
    const table = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ]);
    applyTableColumnWidths(table, [180, 260]);
    persistTableColumnWidths(table);

    window.history.replaceState(null, '', '/docs/another-table-test.md');

    expect(readPersistedTableColumnWidths(table)).toBeNull();
  });
});
