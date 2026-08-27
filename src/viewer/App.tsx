import { useEffect } from 'react';
import { type PageSource } from '../content/detector';
import { PreviewRoot } from './PreviewRoot';
import { useViewerStore } from './store';
import type { MarkdownSourceContext } from '../lib/markdown-resource-resolver';

interface AppProps {
  markdown: string;
  source: PageSource;
  sourceContext?: MarkdownSourceContext;
  contentUpdateAvailable?: boolean;
  contentUpdateRefreshing?: boolean;
  onRefreshContent?: () => void;
}

export function App({
  markdown,
  source,
  sourceContext,
  contentUpdateAvailable = false,
  contentUpdateRefreshing = false,
  onRefreshContent,
}: AppProps) {
  const loadSettings = useViewerStore((s) => s.loadSettings);

  // Load stored settings on mount
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <PreviewRoot
      markdown={markdown}
      source={source}
      sourceContext={sourceContext}
      settingsEnabled={true}
      contentUpdateAvailable={contentUpdateAvailable}
      contentUpdateRefreshing={contentUpdateRefreshing}
      onRefreshContent={onRefreshContent}
    />
  );
}
