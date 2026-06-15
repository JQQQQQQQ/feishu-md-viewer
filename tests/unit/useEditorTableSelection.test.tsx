import { useEffect, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useEditorTableSelection } from '@/viewer/components/Markdown/Editor/useEditorTableSelection';

function TableSelectionHarness() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(rootRef.current);
  }, []);

  useEditorTableSelection(container, true);

  return (
    <div ref={rootRef}>
      <table>
        <thead>
          <tr>
            <th>H1</th>
            <th>H2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>R1C1</td>
            <td>R1C2</td>
          </tr>
          <tr>
            <td>R2C1</td>
            <td>R2C2</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

describe('useEditorTableSelection', () => {
  function readSelectedDataRows(table: HTMLTableElement): Array<{ row: number; selectedCells: number }> {
    return Array.from(table.rows)
      .map((tr, row) => ({
        row,
        selectedCells: tr.querySelectorAll('td.feishu-table__cell--selected').length,
      }))
      .filter((item) => item.selectedCells > 0);
  }

  it('keeps selection on the anchor row during horizontal drag with minor vertical jitter', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const { container } = render(<TableSelectionHarness />);
    const table = container.querySelector('table') as HTMLTableElement;
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

    const { container } = render(<TableSelectionHarness />);
    const table = container.querySelector('table') as HTMLTableElement;
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

  it('still allows multi-row drag when vertical movement is significant', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const { container } = render(<TableSelectionHarness />);
    const table = container.querySelector('table') as HTMLTableElement;
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const secondRowCell = table.rows[2]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 110, clientY: 130 });
    fireEvent.mouseOver(secondRowCell, { clientX: 110, clientY: 130 });
    fireEvent.mouseUp(document, { clientX: 110, clientY: 130 });

    const selectedRows = readSelectedDataRows(table);
    expect(selectedRows).toHaveLength(2);
    expect(selectedRows[0]?.selectedCells).toBe(1);
    expect(selectedRows[1]?.selectedCells).toBe(1);
  });
});
