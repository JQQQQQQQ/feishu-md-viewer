import { type PageSource } from '../content/detector';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { MarkdownRenderer } from './components/Markdown/MarkdownRenderer';

interface AppProps {
  markdown: string;
  source: PageSource;
}

export function App({ markdown, source }: AppProps) {
  return (
    <ErrorBoundary>
      <div
        className="feishu-viewer"
        role="article"
        aria-label="Rendered markdown document"
        data-source={source}
      >
        <div className="feishu-viewer__page">
          <div className="feishu-viewer__content">
            <MarkdownRenderer content={markdown} />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
