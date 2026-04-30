/**
 * Detects whether the current page is a Markdown file that should be rendered.
 * Supports: file:// protocol, GitHub blob pages, GitLab blob pages.
 */

export type PageSource = 'file' | 'github' | 'gitlab';

export interface DetectionResult {
  isMarkdown: boolean;
  source: PageSource | null;
  rawContent: string | null;
}

function isFileProtocolMarkdown(): boolean {
  const url = window.location.href;
  if (!url.startsWith('file://')) return false;
  return /\.(md|markdown)$/i.test(window.location.pathname);
}

function isGitHubMarkdown(): boolean {
  const url = window.location.href;
  if (!url.includes('github.com')) return false;
  // Match pattern: github.com/owner/repo/blob/branch/path.md
  return /github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/.+\.(md|markdown)$/i.test(url);
}

function isGitLabMarkdown(): boolean {
  const url = window.location.href;
  if (!url.includes('gitlab.com')) return false;
  // Match pattern: gitlab.com/owner/repo/-/blob/branch/path.md
  return /gitlab\.com\/[^/]+\/[^/]+\/-\/blob\/[^/]+\/.+\.(md|markdown)$/i.test(url);
}

function extractFileContent(): string | null {
  // For file:// protocol, the browser renders raw text in a <pre> tag
  const preElement = document.querySelector('pre');
  if (preElement) {
    return preElement.textContent;
  }
  // Fallback: try body text content
  return document.body.textContent;
}

function extractGitHubContent(): string | null {
  // GitHub renders markdown in a specific container - we look for raw content
  // Try the raw content button / fetch from raw URL
  const rawButton = document.querySelector<HTMLAnchorElement>(
    'a[data-testid="raw-button"], a.js-display-url[href*="/raw/"]'
  );
  if (rawButton?.href) {
    // We'll fetch this asynchronously - return null and handle in async flow
    return null;
  }
  // Try to get content from the code block
  const codeBlock = document.querySelector('.blob-code-inner');
  if (codeBlock) {
    const lines = document.querySelectorAll('.blob-code-inner');
    return Array.from(lines)
      .map((line) => line.textContent ?? '')
      .join('\n');
  }
  return null;
}

function extractGitLabContent(): string | null {
  // GitLab renders code in blob-content container
  const blobContent = document.querySelector('.blob-content code');
  if (blobContent) {
    return blobContent.textContent;
  }
  return null;
}

export async function fetchGitHubRawContent(): Promise<string | null> {
  // Build raw URL from current GitHub URL
  const url = window.location.href;
  const rawUrl = url
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/');

  try {
    const response = await fetch(rawUrl);
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Silently fail - will fall back to DOM extraction
  }
  return null;
}

export async function fetchGitLabRawContent(): Promise<string | null> {
  // Build raw URL from current GitLab URL
  const url = window.location.href;
  const rawUrl = url.replace('/-/blob/', '/-/raw/');

  try {
    const response = await fetch(rawUrl);
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Silently fail - will fall back to DOM extraction
  }
  return null;
}

export function detectMarkdownPage(): DetectionResult {
  if (isFileProtocolMarkdown()) {
    return {
      isMarkdown: true,
      source: 'file',
      rawContent: extractFileContent(),
    };
  }

  if (isGitHubMarkdown()) {
    return {
      isMarkdown: true,
      source: 'github',
      rawContent: extractGitHubContent(),
    };
  }

  if (isGitLabMarkdown()) {
    return {
      isMarkdown: true,
      source: 'gitlab',
      rawContent: extractGitLabContent(),
    };
  }

  return {
    isMarkdown: false,
    source: null,
    rawContent: null,
  };
}
