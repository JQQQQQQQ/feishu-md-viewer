import { act, render, waitFor, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownReadView } from '@/viewer/components/Markdown/MarkdownReadView';
import { TableOfContents } from '@/viewer/components/TOC/TableOfContents';
import { extractHeadings } from '@/viewer/hooks/useTOC';

function createLargeMarkdown(suffix = ''): string {
  return Array.from({ length: 650 }, (_, index) => (
    `## Section ${index}\n\nLarge document paragraph ${index} ${suffix}`
  )).join('\n\n');
}

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

  it('renders the first batch before progressively completing a large document', async () => {
    const view = render(<MarkdownReadView content={createLargeMarkdown()} />);

    expect(view.container.querySelectorAll('[data-feishu-block-key]').length).toBeGreaterThan(0);
    expect(view.container.querySelector('[data-feishu-progressive-placeholder]')).not.toBeNull();

    await waitFor(() => {
      expect(view.container.querySelector('[data-feishu-progressive-placeholder]')).toBeNull();
    }, { timeout: 15_000 });
    expect(view.container.textContent).toContain('Section 649');
  });

  it('does not let an old progressive document overwrite newer content', async () => {
    const view = render(<MarkdownReadView content={createLargeMarkdown('old-only-marker')} />);
    view.rerender(<MarkdownReadView content={createLargeMarkdown('new-only-marker')} />);

    await waitFor(() => {
      expect(view.container.textContent).toContain('new-only-marker');
      expect(view.container.textContent).not.toContain('old-only-marker');
    }, { timeout: 5_000 });
  });

  it('keeps the current deep window mounted after a non-heading refresh', async () => {
    class StaticIntersectionObserver {
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', StaticIntersectionObserver);
    const originalContent = createLargeMarkdown();
    const refreshedContent = originalContent.replace(
      'Large document paragraph 649',
      'Large document paragraph 649 refreshed',
    );

    try {
      const view = render(<MarkdownReadView content={originalContent} />);
      await waitFor(() => {
        act(() => {
          window.dispatchEvent(new CustomEvent('feishu-toc-navigate', {
            detail: { id: 'section-649' },
          }));
        });
        expect(view.container.textContent).toContain('Section 649');
      }, { timeout: 15_000 });

      view.rerender(<MarkdownReadView content={refreshedContent} />);

      await waitFor(() => {
        expect(view.container.textContent).toContain('Section 649');
        expect(view.container.textContent).toContain('refreshed');
      }, { timeout: 15_000 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses a batch-specific intrinsic height hint for offscreen content', () => {
    const view = render(<MarkdownReadView content={createLargeMarkdown()} />);
    const batch = view.container.querySelector<HTMLElement>('.feishu-markdown-batch');

    expect(batch?.style.containIntrinsicSize).not.toBe('');
    expect(batch?.style.containIntrinsicSize).not.toContain('480px');
  });

  it('does not broadcast table width restoration for a batch without tables', () => {
    const widthEvent = vi.fn();
    window.addEventListener('feishu-table-widths-updated', widthEvent);

    try {
      render(<MarkdownReadView content={createLargeMarkdown()} />);
      expect(widthEvent).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('feishu-table-widths-updated', widthEvent);
    }
  });

  it('retries an initial anchor after the target batch is committed', async () => {
    const previousHash = window.location.hash;
    const scrollIntoView = vi.fn();
    window.location.hash = '#section-649';
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      render(<MarkdownReadView content={createLargeMarkdown()} />);
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' }), {
        timeout: 5_000,
      });
    } finally {
      window.location.hash = previousHash;
    }
  });

  it('loads a not-yet-rendered heading requested by the table of contents', async () => {
    class StaticIntersectionObserver {
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', StaticIntersectionObserver);

    try {
      const view = render(<MarkdownReadView content={createLargeMarkdown()} />);
      expect(view.container.textContent).not.toContain('Section 649');

      act(() => {
        window.dispatchEvent(new CustomEvent('feishu-toc-navigate', {
          detail: { id: 'section-649' },
        }));
      });

      await waitFor(() => expect(view.container.textContent).toContain('Section 649'), {
        timeout: 5_000,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('jumps from a real large-document toc to a heading beyond the first batch', async () => {
    class StaticIntersectionObserver {
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', StaticIntersectionObserver);
    const content = Array.from({ length: 650 }, (_, index) => (
      `# Section ${index}\n\nParagraph ${index}`
    )).join('\n\n');
    const tocItems = extractHeadings(content);
    const shellRef = { current: null as HTMLElement | null };
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      const view = render(
        <main ref={shellRef}>
          <TableOfContents items={tocItems} containerRef={shellRef} largeDocumentMode />
          <MarkdownReadView content={content} />
        </main>,
      );
      expect(view.container.querySelector('#section-649')).toBeNull();
      fireEvent.click(screen.getByRole('link', { name: 'Section 649' }));

      await waitFor(() => expect(view.container.querySelector('#section-649')).not.toBeNull(), {
        timeout: 5_000,
      });
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
