export type TablePointerIntent = 'text' | 'cell-range' | 'column-resize' | 'interactive';

function isInteractiveElement(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('a,button,input,textarea,select,[contenteditable="true"]'));
}

function getCaretNode(event: MouseEvent): Node | null {
  const documentWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
  };
  const range = documentWithCaret.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (range) return range.commonAncestorContainer;
  return documentWithCaret.caretPositionFromPoint?.(event.clientX, event.clientY)?.offsetNode ?? null;
}

function isPointInsideCellText(cell: HTMLTableCellElement, event: MouseEvent): boolean {
  const ownerDocument = cell.ownerDocument;
  const walker = ownerDocument.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode.textContent?.trim()) {
      const range = ownerDocument.createRange();
      range.selectNodeContents(currentNode);
      if (typeof range.getClientRects !== 'function') {
        currentNode = walker.nextNode();
        continue;
      }
      for (const rect of Array.from(range.getClientRects())) {
        if (
          event.clientX >= rect.left
          && event.clientX <= rect.right
          && event.clientY >= rect.top
          && event.clientY <= rect.bottom
        ) return true;
      }
    }
    currentNode = walker.nextNode();
  }

  return false;
}

export function resolveTablePointerIntent(
  event: MouseEvent,
  wrapper: HTMLElement,
  cell: HTMLTableCellElement,
  target: EventTarget | null = event.target,
): TablePointerIntent {
  if (isInteractiveElement(target)) return 'interactive';

  const caretNode = getCaretNode(event);
  if (
    caretNode
    && wrapper.contains(caretNode)
    && cell.contains(caretNode)
    && (
      caretNode.nodeType === Node.TEXT_NODE
      || cell.textContent?.trim()
    )
  ) return 'text';

  if (isPointInsideCellText(cell, event)) return 'text';

  return 'cell-range';
}
