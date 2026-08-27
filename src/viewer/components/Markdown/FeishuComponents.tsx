import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentType,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type InputHTMLAttributes,
  type MouseEvent,
  type VideoHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SourceHTMLAttributes,
} from 'react';
import { CircleAlert, Info, Lightbulb, Sparkles, TriangleAlert, type LucideIcon } from 'lucide-react';
import { FeishuHeading } from './Heading';
import { FeishuImage } from './ImagePreview';
import { FeishuTable } from './FeishuTable';
import { FeishuCodeBlock } from './CodeBlock/CodeBlock';

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

function mergeClassName(base: string, className?: string): string {
  return className ? `${base} ${className}` : base;
}

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

function scrollToInternalAnchor(event: MouseEvent<HTMLAnchorElement>): void {
  const href = event.currentTarget.getAttribute('href') ?? '';
  if (!href.startsWith('#')) return;

  event.preventDefault();
  let targetId = href.slice(1);
  try {
    targetId = decodeURIComponent(targetId);
  } catch {
    // Keep the raw fragment if it is malformed; it simply will not match an id.
  }
  const root = event.currentTarget.getRootNode() as Document | ShadowRoot;
  const target = Array.from(root.querySelectorAll<HTMLElement>('[id]'))
    .find((element) => element.id === targetId);
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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

export const feishuComponents: ComponentMap = {
  h1: (props) => <FeishuHeading level={1} {...props} />,
  h2: (props) => <FeishuHeading level={2} {...props} />,
  h3: (props) => <FeishuHeading level={3} {...props} />,
  h4: (props) => <FeishuHeading level={4} {...props} />,
  h5: (props) => <FeishuHeading level={5} {...props} />,
  h6: (props) => <FeishuHeading level={6} {...props} />,
  p: ({ children, className, ...props }) => (
    <p {...props} className={mergeClassName('feishu-paragraph', className)}>{children}</p>
  ),
  ul: ({ children, className, ...props }) => (
    <ul {...props} className={mergeClassName('feishu-list feishu-list--unordered', className)}>{children}</ul>
  ),
  ol: ({ children, className, ...props }) => (
    <ol {...props} className={mergeClassName('feishu-list feishu-list--ordered', className)}>{children}</ol>
  ),
  li: ({ children, className, ...props }) => (
    <li {...props} className={mergeClassName('feishu-list__item', className)}>{children}</li>
  ),
  input: ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className={mergeClassName('feishu-task-checkbox', className)} />
  ) as unknown as ReactElement,
  pre: FeishuCodeBlock as ComponentType<HTMLAttributes<HTMLElement>>,
  code: ({ children, className, ...props }) => {
    if (className?.startsWith('language-')) {
      return <code className={className} {...props}>{children}</code>;
    }
    return <code className="feishu-inline-code" {...props}>{children}</code>;
  },
  table: FeishuTable as ComponentType<HTMLAttributes<HTMLElement>>,
  thead: ({ children, className, ...props }) => (
    <thead {...props} className={mergeClassName('feishu-table__head', className)}>{children}</thead>
  ),
  tbody: ({ children, className, ...props }) => (
    <tbody {...props} className={mergeClassName('feishu-table__body', className)}>{children}</tbody>
  ),
  tr: ({ children, className, ...props }) => (
    <tr {...props} className={mergeClassName('feishu-table__row', className)}>{children}</tr>
  ),
  th: ({ children, className, ...props }) => (
    <th {...props} className={mergeClassName('feishu-table__header', className)}>{children}</th>
  ),
  td: ({ children, className, ...props }) => (
    <td {...props} className={mergeClassName('feishu-table__cell', className)}>{children}</td>
  ),
  blockquote: FeishuBlockquote,
  a: ({ children, className, ...props }) => {
    const anchorProps = props as { href?: string; target?: string; rel?: string };
    const href = anchorProps.href;
    const isInternal = typeof href === 'string' && href.startsWith('#');
    return (
      <a
        {...props}
        className={mergeClassName('feishu-link', className)}
        href={href}
        target={isInternal ? undefined : (anchorProps.target ?? '_blank')}
        rel={isInternal ? undefined : (anchorProps.rel ?? 'noopener noreferrer')}
        onClick={isInternal ? scrollToInternalAnchor : undefined}
      >
        {children}
      </a>
    );
  },
  img: FeishuImage as ComponentType<ImgHTMLAttributes<HTMLImageElement>>,
  details: ({ children, className, ...props }) => (
    <details {...props} className={mergeClassName('feishu-details', className)}>{children}</details>
  ),
  summary: ({ children, className, ...props }) => (
    <summary {...props} className={mergeClassName('feishu-summary', className)}>{children}</summary>
  ),
  picture: ({ children, className, ...props }) => (
    <picture {...props} className={mergeClassName('feishu-picture', className)}>{children}</picture>
  ),
  source: ((props: SourceHTMLAttributes<HTMLSourceElement>) => <source {...props} />) as ComponentType<HTMLAttributes<HTMLElement>>,
  kbd: ({ children, className, ...props }) => (
    <kbd {...props} className={mergeClassName('feishu-kbd', className)}>{children}</kbd>
  ),
  video: (({ children, className, ...props }: VideoHTMLAttributes<HTMLVideoElement>) => (
    <video {...props} className={mergeClassName('feishu-video', className)}>{children}</video>
  )) as ComponentType<HTMLAttributes<HTMLElement>>,
  hr: () => <hr className="feishu-divider" />,
};
