import type { Node as ProseNode } from '@milkdown/prose/model';

export interface HandleInfo {
  type: 'col' | 'row';
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionSnapshot {
  anchor: number;
  head: number;
}

export interface NodePosition {
  node: ProseNode;
  pos: number;
}

export type TableFormat = 'bold' | 'italic' | 'strikethrough';

