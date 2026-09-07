import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownReadView } from '@/viewer/components/Markdown/MarkdownReadView';

describe('MarkdownReadView incremental rendering', () => {
  it('reuses an unchanged block DOM node when a later paragraph changes', () => {
    const view = render(<MarkdownReadView content={'# Title\n\nFirst paragraph.\n\nSecond paragraph.'} />);
    const firstBlock = view.container.querySelector<HTMLElement>('[data-feishu-block-key]');
    if (!firstBlock) throw new Error('Expected a keyed Markdown block.');

    const unchangedParagraph = view.container.querySelector<HTMLElement>('[data-feishu-block-key] .feishu-paragraph');
    if (!unchangedParagraph) throw new Error('Expected an unchanged paragraph.');

    view.rerender(<MarkdownReadView content={'# Title\n\nFirst paragraph.\n\nChanged paragraph.'} />);

    expect(view.container.querySelector<HTMLElement>(`[data-feishu-block-key="${firstBlock.dataset.feishuBlockKey}"]`))
      .toBe(firstBlock);
    expect(view.container.querySelector<HTMLElement>('.feishu-paragraph'))
      .toBe(unchangedParagraph);
  });

  it('keeps the existing root class and dispatches table width updates after rendering', () => {
    const widthEvent = vi.fn();
    window.addEventListener('feishu-table-widths-updated', widthEvent);

    try {
      const view = render(<MarkdownReadView content={'## Data\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'} />);

      expect(view.container.querySelector('.feishu-markdown-body')).not.toBeNull();
      expect(widthEvent).toHaveBeenCalled();
      view.unmount();
    } finally {
      window.removeEventListener('feishu-table-widths-updated', widthEvent);
    }
  });
});
