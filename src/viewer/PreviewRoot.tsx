import { useMemo } from 'react';
import { type PageSource } from '../content/detector';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { MarkdownReadView } from './components/Markdown/MarkdownReadView';
import { AppShell } from './components/Layout/AppShell';
import { ReadingProgress } from './components/Layout/ReadingProgress';
import { useTOC } from './hooks/useTOC';
import { useViewerStore, type ThemeMode } from './store';

export interface PreviewRootProps {
  markdown: string;
  source: PageSource;
  themeOverride?: ThemeMode;
  settingsEnabled?: boolean;
}

function extractTitle(markdown: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() ?? '';
}

function getThemeClass(theme: ThemeMode): string {
  switch (theme) {
    case 'dark':
      return 'feishu-viewer--dark';
    case 'system':
      return 'feishu-viewer--system';
    default:
      return '';
  }
}

export function PreviewRoot({
  markdown,
  source,
  themeOverride,
  settingsEnabled = false,
}: PreviewRootProps) {
  const storedTheme = useViewerStore((s) => s.theme);
  const fontSize = useViewerStore((s) => s.fontSize);
  const tocItems = useTOC(markdown);
  const title = useMemo(() => extractTitle(markdown), [markdown]);
  const themeClass = getThemeClass(themeOverride ?? storedTheme);
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
          settingsEnabled={settingsEnabled}
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
