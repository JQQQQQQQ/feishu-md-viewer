import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownReadView } from '@/viewer/components/Markdown/MarkdownReadView';
import {
  setTableColumnWidthsBridge,
} from '@/viewer/components/Markdown/FeishuTableColumnWidths';
import {
  getTableIdentityCandidate,
  persistTableIdentities,
  readPersistedTableIdentities,
} from '@/viewer/components/Markdown/FeishuTableIdentity';

function getSourceTableIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLTableElement>('.feishu-table__scrollport > table'))
    .map((table) => table.dataset.feishuTableId ?? '');
}

describe('MarkdownReadView table identities', () => {
  it('matches inserted tables by their position within the same section', () => {
    window.localStorage.clear();
    const initial = `## Data

| A | B |
| --- | --- |
| 1 | 2 |

Paragraph between tables.

| C | D |
| --- | --- |
| 3 | 4 |`;
    const withInsertedTable = `## Data

| A | B |
| --- | --- |
| 1 | 2 |

Paragraph between tables.

| X | Y |
| --- | --- |
| 9 | 10 |

| C | D |
| --- | --- |
| 3 | 4 |`;

    const view = render(<MarkdownReadView content={initial} />);
    const initialIds = getSourceTableIds(view.container);

    view.unmount();
    const nextView = render(<MarkdownReadView content={withInsertedTable} />);
    const nextIds = getSourceTableIds(nextView.container);

    expect(initialIds).toHaveLength(2);
    expect(nextIds).toHaveLength(3);
    expect(nextIds[0]).toBe(initialIds[0]);
    expect(nextIds[1]).toBe(initialIds[1]);
    expect(nextIds[1]).not.toBe(initialIds[0]);
    expect(nextIds[2]).not.toBe(initialIds[0]);
    expect(nextIds[2]).not.toBe(initialIds[1]);
    nextView.unmount();
  });

  it('reapplies the persisted table id when the document is rendered again', () => {
    window.localStorage.clear();
    const content = '## Data\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';

    const firstView = render(<MarkdownReadView content={content} />);
    const initialIdentities = readPersistedTableIdentities();
    expect(initialIdentities).toHaveLength(1);

    const persistedId = 'table-persisted-after-reopen';
    persistTableIdentities(initialIdentities.map((identity) => ({
      ...identity,
      id: persistedId,
      currentId: 'old-render-candidate',
    })));
    firstView.unmount();

    const reopenedView = render(<MarkdownReadView content={content} />);

    expect(getSourceTableIds(reopenedView.container)).toEqual([persistedId]);
    reopenedView.unmount();
  });

  it('restores persisted column widths after remounting the document', () => {
    window.localStorage.clear();
    const content = '## Data\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';

    const firstView = render(<MarkdownReadView content={content} />);
    const firstTable = firstView.container.querySelector<HTMLTableElement>('.feishu-table__scrollport > table');
    if (!firstTable) throw new Error('Initial source table is missing.');
    const candidate = getTableIdentityCandidate(firstTable);
    if (!candidate) throw new Error('Initial table identity candidate is missing.');
    firstView.unmount();

    const persistedId = 'table-persisted-widths';
    const identities = [{ ...candidate, id: persistedId, currentId: 'old-render-candidate' }];
    const read = vi.fn((tableKey: string) => tableKey === `stable:${persistedId}` ? [180, 260] : null);
    setTableColumnWidthsBridge({
      read,
      write: vi.fn(),
      readIdentities: () => identities,
      writeIdentities: vi.fn(),
    });

    const reopenedView = render(<MarkdownReadView content={content} />);
    const reopenedTable = reopenedView.container.querySelector<HTMLTableElement>('.feishu-table__scrollport > table');
    if (!reopenedTable) throw new Error('Reopened source table is missing.');

    expect(reopenedTable.dataset.feishuTableId).toBe(persistedId);
    expect(reopenedTable.rows[0]?.cells[0]?.style.width).toBe('180px');
    expect(read).toHaveBeenCalledWith(`stable:${persistedId}`);
    reopenedView.unmount();
    setTableColumnWidthsBridge(undefined);
  });

  it('restores widths when the host snapshot arrives after the table has mounted', () => {
    window.localStorage.clear();
    const content = '## Data\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
    let ready = false;
    const persistedId = 'table-delayed-snapshot';
    const identities = [{
      id: persistedId,
      currentId: 'old-render-candidate',
      headingPath: '2:1',
      text: 'A B 1 2',
      columnCount: 2,
      ordinal: 0,
    }];
    const read = vi.fn((tableKey: string) => ready && tableKey === `stable:${persistedId}` ? [180, 260] : null);
    setTableColumnWidthsBridge({
      read,
      write: vi.fn(),
      readIdentities: () => ready ? identities : null,
      writeIdentities: vi.fn(),
    });

    const view = render(<MarkdownReadView content={content} />);
    const table = view.container.querySelector<HTMLTableElement>('.feishu-table__scrollport > table');
    if (!table) throw new Error('Source table is missing.');
    expect(table.rows[0]?.cells[0]?.style.width).toBe('');

    act(() => {
      ready = true;
      window.dispatchEvent(new Event('feishu-table-widths-updated'));
      window.dispatchEvent(new Event('feishu-table-identities-updated'));
    });

    expect(table.dataset.feishuTableId).toBe(persistedId);
    expect(table.rows[0]?.cells[0]?.style.width).toBe('180px');
    expect(read).toHaveBeenCalledWith(`stable:${persistedId}`);
    view.unmount();
    setTableColumnWidthsBridge(undefined);
  });

  it('notifies mounted tables after remapping ids even when the identity snapshot is otherwise equal', () => {
    window.localStorage.clear();
    const content = '## Data\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';

    const initialView = render(<MarkdownReadView content={content} />);
    const initialTable = initialView.container.querySelector<HTMLTableElement>('.feishu-table__scrollport > table');
    if (!initialTable) throw new Error('Initial source table is missing.');
    const candidate = getTableIdentityCandidate(initialTable);
    if (!candidate) throw new Error('Initial table identity candidate is missing.');
    initialView.unmount();

    const persistedId = 'table-equal-snapshot-remap';
    const identities = [{ ...candidate, id: persistedId, currentId: 'old-render-candidate' }];
    setTableColumnWidthsBridge({
      read: () => [180, 260],
      write: vi.fn(),
      readIdentities: () => identities,
      writeIdentities: vi.fn(),
    });
    const widthsUpdated = vi.fn();
    window.addEventListener('feishu-table-widths-updated', widthsUpdated);

    try {
      const reopenedView = render(<MarkdownReadView content={content} />);

      expect(reopenedView.container.querySelector<HTMLTableElement>('.feishu-table__scrollport > table')?.dataset.feishuTableId)
        .toBe(persistedId);
      expect(widthsUpdated).toHaveBeenCalled();
      reopenedView.unmount();
    } finally {
      window.removeEventListener('feishu-table-widths-updated', widthsUpdated);
      setTableColumnWidthsBridge(undefined);
    }
  });

  it('does not write the same identity snapshot again when the host echoes it', () => {
    window.localStorage.clear();
    let identities: Array<{
      id: string;
      currentId: string;
      headingPath: string;
      text: string;
      columnCount: number;
      ordinal: number;
    }> | null = null;
    const writeIdentities = vi.fn((next) => {
      identities = next;
    });
    setTableColumnWidthsBridge({
      read: () => null,
      write: () => undefined,
      readIdentities: () => identities,
      writeIdentities,
    });

    const view = render(<MarkdownReadView content={'## Data\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'} />);
    window.dispatchEvent(new Event('feishu-table-identities-updated'));

    expect(writeIdentities).toHaveBeenCalledTimes(1);
    view.unmount();
    setTableColumnWidthsBridge(undefined);
  });
});
