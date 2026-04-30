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

  getDocumentTitle(): string {
    const pathname = window.location.pathname;
    const segments = pathname.split('/');
    const filename = segments[segments.length - 1] ?? '';
    // Remove extension for cleaner title
    return filename.replace(/\.(md|markdown)$/i, '') || 'Untitled';
  }
}
