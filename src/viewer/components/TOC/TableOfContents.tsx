import { useCallback, useEffect, useState, useRef } from 'react';
import type { TOCItem as TOCItemType } from '../../hooks/useTOC';
import { TOCItem } from './TOCItem';
import { createUniqueHeadingIdFactory } from '../../utils/heading-slug';
import { useViewerStore } from '../../store';
import {
  MARKDOWN_HEADING_READY_EVENT,
  MARKDOWN_HEADINGS_CHANGED_EVENT,
  MARKDOWN_TOC_NAVIGATE_EVENT,
} from '../../../lib/markdown-progressive-render';

interface TableOfContentsProps {
  items: TOCItemType[];
  containerRef: React.RefObject<HTMLElement | null>;
  largeDocumentMode?: boolean;
}

export function countTOCItems(items: TOCItemType[]): number {
  return items.reduce((count, item) => count + 1 + countTOCItems(item.children), 0);
}

function findTocTextById(items: TOCItemType[], id: string): string | null {
  const stack = [...items].reverse();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (current.id === id) {
      return current.text;
    }
    if (current.children.length > 0) {
      stack.push(...[...current.children].reverse());
    }
  }
  return null;
}

function extractHeadingText(heading: HTMLElement): string {
  const directTextSlot = Array.from(heading.children).find(
    (child) => child instanceof HTMLElement && child.classList.contains('feishu-heading__text'),
  );

  if (directTextSlot instanceof HTMLElement && directTextSlot.textContent) {
    return directTextSlot.textContent.trim();
  }

  const clone = heading.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('.feishu-heading__toggle,.feishu-heading__anchor')
    .forEach((node) => node.remove());
  return clone.textContent?.trim() ?? '';
}

function escapeCssIdentifier(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

const TOC_TARGET_HIGHLIGHT_CLASS = 'feishu-heading--toc-target';
const TOC_TARGET_HIGHLIGHT_DURATION_MS = 2000;

export function TableOfContents({
  items,
  containerRef,
  largeDocumentMode = false,
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const highlightedHeadingRef = useRef<HTMLElement | null>(null);
  const highlightTimerRef = useRef<number | undefined>(undefined);
  const pendingNavigationIdRef = useRef<string | null>(null);
  const tocSmoothScrollEnabled = useViewerStore((s) => s.tocSmoothScrollEnabled);
  const tocOverflowMode = useViewerStore((s) => s.tocOverflowMode);

  const clearHeadingHighlight = useCallback(() => {
    if (highlightTimerRef.current !== undefined) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = undefined;
    }
    highlightedHeadingRef.current?.classList.remove(TOC_TARGET_HIGHLIGHT_CLASS);
    highlightedHeadingRef.current = null;
  }, []);

  const highlightHeading = useCallback(
    (heading: HTMLElement) => {
      clearHeadingHighlight();
      // Force a reflow so a second click on the same heading restarts the animation.
      void heading.offsetWidth;
      heading.classList.add(TOC_TARGET_HIGHLIGHT_CLASS);
      highlightedHeadingRef.current = heading;
      highlightTimerRef.current = window.setTimeout(() => {
        clearHeadingHighlight();
      }, TOC_TARGET_HIGHLIGHT_DURATION_MS);
    },
    [clearHeadingHighlight],
  );

  useEffect(() => clearHeadingHighlight, [clearHeadingHighlight]);

  const ensureHeadingAnchors = useCallback((container: HTMLElement): HTMLElement[] => {
    const getUniqueId = createUniqueHeadingIdFactory();
    const usedIds = new Set<string>();
    const headings = Array.from(container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));

    headings.forEach((heading) => {
      const text = extractHeadingText(heading);
      const fallbackId = getUniqueId(text);
      const level = Number(heading.tagName.slice(1));
      const currentId = heading.id.trim();

      let id = currentId || fallbackId;
      if (!id || usedIds.has(id)) {
        id = fallbackId;
      }
      usedIds.add(id);

      heading.id = id;
      heading.classList.add('feishu-heading');

      for (let idx = 1; idx <= 6; idx += 1) {
        heading.classList.remove(`feishu-h${idx}`);
      }

      if (Number.isInteger(level) && level >= 1 && level <= 6) {
        heading.classList.add(`feishu-h${level}`);
      }
    });

    return headings;
  }, []);

  useEffect(() => {
    const callback: IntersectionObserverCallback = (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length > 0) {
        const sorted = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = sorted[0]?.target.id;
        if (topId) setActiveId(topId);
      }
    };

    const observeMountedHeadings = () => {
      const container = containerRef.current;
      if (!container) return;

      const headings = ensureHeadingAnchors(container);
      observerRef.current?.disconnect();
      if (headings.length === 0) return;

      observerRef.current = new IntersectionObserver(callback, {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      });
      // 大文档正文已经按批次挂载，观察当前已挂载的窗口即可；不要把
      // “前 240 项”当成永久观察集合，否则深层标题永远不会成为 active。
      headings.forEach((heading) => observerRef.current?.observe(heading));
    };

    observeMountedHeadings();
    window.addEventListener(MARKDOWN_HEADINGS_CHANGED_EVENT, observeMountedHeadings);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener(MARKDOWN_HEADINGS_CHANGED_EVENT, observeMountedHeadings);
    };
  }, [containerRef, ensureHeadingAnchors, items, largeDocumentMode]);

  const handleNavigate = useCallback(
    (id: string) => {
      const container = containerRef.current;
      if (!container) return;

      ensureHeadingAnchors(container);
      let el = container.querySelector<HTMLElement>(`#${escapeCssIdentifier(id)}`);
      const targetText = el ? null : findTocTextById(items, id);

      if (!el && targetText) {
        const headings = Array.from(container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
        el = headings.find((heading) => extractHeadingText(heading) === targetText) ?? null;
      }

      if (el) {
        el.scrollIntoView({ behavior: tocSmoothScrollEnabled ? 'smooth' : 'auto', block: 'start' });
        highlightHeading(el);
        setActiveId(id);
        pendingNavigationIdRef.current = null;
        return;
      }

      pendingNavigationIdRef.current = id;
      setActiveId(id);
      window.dispatchEvent(
        new CustomEvent(MARKDOWN_TOC_NAVIGATE_EVENT, {
          detail: { id, text: targetText ?? '' },
        }),
      );
    },
    [containerRef, ensureHeadingAnchors, highlightHeading, items, tocSmoothScrollEnabled],
  );

  useEffect(() => {
    const handleHeadingReady = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (typeof id !== 'string' || pendingNavigationIdRef.current !== id) return;
      handleNavigate(id);
    };

    window.addEventListener(MARKDOWN_HEADING_READY_EVENT, handleHeadingReady);
    return () => window.removeEventListener(MARKDOWN_HEADING_READY_EVENT, handleHeadingReady);
  }, [handleNavigate]);

  if (items.length === 0) return null;

  return (
    <nav
      className={`feishu-toc feishu-toc--overflow-${tocOverflowMode}`}
      aria-label="Table of contents"
      role="navigation"
    >
      <div className="feishu-toc__header">目录</div>
      <ul className="feishu-toc__list" role="tree">
        {items.map((item, index) => (
          <TOCItem
            key={`${item.id}-${index}`}
            item={item}
            activeId={activeId}
            onNavigate={handleNavigate}
            tocPath={`${item.id}-${index}`}
            largeDocumentMode={largeDocumentMode}
          />
        ))}
      </ul>
    </nav>
  );
}
