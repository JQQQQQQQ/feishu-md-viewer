import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTableColumnWidths,
  getTableColumnWidths,
  getTableWidthStorageKey,
  persistTableColumnWidths,
  readPersistedTableColumnWidths,
  restorePersistedTableColumnWidths,
  getTablePersistenceKey,
  setTableColumnWidthsBridge,
} from '@/viewer/components/Markdown/FeishuTableColumnWidths';

function createTable(rows: string[][], tableId?: string): HTMLTableElement {
  const table = document.createElement('table');
  if (tableId) table.dataset.feishuTableId = tableId;
  rows.forEach((cells) => {
    const row = table.insertRow();
    cells.forEach((text) => {
      row.insertCell().textContent = text;
    });
  });

  return table;
}

function createMergedTable(): HTMLTableElement {
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr><th rowspan="2">项目</th><th colspan="2">进度</th></tr>
      <tr><th>负责人</th><th>状态</th></tr>
    </thead>
    <tbody>
      <tr><td rowspan="2">Markdown 预览</td><td>小 Q</td><td>已完成</td></tr>
      <tr><td colspan="2">后续进行 GitHub README 兼容性验收</td></tr>
    </tbody>
  `;
  return table;
}

describe('FeishuTableColumnWidths', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/docs/table-test.md');
    setTableColumnWidthsBridge(undefined);
  });

  it('使用 VS Code 宿主桥接保存和恢复列宽，不依赖 Webview localStorage', () => {
    const table = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ]);
    const read = vi.fn(() => [180, 260]);
    const write = vi.fn();
    setTableColumnWidthsBridge({ read, write });

    expect(restorePersistedTableColumnWidths(table)).toBe(true);
    expect(table.rows[0].cells[0].style.width).toBe('180px');

    persistTableColumnWidths(table);

    expect(read).toHaveBeenCalledWith(expect.any(String));
    expect(write).toHaveBeenCalledWith(expect.any(String), [180, 260]);
    expect(window.localStorage.length).toBe(0);
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

  it('keeps widths when the same stable table changes its cell content', () => {
    const table = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ], 'section-intro-table-1');
    applyTableColumnWidths(table, [180, 260]);
    persistTableColumnWidths(table);

    const editedTable = createTable([
      ['Updated feature name', 'New owner'],
      ['Changed content', 'Still the same table'],
      ['A new row', 'Added later'],
    ], 'section-intro-table-1');

    expect(getTablePersistenceKey(editedTable)).toBe(getTablePersistenceKey(table));
    expect(readPersistedTableColumnWidths(editedTable)).toEqual([180, 260]);
  });

  it('does not reuse stable widths for another table with a different stable id', () => {
    const table = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ], 'section-intro-table-1');
    applyTableColumnWidths(table, [180, 260]);
    persistTableColumnWidths(table);

    const otherTable = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ], 'section-intro-table-2');

    expect(readPersistedTableColumnWidths(otherTable)).toBeNull();
  });

  it('reads legacy fingerprint widths after a stable id is introduced', () => {
    const legacyTable = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ]);
    applyTableColumnWidths(legacyTable, [180, 260]);
    persistTableColumnWidths(legacyTable);

    const stableTable = createTable([
      ['Feature', 'Owner'],
      ['Markdown Rendering', 'Viewer'],
    ], 'section-intro-table-1');

    expect(readPersistedTableColumnWidths(stableTable)).toEqual([180, 260]);
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

  it('applies independent logical column widths when cells are merged', () => {
    const table = createMergedTable();

    applyTableColumnWidths(table, [120, 180, 220]);

    const cols = table.querySelectorAll(':scope > colgroup > col');
    expect(cols).toHaveLength(3);
    expect(Array.from(cols).map((col) => col.getAttribute('style'))).toEqual([
      'width: 120px; min-width: 120px; max-width: 120px;',
      'width: 180px; min-width: 180px; max-width: 180px;',
      'width: 220px; min-width: 220px; max-width: 220px;',
    ]);
    expect(getTableColumnWidths(table)).toEqual([120, 180, 220]);
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
