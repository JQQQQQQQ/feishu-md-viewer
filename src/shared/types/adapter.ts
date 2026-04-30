/**
 * Platform adapter interface for multi-platform content extraction.
 * Each adapter encapsulates detection and content retrieval for a specific platform.
 */
export interface PlatformAdapter {
  /** Human-readable adapter name (e.g., "file", "github", "gitlab") */
  name: string;

  /** Returns true if the current page matches this adapter's platform */
  detect(): boolean;

  /** Extracts or fetches the markdown content from the current page */
  getContent(): Promise<string | null>;

  /** Returns a user-friendly document title derived from the URL or page */
  getDocumentTitle(): string;
}
