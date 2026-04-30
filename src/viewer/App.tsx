import { useMemo } from 'react';
import { type PageSource } from '../content/detector';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { MarkdownRenderer } from './components/Markdown/MarkdownRenderer';
import { AppShell } from './components/Layout/AppShell';
import { useTOC } from './hooks/useTOC';

interface AppProps {
  markdown: string;
  source: PageSource;
}

function extractTitle(markdown: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() ?? '';
}

export function App({ markdown, source }: AppProps) {
  const tocItems = useTOC(markdown);
  const title = useMemo(() => extractTitle(markdown), [markdown]);

  return (
    <ErrorBoundary>
      <div
        className="feishu-viewer"
        role="article"
        aria-label="Rendered markdown document"
        data-source={source}
      >
        <AppShell title={title} tocItems={tocItems}>
          <div className="feishu-viewer__page">
            <div className="feishu-viewer__content">
              <MarkdownRenderer content={markdown} />
            </div>
          </div>
        </AppShell>
      </div>
    </ErrorBoundary>
  );
}
