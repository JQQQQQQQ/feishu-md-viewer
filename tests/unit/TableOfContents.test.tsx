import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { RefObject } from 'react';
import { TableOfContents } from '@/viewer/components/TOC/TableOfContents';
import type { TOCItem } from '@/viewer/hooks/useTOC';
import { createHeadingId } from '@/viewer/utils/heading-slug';
import { useViewerStore } from '@/viewer/store';
import {
  MARKDOWN_HEADING_READY_EVENT,
  MARKDOWN_HEADINGS_CHANGED_EVENT,
  MARKDOWN_TOC_NAVIGATE_EVENT,
} from '@/lib/markdown-progressive-render';

function createContainerWithHeading(text: string, id = ''): HTMLElement {
  const container = document.createElement('main');
  container.innerHTML = `
    <h2 id="${id}">
      <button class="feishu-heading__toggle" aria-label="fold">fold</button>
      <span class="feishu-heading__text">${text}</span>
      <button class="feishu-heading__anchor" aria-label="copy">copy</button>
    </h2>
  `;
  document.body.appendChild(container);
  return container;
}

describe('TableOfContents', () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    useViewerStore.setState({ tocSmoothScrollEnabled: true, tocOverflowMode: 'ellipsis' });
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
      })),
    );

    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('navigates to heading when toc item is clicked', async () => {
    const headingText = 'Section 9: Invalid Mermaid';
    const headingId = createHeadingId(headingText);
    const container = createContainerWithHeading(headingText);
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const items: TOCItem[] = [{ id: headingId, text: headingText, level: 2, children: [] }];

    render(<TableOfContents items={items} containerRef={containerRef} />);

    await waitFor(() => {
      expect(container.querySelector('h2')?.id).toBe(headingId);
    });

    fireEvent.click(screen.getByRole('link', { name: headingText }));

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('keeps existing heading id instead of rebuilding from toggle text', async () => {
    const headingText = 'Section 1: Basic Typography';
    const presetId = createHeadingId(headingText);
    const container = createContainerWithHeading(headingText, presetId);
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const items: TOCItem[] = [{ id: presetId, text: headingText, level: 2, children: [] }];

    render(<TableOfContents items={items} containerRef={containerRef} />);

    await waitFor(() => {
      expect(container.querySelector('h2')?.id).toBe(presetId);
    });
  });

  it('falls back to heading text when toc id does not match runtime heading id', async () => {
    const headingText = 'Section 9: Invalid Mermaid';
    const tocId = createHeadingId(headingText);
    const runtimeId = `${tocId}:legacy`;
    const container = createContainerWithHeading(headingText, runtimeId);
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const items: TOCItem[] = [{ id: tocId, text: headingText, level: 2, children: [] }];

    render(<TableOfContents items={items} containerRef={containerRef} />);
    fireEvent.click(screen.getByRole('link', { name: headingText }));

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });

  it('uses instant jump when smooth scroll is disabled in settings', async () => {
    useViewerStore.setState({ tocSmoothScrollEnabled: false });
    const headingText = 'Section 10: TOC Jump';
    const headingId = createHeadingId(headingText);
    const container = createContainerWithHeading(headingText);
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const items: TOCItem[] = [{ id: headingId, text: headingText, level: 2, children: [] }];

    render(<TableOfContents items={items} containerRef={containerRef} />);
    fireEvent.click(screen.getByRole('link', { name: headingText }));

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('将目录标题超出设置映射为目录容器样式，并保留完整标题提示', () => {
    useViewerStore.setState({ tocOverflowMode: 'wrap' });
    const headingText = '这是一个用于验证目录超长标题换行展示不会丢失完整文本的标题';
    const container = createContainerWithHeading(headingText);
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const items: TOCItem[] = [
      { id: createHeadingId(headingText), text: headingText, level: 2, children: [] },
    ];

    render(<TableOfContents items={items} containerRef={containerRef} />);

    const navigation = screen.getByRole('navigation', { name: 'Table of contents' });
    expect(navigation).toHaveClass('feishu-toc--overflow-wrap');
    expect(navigation.querySelector('.feishu-toc__text')).toHaveAttribute('title', headingText);
  });

  it('点击目录后短暂高亮目标标题，并在约 2 秒后移除', () => {
    vi.useFakeTimers();
    const headingText = 'Section 11: Jump target';
    const headingId = createHeadingId(headingText);
    const container = createContainerWithHeading(headingText);
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const items: TOCItem[] = [{ id: headingId, text: headingText, level: 2, children: [] }];

    render(<TableOfContents items={items} containerRef={containerRef} />);
    fireEvent.click(screen.getByRole('link', { name: headingText }));

    const heading = container.querySelector('h2');
    expect(heading).toHaveClass('feishu-heading--toc-target');

    vi.advanceTimersByTime(1999);
    expect(heading).toHaveClass('feishu-heading--toc-target');

    vi.advanceTimersByTime(1);
    expect(heading).not.toHaveClass('feishu-heading--toc-target');
    vi.useRealTimers();
  });

  it('连续点击目录时只保留最后一次跳转的标题高亮', () => {
    vi.useFakeTimers();
    const firstText = 'Section 12: First target';
    const secondText = 'Section 13: Second target';
    const firstId = createHeadingId(firstText);
    const secondId = createHeadingId(secondText);
    const container = document.createElement('main');
    container.innerHTML = `<h2><span class="feishu-heading__text">${firstText}</span></h2><h2><span class="feishu-heading__text">${secondText}</span></h2>`;
    document.body.appendChild(container);
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const items: TOCItem[] = [
      { id: firstId, text: firstText, level: 2, children: [] },
      { id: secondId, text: secondText, level: 2, children: [] },
    ];

    render(<TableOfContents items={items} containerRef={containerRef} />);
    fireEvent.click(screen.getByRole('link', { name: firstText }));
    fireEvent.click(screen.getByRole('link', { name: secondText }));

    const headings = Array.from(container.querySelectorAll('h2'));
    expect(headings[0]).not.toHaveClass('feishu-heading--toc-target');
    expect(headings[1]).toHaveClass('feishu-heading--toc-target');
    vi.advanceTimersByTime(2000);
    expect(headings[1]).not.toHaveClass('feishu-heading--toc-target');
    vi.useRealTimers();
  });

  it('large document mode does not eagerly render every nested directory item', () => {
    const container = document.createElement('main');
    containerRefHack.current = container;
    const items: TOCItem[] = [
      {
        id: 'document',
        text: 'Document',
        level: 1,
        children: Array.from({ length: 400 }, (_, index) => ({
          id: `section-${index}`,
          text: `Section ${index}`,
          level: 2,
          children: [],
        })),
      },
    ];

    const view = render(
      <TableOfContents items={items} containerRef={containerRefHack} largeDocumentMode />,
    );

    expect(view.container.querySelectorAll('[role="treeitem"]').length).toBe(1);
  });

  it('requests a missing heading batch and retries navigation when it becomes available', async () => {
    const container = document.createElement('main');
    document.body.appendChild(container);
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const headingText = 'Section 10000';
    const headingId = createHeadingId(headingText);
    const items: TOCItem[] = [{ id: headingId, text: headingText, level: 2, children: [] }];
    const requestListener = vi.fn();
    window.addEventListener(MARKDOWN_TOC_NAVIGATE_EVENT, requestListener);

    try {
      render(<TableOfContents items={items} containerRef={containerRef} largeDocumentMode />);
      fireEvent.click(screen.getByRole('link', { name: headingText }));
      expect(requestListener.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          detail: expect.objectContaining({ id: headingId, text: headingText }),
        }),
      );

      container.innerHTML = `<h2 id="${headingId}"><span class="feishu-heading__text">${headingText}</span></h2>`;
      window.dispatchEvent(
        new CustomEvent(MARKDOWN_HEADING_READY_EVENT, { detail: { id: headingId } }),
      );
      await waitFor(() =>
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }),
      );
    } finally {
      window.removeEventListener(MARKDOWN_TOC_NAVIGATE_EVENT, requestListener);
    }
  });

  it('large document mode observes headings that are mounted by a later batch', () => {
    const observed = new Set<Element>();
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(() => ({
        observe: (element: Element) => observed.add(element),
        disconnect: vi.fn(),
        unobserve: (element: Element) => observed.delete(element),
      })),
    );
    const container = createContainerWithHeading('Section 0', 'section-0');
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const items: TOCItem[] = [
      { id: 'section-0', text: 'Section 0', level: 2, children: [] },
      { id: 'section-241', text: 'Section 241', level: 2, children: [] },
    ];

    render(<TableOfContents items={items} containerRef={containerRef} largeDocumentMode />);
    const lateHeading = document.createElement('h2');
    lateHeading.id = 'section-241';
    lateHeading.innerHTML = '<span class="feishu-heading__text">Section 241</span>';
    container.appendChild(lateHeading);
    window.dispatchEvent(new Event(MARKDOWN_HEADINGS_CHANGED_EVENT));

    expect(observed).toContain(lateHeading);
  });
});

const containerRefHack = { current: null } as RefObject<HTMLElement | null>;
