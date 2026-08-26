import type { PlatformAdapter } from '@/shared/types/adapter';

/**
 * Adapter for local file:// protocol markdown files.
 * Browsers render raw text files in a <pre> element.
 */
export class FileAdapter implements PlatformAdapter {
  readonly name = 'file';

  detect(): boolean {
    const { href, pathname } = window.location;
    if (!href.startsWith('file://')) return false;
    return /\.(md|markdown)$/i.test(pathname);
  }

  async getContent(): Promise<string | null> {
    // Browsers render raw text in a <pre> tag for file:// protocol
    const preElement = document.querySelector('pre');
    if (preElement) {
      return preElement.textContent;
    }
    // Fallback: try body text content
    return document.body.textContent;
  }

  /**
   * Re-reads the file URL instead of the already-rendered <pre> node. The
   * browser's file document is a snapshot, so polling the DOM would never see
   * edits made by another application.
   */
  async getFreshContent(): Promise<string | null> {
    if (!window.location.href.startsWith('file://')) return null;

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          type: 'READ_FILE_CONTENT',
          url: window.location.href,
        }) as { content?: unknown } | undefined;
        if (typeof response?.content === 'string') return normalizeFreshContent(response.content);
      }
    } catch {
      // Fall back to a direct read when the service worker is unavailable.
    }

    try {
      const response = await fetch(window.location.href, { cache: 'no-store' });
      if (!response.ok) return null;
      return normalizeFreshContent(await response.text());
    } catch {
      return null;
    }
  }

  getDocumentTitle(): string {
    const pathname = window.location.pathname;
    const segments = pathname.split('/');
    const filename = segments[segments.length - 1] ?? '';
    // Remove extension for cleaner title
    return filename.replace(/\.(md|markdown)$/i, '') || 'Untitled';
  }
}

/**
 * An empty file response is ambiguous for file:// reads: Chromium can return
 * an empty body when the file access bridge is temporarily unavailable. Never
 * let that transient response erase an already-rendered document.
 */
function normalizeFreshContent(content: string): string | null {
  return content.trim().length > 0 ? content : null;
}
