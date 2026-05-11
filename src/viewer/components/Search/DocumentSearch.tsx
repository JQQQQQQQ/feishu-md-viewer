import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

interface DocumentSearchProps {
  containerRef: RefObject<HTMLElement>;
  contentVersion: string;
}

type Direction = 'next' | 'previous';

const MARK_CLASS = 'feishu-search-mark';
const ACTIVE_MARK_CLASS = 'feishu-search-mark--active';

function cleanupMarks(container: HTMLElement): void {
  const marks = Array.from(container.querySelectorAll<HTMLElement>(`.${MARK_CLASS}`));

  for (const mark of marks) {
    const text = document.createTextNode(mark.textContent ?? '');
    mark.replaceWith(text);
    text.parentElement?.normalize();
  }
}

function shouldSkipTextNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent || !node.textContent?.trim()) return true;

  return Boolean(parent.closest([
    `.${MARK_CLASS}`,
    '.feishu-search',
    '.feishu-heading__toggle',
    '.feishu-heading__anchor',
    '.feishu-mermaid',
    'button',
    'svg',
    'style',
    'script',
  ].join(',')));
}

function markMatches(textNode: Text, query: string): HTMLElement[] {
  const source = textNode.nodeValue ?? '';
  const lowerSource = source.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const marks: HTMLElement[] = [];
  let cursor = 0;
  let matchIndex = lowerSource.indexOf(lowerQuery);

  if (matchIndex < 0) return marks;

  const fragment = document.createDocumentFragment();

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      fragment.append(document.createTextNode(source.slice(cursor, matchIndex)));
    }

    const mark = document.createElement('mark');
    mark.className = MARK_CLASS;
    mark.textContent = source.slice(matchIndex, matchIndex + query.length);
    fragment.append(mark);
    marks.push(mark);

    cursor = matchIndex + query.length;
    matchIndex = lowerSource.indexOf(lowerQuery, cursor);
  }

  if (cursor < source.length) {
    fragment.append(document.createTextNode(source.slice(cursor)));
  }

  textNode.replaceWith(fragment);
  return marks;
}

function highlightMatches(container: HTMLElement, query: string): HTMLElement[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (
      shouldSkipTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    ),
  });
  const textNodes: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  return textNodes.flatMap((node) => markMatches(node, query));
}

export function DocumentSearch({ containerRef, contentVersion }: DocumentSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const marksRef = useRef<HTMLElement[]>([]);

  const closeSearch = useCallback(() => {
    const container = containerRef.current;
    if (container) cleanupMarks(container);
    marksRef.current = [];
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
    setTotal(0);
  }, [containerRef]);

  const move = useCallback((direction: Direction) => {
    setActiveIndex((current) => {
      if (marksRef.current.length === 0) return 0;
      const delta = direction === 'next' ? 1 : -1;
      return (current + delta + marksRef.current.length) % marksRef.current.length;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      if (!isSearchShortcut) return;

      event.preventDefault();
      setIsOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    cleanupMarks(container);
    const nextMarks = query.trim() ? highlightMatches(container, query.trim()) : [];
    marksRef.current = nextMarks;
    setTotal(nextMarks.length);
    setActiveIndex((current) => (nextMarks.length > 0 ? Math.min(current, nextMarks.length - 1) : 0));

    return () => cleanupMarks(container);
  }, [containerRef, contentVersion, query]);

  useLayoutEffect(() => {
    const marks = marksRef.current;
    marks.forEach((mark) => mark.classList.remove(ACTIVE_MARK_CLASS));

    const activeMark = marks[activeIndex];
    if (!activeMark) return;

    activeMark.classList.add(ACTIVE_MARK_CLASS);
    activeMark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [activeIndex, total]);

  if (!isOpen) {
    return (
      <button
        className="feishu-search__launcher"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="打开文档搜索"
        title="搜索文档 (Ctrl+F)"
      >
        <Search size={16} strokeWidth={2.1} />
      </button>
    );
  }

  return (
    <div className="feishu-search" role="search">
      <Search className="feishu-search__icon" size={16} strokeWidth={2.1} aria-hidden="true" />
      <input
        ref={inputRef}
        className="feishu-search__input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            move(event.shiftKey ? 'previous' : 'next');
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSearch();
          }
        }}
        placeholder="搜索文档"
        aria-label="搜索文档"
      />
      <span className="feishu-search__count" aria-live="polite">
        {query.trim() ? `${total > 0 ? activeIndex + 1 : 0}/${total}` : '0/0'}
      </span>
      <button
        className="feishu-search__button"
        type="button"
        onClick={() => move('previous')}
        disabled={total === 0}
        aria-label="上一个搜索结果"
      >
        <ChevronUp size={15} strokeWidth={2.2} />
      </button>
      <button
        className="feishu-search__button"
        type="button"
        onClick={() => move('next')}
        disabled={total === 0}
        aria-label="下一个搜索结果"
      >
        <ChevronDown size={15} strokeWidth={2.2} />
      </button>
      <button
        className="feishu-search__button"
        type="button"
        onClick={closeSearch}
        aria-label="关闭文档搜索"
      >
        <X size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}
