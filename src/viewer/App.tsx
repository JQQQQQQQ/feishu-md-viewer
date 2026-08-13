import { useEffect, useMemo } from 'react';
import { type PageSource } from '../content/detector';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { MarkdownReadView } from './components/Markdown/MarkdownReadView';
import { AppShell } from './components/Layout/AppShell';
import { ReadingProgress } from './components/Layout/ReadingProgress';
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

function getThemeClass(theme: 'light' | 'dark' | 'system'): string {
  switch (theme) {
    case 'dark':
      return 'feishu-viewer--dark';
    case 'system':
      return 'feishu-viewer--system';
    default:
      return '';
  }
}

export function App({ markdown, source }: AppProps) {
  const theme = useViewerStore((s) => s.theme);
  const fontSize = useViewerStore((s) => s.fontSize);
  const loadSettings = useViewerStore((s) => s.loadSettings);

  // Load stored settings on mount
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const tocItems = useTOC(markdown);
  const title = useMemo(() => extractTitle(markdown), [markdown]);

  const themeClass = getThemeClass(theme);
  const viewerClasses = [
    'feishu-viewer',
    'feishu-viewer--reading',
    themeClass,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ErrorBoundary>
      <div
        className={viewerClasses}
        role="article"
        aria-label="Rendered markdown document"
        data-source={source}
        data-mode="read"
        style={{ '--feishu-font-size-body': `${fontSize}px` } as React.CSSProperties}
      >
        <ReadingProgress />
        <AppShell
          title={title}
          tocItems={tocItems}
        >
          <div className="feishu-viewer__page" data-mode="read">
            <div className="feishu-viewer__content" data-mode="read">
              <MarkdownReadView content={markdown} />
            </div>
          </div>
        </AppShell>
      </div>
    </ErrorBoundary>
  );
}
