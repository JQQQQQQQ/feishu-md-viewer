import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { FeishuTable } from '@/viewer/components/Markdown/FeishuTable';

function TableHarness() {
  return (
    <FeishuTable>
      <thead>
        <tr>
          <th>H1</th>
          <th>H2</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td />
          <td />
        </tr>
        <tr>
          <td />
          <td />
        </tr>
      </tbody>
    </FeishuTable>
  );
}

function readSelectedDataRows(table: HTMLTableElement): Array<{ row: number; selectedCells: number }> {
  return Array.from(table.rows)
    .map((tr, row) => ({
      row,
      selectedCells: tr.querySelectorAll('td.feishu-table__cell--selected').length,
    }))
    .filter((item) => item.selectedCells > 0);
}

function getSourceTable(container: HTMLElement): HTMLTableElement {
  const table = container.querySelector('.feishu-table-wrapper > table.feishu-table');
  if (!(table instanceof HTMLTableElement)) {
    throw new Error('Source table is missing.');
  }
  return table;
}

describe('FeishuTable selection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps selection on one row during horizontal drag with minor vertical jitter', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const otherRowCell = table.rows[2]?.cells[1] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 180, clientY: 102 });
    fireEvent.mouseOver(otherRowCell, { clientX: 180, clientY: 102 });
    fireEvent.mouseUp(document, { clientX: 180, clientY: 102 });

    const selectedRows = readSelectedDataRows(table);
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]?.selectedCells).toBe(2);
  });

  it('supports diagonal drag to select a rectangular block', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const otherRowCell = table.rows[2]?.cells[1] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 220, clientY: 136 });
    fireEvent.mouseOver(otherRowCell, { clientX: 220, clientY: 136 });
    fireEvent.mouseUp(document, { clientX: 220, clientY: 136 });

    const selectedRows = readSelectedDataRows(table);
    expect(selectedRows).toHaveLength(2);
    expect(selectedRows[0]?.selectedCells).toBe(2);
    expect(selectedRows[1]?.selectedCells).toBe(2);
  });

  it('still allows multi-row selection for vertical-dominant drag', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const secondRowCell = table.rows[2]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 112, clientY: 140 });
    fireEvent.mouseOver(secondRowCell, { clientX: 112, clientY: 140 });
    fireEvent.mouseUp(document, { clientX: 112, clientY: 140 });

    const selectedRows = readSelectedDataRows(table);
    expect(selectedRows).toHaveLength(2);
    expect(selectedRows[0]?.selectedCells).toBe(1);
    expect(selectedRows[1]?.selectedCells).toBe(1);
  });

  it('focuses table wrapper with preventScroll to avoid viewport jump', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('observes the content parent so sidebar resizing recalculates table width', () => {
    const observed: Element[] = [];
    class TestResizeObserver {
      observe(target: Element) { observed.push(target); }
      disconnect() {}
    }
    const previousResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { container } = render(<TableHarness />);
      const wrapper = container.querySelector('.feishu-table-wrapper');
      expect(wrapper).not.toBeNull();
      expect(observed).toContain(wrapper?.parentElement);
    } finally {
      globalThis.ResizeObserver = previousResizeObserver;
    }
  });

  it('does not hijack mousedown when the pointer is on selectable cell text', () => {
    const preventDefault = vi.fn();
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const cell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    cell.textContent = 'R1C1';
    const caretSpy = vi.fn(() => ({
      commonAncestorContainer: cell.firstChild,
    } as Range));
    Object.defineProperty(document, 'caretRangeFromPoint', { configurable: true, value: caretSpy });

    fireEvent.mouseDown(cell, { button: 0, buttons: 1, clientX: 100, clientY: 100, preventDefault });

    expect(caretSpy).toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(readSelectedDataRows(table)).toHaveLength(0);
  });

  it('lets the browser copy a partial native text selection instead of table TSV', () => {
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const cell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    cell.textContent = 'R1C1';
    const text = cell.firstChild;
    if (!text) throw new Error('Cell text is missing.');

    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 2);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const preventDefault = vi.fn();
    const setData = vi.fn();
    fireEvent.copy(document, { preventDefault, clipboardData: { setData } });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
    window.getSelection()?.removeAllRanges();
  });
});
