import { useCallback, useState } from 'react';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import { TextSelection } from '@milkdown/prose/state';
import { toggleStrongCommand, toggleEmphasisCommand } from '@milkdown/preset-commonmark';
import {
  selectColCommand,
  selectRowCommand,
  toggleStrikethroughCommand,
} from '@milkdown/preset-gfm';
import type { Editor } from '@milkdown/core';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { HandleInfo, SelectionSnapshot, TableFormat } from './types';
import {
  BG_COLORS,
  createHeaderRowFromDataRow,
  findAncestorNode,
} from './table-utils';

interface ActionOptions {
  activeHandle: HandleInfo | null;
  tableEl: HTMLTableElement | null;
  getEditor: () => Editor | undefined;
  cancelScheduledHide: () => void;
  resetTableTools: () => void;
}

export function useTableHandleActions({
  activeHandle,
  tableEl,
  getEditor,
  cancelScheduledHide,
  resetTableTools,
}: ActionOptions) {
  const [bgColorIndex, setBgColorIndex] = useState(0);

  const getSelectionSnapshot = useCallback((): SelectionSnapshot | null => {
    const editor = getEditor();
    if (!editor) return null;

    let snapshot: SelectionSnapshot | null = null;
    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        snapshot = {
          anchor: view.state.selection.anchor,
          head: view.state.selection.head,
        };
      });
    } catch {
      return null;
    }

    return snapshot;
  }, [getEditor]);

  const restoreSelection = useCallback((snapshot: SelectionSnapshot | null) => {
    if (!snapshot) return;
    const editor = getEditor();
    if (!editor) return;

    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const maxPos = view.state.doc.content.size;
        const anchor = Math.min(snapshot.anchor, maxPos);
        const head = Math.min(snapshot.head, maxPos);
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, head)));
      });
    } catch {
      // The original cursor may no longer be valid after document changes.
    }
  }, [getEditor]);

  const blurEditor = useCallback(() => {
    const editor = getEditor();
    if (!editor) return;

    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dom.blur();
      });
      window.getSelection()?.removeAllRanges();
    } catch {
      // Ignore focus cleanup errors; formatting has already been applied.
    }
  }, [getEditor]);

  const focusCellAt = useCallback((row: number, col: number): boolean => {
    if (!tableEl) return false;
    const editor = getEditor();
    if (!editor) return false;

    const cell = tableEl.querySelector(
      `tr:nth-child(${row + 1}) > td:nth-child(${col + 1}), ` +
        `tr:nth-child(${row + 1}) > th:nth-child(${col + 1})`,
    );
    if (!cell) return false;

    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const pos = view.posAtDOM(cell, 0);
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
      });
      return true;
    } catch {
      return false;
    }
  }, [tableEl, getEditor]);

  const handleDelete = useCallback(() => {
    if (!activeHandle || !tableEl) return;
    const editor = getEditor();
    if (!editor) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state } = view;
      let tr = state.tr;

      if (activeHandle.type === 'row') {
        const rowEl = tableEl.querySelectorAll('tr')[activeHandle.index];
        const cell = rowEl?.querySelector('th, td');
        if (!cell) return;

        const pos = view.posAtDOM(cell, 0);
        const $pos = state.doc.resolve(pos);
        const tableNode = findAncestorNode($pos, 'table');
        if (!tableNode) return;

        if (activeHandle.index === 0 && tableNode.node.childCount > 1) {
          const firstDataRow = tableNode.node.child(1);
          const promotedHeaderRow = createHeaderRowFromDataRow(state.doc, firstDataRow);
          if (!promotedHeaderRow) return;

          const remainingRows: ProseNode[] = [];
          for (let i = 2; i < tableNode.node.childCount; i += 1) {
            remainingRows.push(tableNode.node.child(i));
          }
          if (remainingRows.length === 0) return;

          const newTable = tableNode.node.type.create(tableNode.node.attrs, [
            promotedHeaderRow,
            ...remainingRows,
          ]);
          tr = tr.replaceWith(tableNode.pos, tableNode.pos + tableNode.node.nodeSize, newTable);
        } else {
          const rowNode = findAncestorNode($pos, 'table_row');
          if (!rowNode) return;
          tr = tr.delete(rowNode.pos, rowNode.pos + rowNode.node.nodeSize);
        }
      } else {
        const cellNodes = Array.from(tableEl.querySelectorAll('tr'))
          .map((rowEl) => rowEl.cells[activeHandle.index])
          .filter((cell): cell is HTMLTableCellElement => Boolean(cell))
          .map((cell) => {
            const pos = view.posAtDOM(cell, 0);
            const $pos = state.doc.resolve(pos);
            return findAncestorNode($pos, 'table_cell') ?? findAncestorNode($pos, 'table_header');
          })
          .filter((cellNode): cellNode is NonNullable<typeof cellNode> => Boolean(cellNode))
          .sort((a, b) => b.pos - a.pos);

        cellNodes.forEach(({ node, pos }) => {
          tr = tr.delete(pos, pos + node.nodeSize);
        });
      }

      if (tr.docChanged) view.dispatch(tr);
    });

    resetTableTools();
    blurEditor();
  }, [activeHandle, tableEl, getEditor, resetTableTools, blurEditor]);

  const handleFormat = useCallback((format: TableFormat) => {
    if (!activeHandle || !tableEl) return;
    const editor = getEditor();
    if (!editor) return;
    cancelScheduledHide();

    const row = activeHandle.type === 'col' ? 0 : activeHandle.index;
    const col = activeHandle.type === 'row' ? 0 : activeHandle.index;
    const previousSelection = getSelectionSnapshot();
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
        setTimeout(() => {
          restoreSelection(previousSelection);
          blurEditor();
        }, 0);
      }, 10);
    }, 10);
  }, [
    activeHandle,
    tableEl,
    getEditor,
    focusCellAt,
    getSelectionSnapshot,
    restoreSelection,
    cancelScheduledHide,
    blurEditor,
  ]);

  const handleClearContent = useCallback(() => {
    if (!activeHandle || !tableEl) return;
    const editor = getEditor();
    if (!editor) return;
    cancelScheduledHide();

    try {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        let tr = state.tr;
        const rows = tableEl.querySelectorAll('tr');
        const targetCells: Element[] = activeHandle.type === 'row'
          ? Array.from(rows[activeHandle.index]?.querySelectorAll('td, th') ?? [])
          : Array.from(rows)
            .map((row) => row.cells[activeHandle.index])
            .filter((cell): cell is HTMLTableCellElement => Boolean(cell));
        const positions: { from: number; to: number }[] = [];

        targetCells.forEach((cell) => {
          const pos = view.posAtDOM(cell, 0);
          const cellNode = state.doc.resolve(pos).parent;
          if (cellNode.content.size > 0) {
            positions.push({ from: pos, to: pos + cellNode.content.size });
          }
        });

        positions.sort((a, b) => b.from - a.from);
        positions.forEach(({ from, to }) => {
          tr = tr.delete(from, to);
        });

        if (tr.docChanged) view.dispatch(tr);
      });
    } catch {
      // Silently ignore DOM resolution errors.
    }

    blurEditor();
  }, [activeHandle, tableEl, getEditor, cancelScheduledHide, blurEditor]);

  const handleBgColor = useCallback(() => {
    if (!activeHandle || !tableEl) return;
    cancelScheduledHide();

    const nextIndex = (bgColorIndex + 1) % BG_COLORS.length;
    const color = BG_COLORS[nextIndex] ?? '';
    setBgColorIndex(nextIndex);

    const rows = tableEl.querySelectorAll('tr');
    if (activeHandle.type === 'row') {
      const row = rows[activeHandle.index];
      row?.querySelectorAll('td, th').forEach((cell) => {
        (cell as HTMLElement).style.backgroundColor = color;
      });
    } else {
      rows.forEach((row) => {
        const cell = row.cells[activeHandle.index];
        if (cell) cell.style.backgroundColor = color;
      });
    }
    blurEditor();
  }, [activeHandle, tableEl, bgColorIndex, cancelScheduledHide, blurEditor]);

  return {
    bgColorIndex,
    handleDelete,
    handleFormat,
    handleClearContent,
    handleBgColor,
  };
}
