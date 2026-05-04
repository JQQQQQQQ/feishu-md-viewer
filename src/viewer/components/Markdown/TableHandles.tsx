import { useEffect, useState, useCallback, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import { TextSelection } from '@milkdown/prose/state';
import { toggleStrongCommand, toggleEmphasisCommand } from '@milkdown/preset-commonmark';
import {
  toggleStrikethroughCommand,
  selectColCommand,
  selectRowCommand,
  deleteSelectedCellsCommand,
} from '@milkdown/preset-gfm';

interface HandleInfo {
  type: 'col' | 'row';
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Feishu-style table column/row selection handles.
 * Shows thin strips above columns and to the left of rows when hovering a table.
 * Hovering a handle highlights it and shows a formatting toolbar (Bold/Italic/Strikethrough/Delete).
 */
export function TableHandles() {
  const [loading, getEditor] = useInstance();
  const [handles, setHandles] = useState<HandleInfo[]>([]);
  const [activeHandle, setActiveHandle] = useState<HandleInfo | null>(null);
  const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);
  const tableElRef = useRef<HTMLTableElement | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect table hover and compute handle positions
  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;

    let editorDom: HTMLElement | null = null;
    try {
      editor.action((ctx) => {
        editorDom = ctx.get(editorViewCtx).dom;
      });
    } catch {
      return;
    }
    if (!editorDom) return;

    const listenTarget =
      ((editorDom as HTMLElement).closest('.feishu-wysiwyg__editor') as HTMLElement) ??
      editorDom;

    const computeHandles = (table: HTMLTableElement): HandleInfo[] => {
      const editorRect = listenTarget.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const result: HandleInfo[] = [];

      // Column handles (above each column header cell)
      const firstRow = table.querySelector('tr') as HTMLTableRowElement | null;
      if (firstRow) {
        Array.from(firstRow.cells).forEach((cell, i) => {
          const cellRect = cell.getBoundingClientRect();
          result.push({
            type: 'col',
            index: i,
            x: cellRect.left - editorRect.left,
            y: tableRect.top - editorRect.top - 8,
            width: cellRect.width,
            height: 6,
          });
        });
      }

      // Row handles (left of each row)
      Array.from(table.querySelectorAll('tr')).forEach((row, i) => {
        const rowRect = row.getBoundingClientRect();
        result.push({
          type: 'row',
          index: i,
          x: tableRect.left - editorRect.left - 8,
          y: rowRect.top - editorRect.top,
          width: 6,
          height: rowRect.height,
        });
      });

      return result;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignore if mouse is on handle or toolbar elements
      if (
        target.closest('.feishu-table-handle') ||
        target.closest('.feishu-table-handle-toolbar')
      ) {
        return;
      }

      const table = target.closest('table');

      if (table && table instanceof HTMLTableElement) {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        tableElRef.current = table;
        setTableEl(table);
        setHandles(computeHandles(table));
        return;
      }

      // Check expanded zone around current table
      const currentTable = tableElRef.current;
      if (currentTable) {
        const rect = currentTable.getBoundingClientRect();
        if (
          e.clientX >= rect.left - 40 &&
          e.clientX <= rect.right + 10 &&
          e.clientY >= rect.top - 30 &&
          e.clientY <= rect.bottom + 10
        ) {
          return;
        }
      }

      // Outside — schedule hide with delay
      if (handles.length > 0 && !hideTimeoutRef.current) {
        hideTimeoutRef.current = setTimeout(() => {
          setHandles([]);
          setTableEl(null);
          setActiveHandle(null);
          tableElRef.current = null;
          hideTimeoutRef.current = null;
        }, 300);
      }
    };

    const handleMouseLeave = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setHandles([]);
        setTableEl(null);
        setActiveHandle(null);
        tableElRef.current = null;
        hideTimeoutRef.current = null;
      }, 300);
    };

    listenTarget.addEventListener('mousemove', handleMouseMove);
    listenTarget.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      listenTarget.removeEventListener('mousemove', handleMouseMove);
      listenTarget.removeEventListener('mouseleave', handleMouseLeave);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [loading, getEditor, handles.length]);

  // Select a cell in the target column/row, then run the given command sequence
  const focusCellAt = useCallback(
    (row: number, col: number): boolean => {
      if (!tableEl) return false;
      const editor = getEditor();
      if (!editor) return false;

      const cell = tableEl.querySelector(
        `tr:nth-child(${row + 1}) > td:nth-child(${col + 1}), ` +
          `tr:nth-child(${row + 1}) > th:nth-child(${col + 1})`
      );
      if (!cell) return false;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const pos = view.posAtDOM(cell, 0);
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
          view.focus();
        });
        return true;
      } catch {
        return false;
      }
    },
    [tableEl, getEditor]
  );

  // Delete column or row
  const handleDelete = useCallback(() => {
    if (!activeHandle || !tableEl) return;
    const editor = getEditor();
    if (!editor) return;

    const row = activeHandle.type === 'col' ? 0 : activeHandle.index;
    const col = activeHandle.type === 'row' ? 0 : activeHandle.index;

    if (!focusCellAt(row, col)) return;

    setTimeout(() => {
      const cmd = activeHandle.type === 'col' ? selectColCommand : selectRowCommand;
      editor.action(callCommand(cmd.key, { index: activeHandle.index }));
      setTimeout(() => {
        editor.action(callCommand(deleteSelectedCellsCommand.key));
      }, 10);
    }, 10);

    setActiveHandle(null);
  }, [activeHandle, tableEl, getEditor, focusCellAt]);

  // Apply formatting to entire column or row
  const handleFormat = useCallback(
    (format: 'bold' | 'italic' | 'strikethrough') => {
      if (!activeHandle || !tableEl) return;
      const editor = getEditor();
      if (!editor) return;

      const row = activeHandle.type === 'col' ? 0 : activeHandle.index;
      const col = activeHandle.type === 'row' ? 0 : activeHandle.index;

      if (!focusCellAt(row, col)) return;

      setTimeout(() => {
        const selectCmd = activeHandle.type === 'col' ? selectColCommand : selectRowCommand;
        editor.action(callCommand(selectCmd.key, { index: activeHandle.index }));

        setTimeout(() => {
          const formatKey =
            format === 'bold'
              ? toggleStrongCommand.key
              : format === 'italic'
                ? toggleEmphasisCommand.key
                : toggleStrikethroughCommand.key;
          editor.action(callCommand(formatKey));
        }, 10);
      }, 10);

      setActiveHandle(null);
    },
    [activeHandle, tableEl, getEditor, focusCellAt]
  );

  if (handles.length === 0) return null;

  return (
    <>
      {/* Column/row handle strips */}
      {handles.map((h) => (
        <div
          key={`${h.type}-${h.index}`}
          className={`feishu-table-handle feishu-table-handle--${h.type}${activeHandle?.type === h.type && activeHandle?.index === h.index ? ' feishu-table-handle--active' : ''}`}
          style={{ left: h.x, top: h.y, width: h.width, height: h.height }}
          role="button"
          tabIndex={-1}
          onMouseEnter={() => setActiveHandle(h)}
          onMouseLeave={(e) => {
            const related = e.relatedTarget as HTMLElement | null;
            if (!related?.closest('.feishu-table-handle-toolbar')) {
              setActiveHandle(null);
            }
          }}
          onMouseDown={(e) => e.preventDefault()}
        />
      ))}

      {/* Formatting toolbar when a handle is active */}
      {activeHandle && (
        <div
          className="feishu-table-handle-toolbar"
          style={{
            left:
              activeHandle.type === 'col'
                ? activeHandle.x
                : activeHandle.x - 110,
            top:
              activeHandle.type === 'col'
                ? activeHandle.y - 34
                : activeHandle.y,
          }}
          onMouseLeave={() => setActiveHandle(null)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onClick={() => handleFormat('bold')} title="加粗">
            <strong>B</strong>
          </button>
          <button onClick={() => handleFormat('italic')} title="斜体">
            <em>I</em>
          </button>
          <button onClick={() => handleFormat('strikethrough')} title="删除线">
            <s>S</s>
          </button>
          <div className="feishu-table-handle-toolbar__divider" />
          <button
            onClick={handleDelete}
            title={activeHandle.type === 'col' ? '删除列' : '删除行'}
            className="feishu-table-handle-toolbar__delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
