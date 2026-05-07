import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useState,
  type ComponentType,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { CircleAlert, Info, Lightbulb, Sparkles, TriangleAlert, type LucideIcon } from 'lucide-react';
import { MermaidBlock } from './MermaidBlock';
import { FeishuHeading } from './Heading';
import { FeishuImage } from './ImagePreview';
import { MermaidToolbar } from '../Mermaid/MermaidToolbar';

type ComponentMap = Record<string, ComponentType<HTMLAttributes<HTMLElement> & { children?: ReactNode }>>;
type CalloutType = 'note' | 'tip' | 'warning' | 'important' | 'caution';

interface CalloutMeta {
  title: string;
  icon: LucideIcon;
}

const CALLOUT_META: Record<CalloutType, CalloutMeta> = {
  note: { title: 'Note', icon: Info },
  tip: { title: 'Tip', icon: Lightbulb },
  warning: { title: 'Warning', icon: TriangleAlert },
  important: { title: 'Important', icon: Sparkles },
  caution: { title: 'Caution', icon: CircleAlert },
};

let mermaidIndex = 0;

function getStringChildren(children: ReactNode): string | null {
  const childArray = Children.toArray(children);
  if (childArray.length === 0) return '';
  if (childArray.every((child) => typeof child === 'string')) {
    return childArray.join('');
  }
  return null;
}

function getCalloutType(text: string): CalloutType | null {
  const match = text.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
  return match?.[1]?.toLowerCase() as CalloutType | null;
}

function stripCalloutMarker(text: string): string {
  return text.replace(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\][ \t]*(?:\n)?/i, '');
}

function getCalloutContent(children: ReactNode): { type: CalloutType; children: ReactNode[] } | null {
  const childArray = Children.toArray(children);
  const firstContentIndex = childArray.findIndex((child) => (
    typeof child !== 'string' || child.trim() !== ''
  ));
  if (firstContentIndex < 0) return null;

  const firstChild = childArray[firstContentIndex];
  if (!isValidElement(firstChild)) return null;

  const firstChildProps = firstChild.props as { children?: ReactNode };
  const firstText = getStringChildren(firstChildProps.children);
  if (firstText === null) return null;

  const type = getCalloutType(firstText);
  if (!type) return null;

  const strippedText = stripCalloutMarker(firstText);
  const nextChildren = strippedText.trim()
    ? [
        ...childArray.slice(0, firstContentIndex),
        cloneElement(
          firstChild as ReactElement<{ children?: ReactNode }>,
          undefined,
          strippedText
        ),
        ...childArray.slice(firstContentIndex + 1),
      ]
    : [
        ...childArray.slice(0, firstContentIndex),
        ...childArray.slice(firstContentIndex + 1),
      ];

  return { type, children: nextChildren };
}

function FeishuBlockquote({ children, ...props }: HTMLAttributes<HTMLElement> & { children?: ReactNode }) {
  const callout = getCalloutContent(children);
  if (!callout) {
    return <blockquote className="feishu-blockquote" {...props}>{children}</blockquote>;
  }

  const meta = CALLOUT_META[callout.type];
  const Icon = meta.icon;

  return (
    <blockquote
      className={`feishu-blockquote feishu-callout feishu-callout--${callout.type}`}
      {...props}
    >
      <div className="feishu-callout__header">
        <span className="feishu-callout__icon" aria-hidden="true">
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <span className="feishu-callout__title">{meta.title}</span>
      </div>
      <div className="feishu-callout__content">{callout.children}</div>
    </blockquote>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API may not be available in some contexts
    }
  }, [text]);

  return (
    <button
      className="feishu-code-block__copy-btn"
      onClick={() => void handleCopy()}
      type="button"
      aria-label={copied ? '已复制' : '复制代码'}
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7.5L5 10.5L12 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          已复制
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.5 4.5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h1.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          复制
        </>
      )}
    </button>
  );
}

function FeishuCodeBlock({ children, className, ...props }: HTMLAttributes<HTMLPreElement> & { children?: ReactNode }) {
  // Check if this is a mermaid block
  const childElement = children as { props?: { className?: string; children?: string } } | undefined;
  const lang = childElement?.props?.className?.replace('language-', '') ?? '';
  const code = childElement?.props?.children ?? '';

  if (lang === 'mermaid' && typeof code === 'string') {
    const idx = mermaidIndex++;
    return (
      <MermaidToolbar code={code} blockIndex={idx}>
        <MermaidBlock code={code} index={idx} />
      </MermaidToolbar>
    );
  }

  const codeText = typeof code === 'string' ? code : '';

  return (
    <div className="feishu-code-block">
      {lang && <span className="feishu-code-block__lang">{lang}</span>}
      {codeText && <CopyButton text={codeText} />}
      <pre className={`feishu-code-block__pre ${className ?? ''}`} {...props}>
        {children}
      </pre>
    </div>
  );
}

export const feishuComponents: ComponentMap = {
  h1: (props) => <FeishuHeading level={1} {...props} />,
  h2: (props) => <FeishuHeading level={2} {...props} />,
  h3: (props) => <FeishuHeading level={3} {...props} />,
  h4: (props) => <FeishuHeading level={4} {...props} />,
  h5: (props) => <FeishuHeading level={5} {...props} />,
  h6: (props) => <FeishuHeading level={6} {...props} />,
  p: ({ children, ...props }) => (
    <p className="feishu-paragraph" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="feishu-list feishu-list--unordered" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="feishu-list feishu-list--ordered" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="feishu-list__item" {...props}>{children}</li>
  ),
  pre: FeishuCodeBlock as ComponentType<HTMLAttributes<HTMLElement>>,
  code: ({ children, className, ...props }) => {
    if (className?.startsWith('language-')) {
      return <code className={className} {...props}>{children}</code>;
    }
    return <code className="feishu-inline-code" {...props}>{children}</code>;
  },
  table: ({ children, ...props }) => (
    <div className="feishu-table-wrapper">
      <table className="feishu-table" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="feishu-table__head" {...props}>{children}</thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="feishu-table__body" {...props}>{children}</tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="feishu-table__row" {...props}>{children}</tr>
  ),
  th: ({ children, ...props }) => (
    <th className="feishu-table__header" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="feishu-table__cell" {...props}>{children}</td>
  ),
  blockquote: FeishuBlockquote,
  a: ({ children, ...props }) => {
    const href = (props as { href?: string }).href;
    return (
      <a className="feishu-link" href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  img: FeishuImage as ComponentType<ImgHTMLAttributes<HTMLImageElement>>,
  hr: () => <hr className="feishu-divider" />,
};
