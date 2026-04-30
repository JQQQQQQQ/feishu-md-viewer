import { useCallback, useEffect, useState, useRef } from 'react';
import type { TOCItem as TOCItemType } from '../../hooks/useTOC';
import { TOCItem } from './TOCItem';

interface TableOfContentsProps {
  items: TOCItemType[];
  containerRef: React.RefObject<HTMLElement | null>;
}

export function TableOfContents({ items, containerRef }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const headings = container.querySelectorAll<HTMLElement>('[id].feishu-heading');
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

    headings.forEach((h) => observerRef.current?.observe(h));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [containerRef, items]);

  const handleNavigate = useCallback((id: string) => {
    const el = containerRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, [containerRef]);

  if (items.length === 0) return null;

  return (
    <nav className="feishu-toc" aria-label="Table of contents" role="navigation">
      <div className="feishu-toc__header">目录</div>
      <ul className="feishu-toc__list" role="tree">
        {items.map((item) => (
          <TOCItem key={item.id} item={item} activeId={activeId} onNavigate={handleNavigate} />
        ))}
      </ul>
    </nav>
  );
}
