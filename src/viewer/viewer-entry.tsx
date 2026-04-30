/**
 * Entry point for the standalone extension viewer page.
 * Reads a URL from query parameters, fetches the markdown content,
 * and renders the App component.
 */
import { createRoot } from 'react-dom/client';
import { useState, useEffect, useCallback } from 'react';
import { App } from './App';
import { LoadingState } from './components/Common/LoadingState';
import { ErrorState } from './components/Common/ErrorState';
import './styles/feishu-theme.css';
import './styles/markdown.css';
import './styles/layout.css';
import './styles/editor.css';
import './styles/save-status.css';
import './styles/tailwind-output.css';
import './styles/dark-theme.css';
import './styles/print.css';

const ALLOWED_ORIGINS = [
  'file://',
  'https://github.com',
  'https://gitlab.com',
  'https://raw.githubusercontent.com',
];

type FetchStatus = 'loading' | 'success' | 'error';

function isAllowedUrl(url: string): boolean {
  return ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
}

/**
 * Derive a PageSource from a URL string for the App component.
 */
function getSourceFromUrl(url: string): 'file' | 'github' | 'gitlab' {
  if (url.startsWith('file://')) return 'file';
  if (url.includes('gitlab.com')) return 'gitlab';
  return 'github';
}

function ViewerPage() {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');

  const fetchContent = useCallback(async (url: string) => {
    setStatus('loading');
    setError('');

    if (!url) {
      setStatus('error');
      setError('No URL provided. Use ?url= parameter to specify a markdown file.');
      return;
    }

    if (!isAllowedUrl(url)) {
      setStatus('error');
      setError(
        `URL not allowed. Only file://, github.com, gitlab.com, and raw.githubusercontent.com URLs are supported.`
      );
      return;
    }

    try {
      const response = await fetch(url);

      if (response.status === 403) {
        const retryAfter = response.headers.get('Retry-After');
        const rateLimitMsg = retryAfter
          ? `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
          : 'Access denied (403). You may have hit a rate limit. Please try again later.';
        setStatus('error');
        setError(rateLimitMsg);
        return;
      }

      if (!response.ok) {
        setStatus('error');
        setError(`Failed to fetch: HTTP ${response.status} ${response.statusText}`);
        return;
      }

      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('text/html') && !url.startsWith('file://')) {
        setStatus('error');
        setError(
          'Received HTML instead of raw markdown. The URL may require authentication or may not be a raw content URL.'
        );
        return;
      }

      const text = await response.text();
      setContent(text);
      setStatus('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown network error';
      setStatus('error');
      setError(`Network error: ${message}`);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') ?? '';
    setTargetUrl(url);
    void fetchContent(url);
  }, [fetchContent]);

  const handleRetry = useCallback(() => {
    void fetchContent(targetUrl);
  }, [fetchContent, targetUrl]);

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return (
      <ErrorState
        message={error}
        url={targetUrl || undefined}
        onRetry={targetUrl ? handleRetry : undefined}
      />
    );
  }

  const source = getSourceFromUrl(targetUrl);

  return <App markdown={content} source={source} />;
}

const rootElement = document.getElementById('viewer-root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<ViewerPage />);
}
