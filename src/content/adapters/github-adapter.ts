import type { PlatformAdapter } from '@/shared/types/adapter';

/**
 * GitHub blob URL pattern: github.com/owner/repo/blob/branch/path.md
 * Raw content URL: raw.githubusercontent.com/owner/repo/branch/path.md
 */
const GITHUB_BLOB_PATTERN =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+\.(md|markdown))$/i;

/**
 * Adapter for GitHub markdown files.
 * Fetches raw content from raw.githubusercontent.com.
 */
export class GitHubAdapter implements PlatformAdapter {
  readonly name = 'github';

  detect(): boolean {
    return GITHUB_BLOB_PATTERN.test(window.location.href);
  }

  async getContent(): Promise<string | null> {
    const rawUrl = this.buildRawUrl();
    if (!rawUrl) return this.extractFromDom();

    try {
      const response = await fetch(rawUrl);

      if (response.status === 403) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          throw new Error(
            `GitHub rate limit exceeded. Retry after ${retryAfter} seconds.`
          );
        }
        throw new Error('GitHub API rate limit exceeded. Please try again later.');
      }

      if (!response.ok) {
        return this.extractFromDom();
      }

      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('text/html')) {
        // Got an HTML error page, not raw content
        return this.extractFromDom();
      }

      return await response.text();
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('rate limit')) {
        throw error;
      }
      // Network error — fall back to DOM extraction
      return this.extractFromDom();
    }
  }

  getDocumentTitle(): string {
    const match = GITHUB_BLOB_PATTERN.exec(window.location.href);
    if (!match) return 'GitHub Document';

    const repo = match[2] ?? '';
    const filePath = match[4] ?? '';
    const fileName = filePath.split('/').pop() ?? '';
    const cleanName = fileName.replace(/\.(md|markdown)$/i, '');

    return `${cleanName} - ${repo}`;
  }

  private buildRawUrl(): string | null {
    const url = window.location.href;
    const match = GITHUB_BLOB_PATTERN.exec(url);
    if (!match) return null;

    const owner = match[1];
    const repo = match[2];
    const branch = match[3];
    const path = match[4];

    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }

  private extractFromDom(): string | null {
    // Try to get content from GitHub's code block lines
    const lines = document.querySelectorAll('.blob-code-inner');
    if (lines.length > 0) {
      return Array.from(lines)
        .map((line) => line.textContent ?? '')
        .join('\n');
    }
    return null;
  }
}
