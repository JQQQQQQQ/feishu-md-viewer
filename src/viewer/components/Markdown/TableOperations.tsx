import { useEffect, useState, useCallback, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import { TextSelection } from '@milkdown/prose/state';
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
} from '@milkdown/preset-gfm';

interface DotPosition {
  type: 'col' | 'row';
  x: number;
  y: number;
  index: number;
}

/**
 * Feishu-style table dot controls.
 * Shows small gray dots at column borders (top) and row borders (left)
 * when the table is hovered. Hovering a dot enlarges it into a "+" button.
 * Clicking inserts a row/column at that position.
 */
export function TableOperations() {
  const [loading, getEditor] = useInstance();
  const [dots, setDots] = useState<DotPosition[]>([]);
  const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);
  const editorDomRef = useRef<HTMLElement | null>(null);
  const tableHoverRef = useRef(false);
  const tableElRef = useRef<HTMLTableElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;

    let dom: HTMLElement | null = null;

    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        dom = view.dom;
      });
    } catch {
      return;
    }

    if (!dom) return;
    const editorDom: HTMLElement = dom;
    editorDomRef.current = editorDom;

    const computeDots = (table: HTMLTableElement): DotPosition[] => {
      const editorRect = editorDom.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const result: DotPosition[] = [];

      // Column dots: at the top of the table, at each column border
      const firstRow = table.querySelector('tr');
      if (firstRow) {
        const cells = Array.from((firstRow as HTMLTableRowElement).cells);
        // Dots between columns (not at far-left or far-right)
        for (let i = 1; i < cells.length; i++) {
          const cell = cells[i];
          if (!cell) continue;
          const borderX = cell.getBoundingClientRect().left;
          result.push({
            type: 'col',
            x: borderX - editorRect.left,
            y: tableRect.top - editorRect.top - 12,
            index: i,
          });
        }
        // Right edge dot (append column)
        const lastCell = cells[cells.length - 1];
        if (lastCell) {
          const rightEdge = lastCell.getBoundingClientRect().right;
          result.push({
            type: 'col',
            x: rightEdge - editorRect.left,
            y: tableRect.top - editorRect.top - 12,
            index: cells.length,
          });
        }
      }

      // Row dots: at the left of the table, at each row border
      const rows = Array.from(table.querySelectorAll('tr'));
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const borderY = row.getBoundingClientRect().top;
        result.push({
          type: 'row',
          x: tableRect.left - editorRect.left - 12,
          y: borderY - editorRect.top,
          index: i,
        });
      }
      // Bottom edge dot (append row)
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const bottomEdge = lastRow.getBoundingClientRect().bottom;
        result.push({
          type: 'row',
          x: tableRect.left - editorRect.left - 12,
          y: bottomEdge - editorRect.top,
          index: rows.length,
        });
      }

      return result;
    };

    const hideDots = () => {
      tableHoverRef.current = false;
      tableElRef.current = null;
      setDots([]);
      setTableEl(null);
      setHoveredDot(null);
    };

    const scheduleHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(hideDots, 400);
    };

    const cancelHide = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Hovering the dot controls — cancel any pending hide
      if (target.closest('.feishu-table-dot') || target.closest('.feishu-table-border-line')) {
        cancelHide();
        return;
      }

      const table = target.closest('table');

      if (!table || !(table instanceof HTMLTableElement)) {
        // Mouse left table — schedule delayed hide (gives time to reach dots)
        if (tableHoverRef.current) {
          scheduleHide();
        }
        return;
      }

      // Mouse is on a table — cancel any pending hide and show dots
      cancelHide();
      tableHoverRef.current = true;
      tableElRef.current = table;
      setTableEl(table);
      setDots(computeDots(table));
    };

    const handleMouseLeave = () => {
      scheduleHide();
    };

    const listenTarget = editorDom.parentElement ?? editorDom;
    listenTarget.addEventListener('mousemove', handleMouseMove);
    listenTarget.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      listenTarget.removeEventListener('mousemove', handleMouseMove);
      listenTarget.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [loading, getEditor]);

  const handleDotClick = useCallback(
    (dot: DotPosition) => {
      if (!tableEl) return;
      const editor = getEditor();
      if (!editor) return;

      const firstRow = tableEl.querySelector('tr');
      const numCols = firstRow ? (firstRow as HTMLTableRowElement).cells.length : 0;
      const rows = tableEl.querySelectorAll('tr');
      const numRows = rows.length;

      let targetRow: number;
      let targetCol: number;
      let command: typeof addColAfterCommand;

      if (dot.type === 'col') {
        if (dot.index < numCols) {
          targetRow = 0;
          targetCol = dot.index;
          command = addColBeforeCommand;
        } else {
          targetRow = 0;
          targetCol = numCols - 1;
          command = addColAfterCommand;
        }
      } else {
        if (dot.index < numRows) {
          targetRow = dot.index;
          targetCol = 0;
          command = addRowBeforeCommand;
        } else {
          targetRow = numRows - 1;
          targetCol = 0;
          command = addRowAfterCommand;
        }
      }

      const cell = tableEl.querySelector(
        `tr:nth-child(${targetRow + 1}) > td:nth-child(${targetCol + 1}), ` +
          `tr:nth-child(${targetRow + 1}) > th:nth-child(${targetCol + 1})`
      );
      if (!cell) return;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const pos = view.posAtDOM(cell, 0);
          const sel = TextSelection.create(view.state.doc, pos);
          view.dispatch(view.state.tr.setSelection(sel));
          view.focus();
        });

        // Small delay to let selection settle before executing command
        setTimeout(() => {
          editor.action(callCommand(command.key));
        }, 10);
      } catch {
        // posAtDOM can fail if DOM is out of sync
      }

      setHoveredDot(null);
    },
    [tableEl, getEditor]
  );

  if (dots.length === 0 || !tableEl || !editorDomRef.current) return null;

  // Calculate highlight line when a dot is hovered
  const renderHighlightLine = () => {
    if (hoveredDot === null) return null;
    const dot = dots[hoveredDot];
    if (!dot || !editorDomRef.current) return null;

    const tableRect = tableEl.getBoundingClientRect();
    const editorRect = editorDomRef.current.getBoundingClientRect();

    const lineStyle: React.CSSProperties =
      dot.type === 'col'
        ? {
            left: dot.x,
            top: tableRect.top - editorRect.top,
            width: '2px',
            height: tableRect.height,
          }
        : {
            left: tableRect.left - editorRect.left,
            top: dot.y,
            width: tableRect.width,
            height: '2px',
          };

    return <div className="feishu-table-border-line" style={lineStyle} />;
  };

  return (
    <>
      {renderHighlightLine()}
      {dots.map((dot, i) => (
        <div
          key={`${dot.type}-${dot.index}`}
          className={`feishu-table-dot ${hoveredDot === i ? 'feishu-table-dot--active' : ''}`}
          style={{ top: dot.y, left: dot.x }}
          onMouseEnter={() => setHoveredDot(i)}
          onMouseLeave={() => setHoveredDot(null)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleDotClick(dot)}
          title={dot.type === 'col' ? '插入列' : '插入行'}
          aria-label={dot.type === 'col' ? '插入列' : '插入行'}
        />
      ))}
    </>
  );
}
