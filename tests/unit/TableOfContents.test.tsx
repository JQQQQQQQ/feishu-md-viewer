import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { RefObject } from 'react';
import { TableOfContents } from '@/viewer/components/TOC/TableOfContents';
import type { TOCItem } from '@/viewer/hooks/useTOC';
import { createHeadingId } from '@/viewer/utils/heading-slug';
import { useViewerStore } from '@/viewer/store';

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
    useViewerStore.setState({ tocSmoothScrollEnabled: true });
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
});
