import {
  isValidElement,
  useCallback,
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

  const isCollapsible = level === 2 || level === 3;

  const handleToggle = useCallback(() => {
    if (!headingRef.current) return;
    const next = !collapsed;
    setCollapsed(next);

    let sibling = headingRef.current.nextElementSibling;
    while (sibling) {
      const tagName = sibling.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tagName)) {
        const siblingLevel = parseInt(tagName.charAt(1), 10);
        if (siblingLevel <= level) break;
      }
      (sibling as HTMLElement).style.display = next ? 'none' : '';
      sibling = sibling.nextElementSibling;
    }
  }, [collapsed, level]);

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
