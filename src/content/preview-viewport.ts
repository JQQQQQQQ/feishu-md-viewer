export interface PreviewViewportSnapshot {
  windowScrollX: number;
  windowScrollY: number;
  tableScrollLefts: Record<string, number>;
}

function getTableKey(scrollport: HTMLElement, index: number): string {
  const table = scrollport.querySelector<HTMLTableElement>('table[data-feishu-table-id]');
  return table?.dataset.feishuTableId ?? `table-index-${index}`;
}

export function capturePreviewViewport(root: ParentNode): PreviewViewportSnapshot {
  const tableScrollLefts: Record<string, number> = {};
  root.querySelectorAll<HTMLElement>('.feishu-table__scrollport').forEach((scrollport, index) => {
    tableScrollLefts[getTableKey(scrollport, index)] = scrollport.scrollLeft;
  });

  return {
    windowScrollX: typeof window.scrollX === 'number' ? window.scrollX : 0,
    windowScrollY: typeof window.scrollY === 'number' ? window.scrollY : 0,
    tableScrollLefts,
  };
}

export function restorePreviewViewport(root: ParentNode, snapshot: PreviewViewportSnapshot): void {
  try {
    window.scrollTo(snapshot.windowScrollX, snapshot.windowScrollY);
  } catch {
    // jsdom and restricted embedded contexts may not implement scrollTo.
  }

  root.querySelectorAll<HTMLElement>('.feishu-table__scrollport').forEach((scrollport, index) => {
    const savedScrollLeft = snapshot.tableScrollLefts[getTableKey(scrollport, index)];
    if (typeof savedScrollLeft === 'number' && Number.isFinite(savedScrollLeft)) {
      scrollport.scrollLeft = savedScrollLeft;
    }
  });
}
