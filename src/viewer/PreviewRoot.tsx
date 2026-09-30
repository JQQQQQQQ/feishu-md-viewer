import { useMemo } from 'react';
import { type PageSource } from '../content/detector';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { MarkdownReadView } from './components/Markdown/MarkdownReadView';
import { AppShell } from './components/Layout/AppShell';
import { countTOCItems } from './components/TOC/TableOfContents';
import { useTOC } from './hooks/useTOC';
import { useViewerStore, type ThemeMode } from './store';
import type { MarkdownSourceContext } from '../lib/markdown-resource-resolver';
import {
  LARGE_DOCUMENT_BLOCK_THRESHOLD,
  LARGE_DOCUMENT_MERMAID_THRESHOLD,
  LARGE_DOCUMENT_HEADING_THRESHOLD,
} from '../lib/markdown-progressive-render';

export interface PreviewRootProps {
  markdown: string;
  source: PageSource;
  sourceContext?: MarkdownSourceContext;
  themeOverride?: ThemeMode;
  settingsEnabled?: boolean;
  contentUpdateAvailable?: boolean;
  contentUpdateRefreshing?: boolean;
  onRefreshContent?: () => void;
}

function extractTitle(markdown: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() ?? '';
}

function getThemeClass(theme: ThemeMode): string {
  switch (theme) {
    case 'light':
      return 'feishu-viewer--light';
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
  sourceContext,
  themeOverride,
  settingsEnabled = false,
  contentUpdateAvailable = false,
  contentUpdateRefreshing = false,
  onRefreshContent,
}: PreviewRootProps) {
  const storedTheme = useViewerStore((s) => s.theme);
  const fontSize = useViewerStore((s) => s.fontSize);
  const tocFontSize = useViewerStore((s) => s.tocFontSize);
  const contentAlignment = useViewerStore((s) => s.contentAlignment);
  const tocItems = useTOC(markdown);
  const largeDocumentMode = useMemo(() => (
    countTOCItems(tocItems) >= LARGE_DOCUMENT_HEADING_THRESHOLD
    || (markdown.match(/^```mermaid\b/gim)?.length ?? 0) >= LARGE_DOCUMENT_MERMAID_THRESHOLD
    || markdown.split(/\r?\n\s*\r?\n/).filter((block) => block.trim()).length >= LARGE_DOCUMENT_BLOCK_THRESHOLD
  ), [markdown, tocItems]);
  const title = useMemo(() => extractTitle(markdown), [markdown]);
  const themeClass = getThemeClass(themeOverride ?? storedTheme);
  const viewerClasses = [
    'feishu-viewer',
    'feishu-viewer--reading',
    `feishu-viewer--content-${contentAlignment}`,
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
        style={
          {
            '--feishu-font-size-body': `${fontSize}px`,
            '--feishu-toc-font-size': `${tocFontSize}px`,
          } as React.CSSProperties
        }
      >
        <AppShell
          title={title}
          tocItems={tocItems}
          settingsEnabled={settingsEnabled}
          contentUpdateAvailable={contentUpdateAvailable}
          contentUpdateRefreshing={contentUpdateRefreshing}
          onRefreshContent={onRefreshContent}
          largeDocumentMode={largeDocumentMode}
        >
          <div className="feishu-viewer__page" data-mode="read">
            <div className="feishu-viewer__content" data-mode="read">
              <MarkdownReadView content={markdown} sourceContext={sourceContext} />
            </div>
          </div>
        </AppShell>
      </div>
    </ErrorBoundary>
  );
}
