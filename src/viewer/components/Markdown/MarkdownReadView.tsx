import { useMemo } from 'react';
import { parseMarkdown } from '../../../lib/markdown-pipeline';

interface MarkdownReadViewProps {
  content: string;
}

export function MarkdownReadView({ content }: MarkdownReadViewProps) {
  const rendered = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="feishu-markdown-body">
      {rendered}
    </div>
  );
}
