import type { PlatformAdapter } from '@/shared/types/adapter';

/**
 * GitLab blob URL pattern: gitlab.com/owner/repo/-/blob/branch/path.md
 * Raw content URL: gitlab.com/owner/repo/-/raw/branch/path.md
 */
const GITLAB_BLOB_PATTERN =
  /^https:\/\/gitlab\.com\/([^/]+)\/([^/]+)\/-\/blob\/([^/]+)\/(.+\.(md|markdown))$/i;

/**
 * Adapter for GitLab markdown files.
 * Fetches raw content from the /-/raw/ endpoint.
 */
export class GitLabAdapter implements PlatformAdapter {
  readonly name = 'gitlab';

  detect(): boolean {
    return GITLAB_BLOB_PATTERN.test(window.location.href);
  }

  async getContent(): Promise<string | null> {
    const rawUrl = this.buildRawUrl();
    if (!rawUrl) return this.extractFromDom();

    try {
      const response = await fetch(rawUrl);

      if (!response.ok) {
        return this.extractFromDom();
      }

      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('text/html')) {
        // Got an HTML error page, not raw content
        return this.extractFromDom();
      }

      return await response.text();
    } catch {
      // Network error — fall back to DOM extraction
      return this.extractFromDom();
    }
  }

  getDocumentTitle(): string {
    const match = GITLAB_BLOB_PATTERN.exec(window.location.href);
    if (!match) return 'GitLab Document';

    const project = match[2] ?? '';
    const filePath = match[4] ?? '';
    const fileName = filePath.split('/').pop() ?? '';
    const cleanName = fileName.replace(/\.(md|markdown)$/i, '');

    return `${cleanName} - ${project}`;
  }

  private buildRawUrl(): string | null {
    const url = window.location.href;
    return url.replace('/-/blob/', '/-/raw/');
  }

  private extractFromDom(): string | null {
    const blobContent = document.querySelector('.blob-content code');
    if (blobContent) {
      return blobContent.textContent;
    }
    return null;
  }
}
