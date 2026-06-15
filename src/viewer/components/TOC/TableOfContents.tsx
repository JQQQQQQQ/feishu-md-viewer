import { useCallback, useEffect, useState, useRef } from 'react';
import type { TOCItem as TOCItemType } from '../../hooks/useTOC';
import { TOCItem } from './TOCItem';
import { createUniqueHeadingIdFactory } from '../../utils/heading-slug';
import { useViewerStore } from '../../store';

interface TableOfContentsProps {
  items: TOCItemType[];
  containerRef: React.RefObject<HTMLElement | null>;
}

function findTocTextById(items: TOCItemType[], id: string): string | null {
  const stack = [...items];
  while (stack.length > 0) {
    const current = stack.shift();
    if (!current) {
      continue;
    }
    if (current.id === id) {
      return current.text;
    }
    if (current.children.length > 0) {
      stack.unshift(...current.children);
    }
  }
  return null;
}

function extractHeadingText(heading: HTMLElement): string {
  const directTextSlot = Array.from(heading.children).find((child) => (
    child instanceof HTMLElement && child.classList.contains('feishu-heading__text')
  ));

  if (directTextSlot instanceof HTMLElement && directTextSlot.textContent) {
    return directTextSlot.textContent.trim();
  }

  const clone = heading.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.feishu-heading__toggle,.feishu-heading__anchor').forEach((node) => node.remove());
  return clone.textContent?.trim() ?? '';
}

function escapeCssIdentifier(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

export function TableOfContents({ items, containerRef }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const tocSmoothScrollEnabled = useViewerStore((s) => s.tocSmoothScrollEnabled);

  const ensureHeadingAnchors = useCallback((container: HTMLElement): HTMLElement[] => {
    const getUniqueId = createUniqueHeadingIdFactory();
    const usedIds = new Set<string>();
    const headings = Array.from(
      container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')
    );

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
    const container = containerRef.current;
    if (!container) return;

    const headings = ensureHeadingAnchors(container);
    if (headings.length === 0) return;

    const callback: IntersectionObserverCallback = (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length > 0) {
        const sorted = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = sorted[0]?.target.id;
        if (topId) setActiveId(topId);
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    });

    headings.forEach((heading) => observerRef.current?.observe(heading));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [containerRef, ensureHeadingAnchors, items]);

  const handleNavigate = useCallback((id: string) => {
    const container = containerRef.current;
    if (!container) return;

    ensureHeadingAnchors(container);
    let el = container.querySelector<HTMLElement>(`#${escapeCssIdentifier(id)}`);

    if (!el) {
      const targetText = findTocTextById(items, id);
      if (targetText) {
        const headings = Array.from(container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
        el = headings.find((heading) => extractHeadingText(heading) === targetText) ?? null;
      }
    }

    if (el) {
      el.scrollIntoView({ behavior: tocSmoothScrollEnabled ? 'smooth' : 'auto', block: 'start' });
      setActiveId(id);
    }
  }, [containerRef, ensureHeadingAnchors, items, tocSmoothScrollEnabled]);

  if (items.length === 0) return null;

  return (
    <nav className="feishu-toc" aria-label="Table of contents" role="navigation">
      <div className="feishu-toc__header">目录</div>
      <ul className="feishu-toc__list" role="tree">
        {items.map((item, index) => (
          <TOCItem
            key={`${item.id}-${index}`}
            item={item}
            activeId={activeId}
            onNavigate={handleNavigate}
            tocPath={`${item.id}-${index}`}
          />
        ))}
      </ul>
    </nav>
  );
}
