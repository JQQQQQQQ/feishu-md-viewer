import { useMemo } from 'react';
import { parseMarkdown } from '../../../lib/markdown-pipeline';
import { ErrorBoundary } from '../Common/ErrorBoundary';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const rendered = useMemo(() => {
    try {
      return parseMarkdown(content);
    } catch {
      return null;
    }
  }, [content]);

  if (!rendered) {
    return (
      <div className="feishu-error" role="alert">
        <p>Failed to parse markdown content.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="feishu-markdown-body">{rendered}</div>
    </ErrorBoundary>
  );
}
