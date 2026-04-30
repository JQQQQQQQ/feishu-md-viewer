import { useEffect, useMemo } from 'react';
import { type PageSource } from '../content/detector';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { MarkdownRenderer } from './components/Markdown/MarkdownRenderer';
import { MarkdownEditor } from './components/Markdown/MarkdownEditor';
import { AppShell } from './components/Layout/AppShell';
import { useTOC } from './hooks/useTOC';
import { useViewerStore } from './store';

interface AppProps {
  markdown: string;
  source: PageSource;
}

function extractTitle(markdown: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() ?? '';
}

export function App({ markdown, source }: AppProps) {
  const initDocument = useViewerStore((s) => s.initDocument);
  const content = useViewerStore((s) => s.content);
  const mode = useViewerStore((s) => s.mode);

  // Initialize the store with the markdown content
  useEffect(() => {
    initDocument(markdown);
  }, [markdown, initDocument]);

  const tocItems = useTOC(content || markdown);
  const title = useMemo(() => extractTitle(content || markdown), [content, markdown]);

  const displayContent = content || markdown;

  return (
    <ErrorBoundary>
      <div
        className="feishu-viewer"
        role="article"
        aria-label="Rendered markdown document"
        data-source={source}
      >
        <AppShell title={title} tocItems={tocItems}>
          {mode === 'edit' ? (
            <div className="feishu-viewer__page feishu-viewer__page--editor">
              <MarkdownEditor />
            </div>
          ) : (
            <div className="feishu-viewer__page">
              <div className="feishu-viewer__content">
                <MarkdownRenderer content={displayContent} />
              </div>
            </div>
          )}
        </AppShell>
      </div>
    </ErrorBoundary>
  );
}
