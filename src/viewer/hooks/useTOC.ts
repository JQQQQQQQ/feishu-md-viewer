import { useMemo } from 'react';
import { createHeadingId } from '../utils/heading-slug';

export interface TOCItem {
  id: string;
  text: string;
  level: number;
  children: TOCItem[];
}

export function useTOC(markdown: string): TOCItem[] {
  return useMemo(() => extractHeadings(markdown), [markdown]);
}

export function extractHeadings(markdown: string): TOCItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const flat: { id: string; text: string; level: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1]?.length ?? 1;
    const text = (match[2] ?? '').trim();
    const id = createHeadingId(text);
    flat.push({ id, text, level });
  }

  return buildTree(flat);
}

function buildTree(flat: { id: string; text: string; level: number }[]): TOCItem[] {
  const root: TOCItem[] = [];
  const stack: { item: TOCItem; level: number }[] = [];

  for (const heading of flat) {
    const item: TOCItem = { ...heading, children: [] };

    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= heading.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1]?.item.children.push(item);
    }

    stack.push({ item, level: heading.level });
  }

  return root;
}
