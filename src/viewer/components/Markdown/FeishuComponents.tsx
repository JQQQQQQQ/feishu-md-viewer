import type { ComponentType, HTMLAttributes, ReactNode } from 'react';
import { MermaidBlock } from './MermaidBlock';

type ComponentMap = Record<string, ComponentType<HTMLAttributes<HTMLElement> & { children?: ReactNode }>>;

let mermaidIndex = 0;

function FeishuHeading({ level, children, ...props }: { level: 1 | 2 | 3 | 4 | 5 | 6; children?: ReactNode } & HTMLAttributes<HTMLHeadingElement>) {
  const Tag = `h${level}` as const;
  const id = typeof children === 'string'
    ? children.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/(^-|-$)/g, '')
    : undefined;
  return <Tag id={id} className={`feishu-heading feishu-h${level}`} {...props}>{children}</Tag>;
}

function FeishuCodeBlock({ children, className, ...props }: HTMLAttributes<HTMLPreElement> & { children?: ReactNode }) {
  // Check if this is a mermaid block
  const childElement = children as { props?: { className?: string; children?: string } } | undefined;
  const lang = childElement?.props?.className?.replace('language-', '') ?? '';
  const code = childElement?.props?.children ?? '';

  if (lang === 'mermaid' && typeof code === 'string') {
    const idx = mermaidIndex++;
    return <MermaidBlock code={code} index={idx} />;
  }

  return (
    <div className="feishu-code-block">
      {lang && <span className="feishu-code-block__lang">{lang}</span>}
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
  blockquote: ({ children, ...props }) => (
    <blockquote className="feishu-blockquote" {...props}>{children}</blockquote>
  ),
  a: ({ children, ...props }) => {
    const href = (props as { href?: string }).href;
    return (
      <a className="feishu-link" href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  img: (props) => (
    <img className="feishu-image" loading="lazy" alt="" {...props} />
  ),
  hr: () => <hr className="feishu-divider" />,
};
