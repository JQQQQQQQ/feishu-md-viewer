import type { Node as ProseNode, ResolvedPos } from '@milkdown/prose/model';
import type { HandleInfo, NodePosition } from './types';

export const BG_COLORS = ['', '#fffde7', '#e3f2fd', '#e8f5e9', '#fce4ec', '#f3e5f5'];
export const TOOLBAR_HEIGHT = 34;
export const TOOLBAR_WIDTH = 220;
export const TOOLBAR_GAP = 4;
export const HOVER_BRIDGE_PADDING = 16;

export function findAncestorNode($pos: ResolvedPos, nodeName: string): NodePosition | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name === nodeName) {
      return { node, pos: $pos.before(depth) };
    }
  }
  return null;
}

export function createHeaderRowFromDataRow(
  stateDoc: ProseNode,
  dataRow: ProseNode,
): ProseNode | null {
  const headerRowType = stateDoc.type.schema.nodes.table_header_row;
  const headerCellType = stateDoc.type.schema.nodes.table_header;
  if (!headerRowType || !headerCellType) return null;

  const headerCells: ProseNode[] = [];
  dataRow.forEach((cell) => {
    headerCells.push(headerCellType.create(cell.attrs, cell.content, cell.marks));
  });

  return headerRowType.create(null, headerCells);
}

export function computeTableHandles(
  table: HTMLTableElement,
  listenTarget: HTMLElement,
): HandleInfo[] {
  const editorRect = listenTarget.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const result: HandleInfo[] = [];

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
}

export function getActiveHandleZone(
  activeHandle: HandleInfo,
  editorRect: DOMRect,
): { left: number; right: number; top: number; bottom: number } {
  const handleRect = {
    left: editorRect.left + activeHandle.x,
    top: editorRect.top + activeHandle.y,
    right: editorRect.left + activeHandle.x + activeHandle.width,
    bottom: editorRect.top + activeHandle.y + activeHandle.height,
  };
  const toolbarRect = {
    left: activeHandle.type === 'col'
      ? handleRect.left
      : editorRect.left + activeHandle.x - TOOLBAR_WIDTH,
    top: activeHandle.type === 'col'
      ? editorRect.top + activeHandle.y - TOOLBAR_HEIGHT - TOOLBAR_GAP
      : handleRect.top,
    right: activeHandle.type === 'col'
      ? handleRect.left + TOOLBAR_WIDTH
      : editorRect.left + activeHandle.x,
    bottom: activeHandle.type === 'col'
      ? editorRect.top + activeHandle.y
      : handleRect.top + TOOLBAR_HEIGHT,
  };

  return {
    left: Math.min(handleRect.left, toolbarRect.left) - HOVER_BRIDGE_PADDING,
    right: Math.max(handleRect.right, toolbarRect.right) + HOVER_BRIDGE_PADDING,
    top: Math.min(handleRect.top, toolbarRect.top) - HOVER_BRIDGE_PADDING,
    bottom: Math.max(handleRect.bottom, toolbarRect.bottom) + HOVER_BRIDGE_PADDING,
  };
}

