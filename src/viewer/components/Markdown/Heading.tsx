import {
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Check, Link } from 'lucide-react';
import { createHeadingId } from '../../utils/heading-slug';

function getNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join('');
  }

  if (isValidElement(node)) {
    return getNodeText((node.props as { children?: ReactNode }).children);
  }

  return '';
}

function getHeadingUrl(id: string): string {
  const url = new URL(window.location.href);
  url.hash = id;
  return url.toString();
}

const HIDDEN_MARKER_ATTR = 'data-feishu-heading-hidden-by';

function getHeadingLevelFromTagName(tagName: string): number | null {
  const match = /^H([1-6])$/.exec(tagName.toUpperCase());
  return match?.[1] ? Number(match[1]) : null;
}

function collectSectionElements(heading: HTMLElement): HTMLElement[] {
  const level = getHeadingLevelFromTagName(heading.tagName);
  if (level === null) return [];

  const elements: HTMLElement[] = [];
  let sibling = heading.nextElementSibling;

  while (sibling) {
    if (sibling instanceof HTMLElement) {
      const siblingLevel = getHeadingLevelFromTagName(sibling.tagName);
      if (siblingLevel !== null && siblingLevel <= level) break;
      elements.push(sibling);
    }
    sibling = sibling.nextElementSibling;
  }

  return elements;
}

function updateHiddenMarker(element: HTMLElement, marker: string, hidden: boolean): void {
  const current = element.getAttribute(HIDDEN_MARKER_ATTR) ?? '';
  const markers = new Set(current.split(',').map((item) => item.trim()).filter(Boolean));

  if (hidden) {
    markers.add(marker);
  } else {
    markers.delete(marker);
  }

  if (markers.size === 0) {
    element.removeAttribute(HIDDEN_MARKER_ATTR);
    return;
  }

  element.setAttribute(HIDDEN_MARKER_ATTR, Array.from(markers).join(','));
}

interface FeishuHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
}

export function FeishuHeading({ level, children, ...props }: FeishuHeadingProps) {
  const Tag = `h${level}` as const;
  const id = createHeadingId(getNodeText(children));
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const collapseMarkerRef = useRef(`h-${Math.random().toString(36).slice(2, 10)}`);

  const isCollapsible = level === 2 || level === 3;

  const syncSiblingVisibility = useCallback((hidden: boolean) => {
    if (!headingRef.current) return;
    const marker = collapseMarkerRef.current;
    const sectionElements = collectSectionElements(headingRef.current);
    sectionElements.forEach((element) => {
      updateHiddenMarker(element, marker, hidden);
    });
  }, []);

  useEffect(() => {
    syncSiblingVisibility(collapsed);
  }, [collapsed, syncSiblingVisibility]);

  useEffect(() => {
    return () => {
      syncSiblingVisibility(false);
    };
  }, [syncSiblingVisibility]);

  const handleToggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
  }, [collapsed]);

  const handleCopyLink = useCallback(async () => {
    if (!id) return;

    try {
      await navigator.clipboard.writeText(getHeadingUrl(id));
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      // Clipboard permissions vary between file://, GitHub, and extension contexts.
    }
  }, [id]);

  return (
    <Tag ref={headingRef} id={id || undefined} className={`feishu-heading feishu-h${level}`} {...props}>
      {isCollapsible && (
        <button
          type="button"
          className={`feishu-heading__toggle${collapsed ? '' : ' feishu-heading__toggle--expanded'}`}
          onClick={handleToggle}
          aria-label={collapsed ? '展开' : '折叠'}
          aria-expanded={!collapsed}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M5 3L11 8L5 13Z"/>
          </svg>
        </button>
      )}
      <span className="feishu-heading__text">{children}</span>
      {id && (
        <button
          type="button"
          className="feishu-heading__anchor"
          onClick={() => void handleCopyLink()}
          aria-label={copied ? '已复制标题链接' : '复制标题链接'}
          title={copied ? '已复制' : '复制标题链接'}
        >
          {copied ? <Check size={15} strokeWidth={2.2} /> : <Link size={15} strokeWidth={2.2} />}
        </button>
      )}
    </Tag>
  );
}
