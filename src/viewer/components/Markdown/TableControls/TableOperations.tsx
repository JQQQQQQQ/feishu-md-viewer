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

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Mouse is on a dot or border line — keep visible, do nothing
      if (target.closest('.feishu-table-dot') || target.closest('.feishu-table-border-line')) {
        return;
      }

      // Check if mouse is directly on a table
      const table = target.closest('table');

      if (table && table instanceof HTMLTableElement) {
        // Mouse on table — show dots
        tableHoverRef.current = true;
        tableElRef.current = table;
        setTableEl(table);
        setDots(computeDots(table));
        return;
      }

      // Mouse is NOT on table and NOT on dot — check if in expanded zone
      const currentTable = tableElRef.current;
      if (currentTable && tableHoverRef.current) {
        const rect = currentTable.getBoundingClientRect();
        // Expanded zone: 50px left, 40px top, 20px right/bottom
        if (
          e.clientX >= rect.left - 50 &&
          e.clientX <= rect.right + 20 &&
          e.clientY >= rect.top - 40 &&
          e.clientY <= rect.bottom + 20
        ) {
          return; // In expanded zone — keep dots visible
        }
      }

      // Outside everything — hide dots immediately
      if (tableHoverRef.current) {
        tableHoverRef.current = false;
        tableElRef.current = null;
        setDots([]);
        setTableEl(null);
        setHoveredDot(null);
      }
    };

    const handleMouseLeave = () => {
      if (tableHoverRef.current) {
        tableHoverRef.current = false;
        tableElRef.current = null;
        setDots([]);
        setTableEl(null);
        setHoveredDot(null);
      }
    };

    // Attach to .feishu-wysiwyg__editor (common parent of editor content AND dots)
    const listenTarget = (editorDom.closest('.feishu-wysiwyg__editor') as HTMLElement | null) ?? editorDom.parentElement ?? editorDom;
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
          role="button"
          tabIndex={-1}
          onMouseEnter={() => setHoveredDot(i)}
          onMouseLeave={() => setHoveredDot(null)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleDotClick(dot)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleDotClick(dot); }}
          title={dot.type === 'col' ? '插入列' : '插入行'}
          aria-label={dot.type === 'col' ? '插入列' : '插入行'}
        />
      ))}
    </>
  );
}
