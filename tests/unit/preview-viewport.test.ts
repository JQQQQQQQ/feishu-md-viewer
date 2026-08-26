import { describe, expect, it, vi } from 'vitest';

import { capturePreviewViewport, restorePreviewViewport } from '@/content/preview-viewport';

describe('preview viewport snapshot', () => {
  it('保存并恢复正文滚动位置和表格横向滚动位置', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="feishu-table__scrollport">
        <table data-feishu-table-id="table-a"><tbody><tr><td>A</td></tr></tbody></table>
      </div>
      <div class="feishu-table__scrollport">
        <table data-feishu-table-id="table-b"><tbody><tr><td>B</td></tr></tbody></table>
      </div>
    `;
    const scrollports = Array.from(root.querySelectorAll<HTMLElement>('.feishu-table__scrollport'));
    scrollports[0]!.scrollLeft = 120;
    scrollports[1]!.scrollLeft = 40;
    vi.spyOn(window, 'scrollX', 'get').mockReturnValue(12);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(860);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    const snapshot = capturePreviewViewport(root);
    scrollports[0]!.scrollLeft = 0;
    scrollports[1]!.scrollLeft = 0;
    restorePreviewViewport(root, snapshot);

    expect(scrollTo).toHaveBeenCalledWith(12, 860);
    expect(scrollports[0]!.scrollLeft).toBe(120);
    expect(scrollports[1]!.scrollLeft).toBe(40);
  });
});
