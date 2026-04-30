import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('GitLabAdapter', () => {
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
    it('returns true for valid GitLab blob .md URLs', async () => {
      setUrl('https://gitlab.com/owner/repo/-/blob/main/README.md');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.detect()).toBe(true);
    });

    it('returns true for GitLab blob .markdown URLs', async () => {
      setUrl('https://gitlab.com/team/project/-/blob/develop/docs/guide.markdown');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.detect()).toBe(true);
    });

    it('returns true for nested path .md URLs', async () => {
      setUrl('https://gitlab.com/group/subgroup/-/blob/feature/docs/api/reference.md');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.detect()).toBe(true);
    });

    it('returns false for non-GitLab URLs', async () => {
      setUrl('https://example.com/owner/repo/-/blob/main/README.md');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.detect()).toBe(false);
    });

    it('returns false for GitLab tree URLs (directory listing)', async () => {
      setUrl('https://gitlab.com/owner/repo/-/tree/main/docs');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.detect()).toBe(false);
    });

    it('returns false for GitLab non-markdown blob files', async () => {
      setUrl('https://gitlab.com/owner/repo/-/blob/main/src/index.ts');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.detect()).toBe(false);
    });

    it('returns false for GitLab merge request pages', async () => {
      setUrl('https://gitlab.com/owner/repo/-/merge_requests/5');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.detect()).toBe(false);
    });
  });

  describe('getDocumentTitle()', () => {
    it('extracts project/filename from a standard blob URL', async () => {
      setUrl('https://gitlab.com/group/myproject/-/blob/main/README.md');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.getDocumentTitle()).toBe('README - myproject');
    });

    it('extracts filename from nested path', async () => {
      setUrl('https://gitlab.com/org/toolkit/-/blob/develop/docs/api/setup.md');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.getDocumentTitle()).toBe('setup - toolkit');
    });

    it('strips .markdown extension from title', async () => {
      setUrl('https://gitlab.com/user/project/-/blob/main/CHANGELOG.markdown');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.getDocumentTitle()).toBe('CHANGELOG - project');
    });

    it('returns fallback title for non-matching URL', async () => {
      setUrl('https://gitlab.com/owner/repo/-/tree/main/docs');
      const { GitLabAdapter } = await import('@/content/adapters/gitlab-adapter');
      const adapter = new GitLabAdapter();
      expect(adapter.getDocumentTitle()).toBe('GitLab Document');
    });
  });
});
