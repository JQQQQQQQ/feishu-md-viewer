import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('GitHubAdapter', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function setUrl(url: string) {
    Object.defineProperty(window, 'location', {
      value: { href: url, pathname: new URL(url).pathname },
      writable: true,
    });
  }

  describe('detect()', () => {
    it('returns true for valid GitHub blob .md URLs', async () => {
      setUrl('https://github.com/owner/repo/blob/main/README.md');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.detect()).toBe(true);
    });

    it('returns true for GitHub blob .markdown URLs', async () => {
      setUrl('https://github.com/user/project/blob/develop/docs/guide.markdown');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.detect()).toBe(true);
    });

    it('returns true for nested path .md URLs', async () => {
      setUrl('https://github.com/org/repo/blob/feature/branch/src/docs/api/reference.md');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.detect()).toBe(true);
    });

    it('returns false for non-GitHub URLs', async () => {
      setUrl('https://example.com/owner/repo/blob/main/README.md');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.detect()).toBe(false);
    });

    it('returns false for GitHub non-blob URLs (tree)', async () => {
      setUrl('https://github.com/owner/repo/tree/main/docs');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.detect()).toBe(false);
    });

    it('returns false for GitHub non-markdown blob files', async () => {
      setUrl('https://github.com/owner/repo/blob/main/index.ts');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.detect()).toBe(false);
    });

    it('returns false for GitHub issues/PRs', async () => {
      setUrl('https://github.com/owner/repo/issues/42');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.detect()).toBe(false);
    });
  });

  describe('getDocumentTitle()', () => {
    it('extracts repo/filename from a standard blob URL', async () => {
      setUrl('https://github.com/facebook/react/blob/main/README.md');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.getDocumentTitle()).toBe('README - react');
    });

    it('extracts filename from nested path', async () => {
      setUrl('https://github.com/org/mylib/blob/develop/docs/api/getting-started.md');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.getDocumentTitle()).toBe('getting-started - mylib');
    });

    it('strips .markdown extension from title', async () => {
      setUrl('https://github.com/user/project/blob/main/CONTRIBUTING.markdown');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.getDocumentTitle()).toBe('CONTRIBUTING - project');
    });

    it('returns fallback title for non-matching URL', async () => {
      setUrl('https://github.com/owner/repo/tree/main/docs');
      const { GitHubAdapter } = await import('@/content/adapters/github-adapter');
      const adapter = new GitHubAdapter();
      expect(adapter.getDocumentTitle()).toBe('GitHub Document');
    });
  });
});
