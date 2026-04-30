import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('detector', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function setUrl(url: string) {
    Object.defineProperty(window, 'location', {
      value: { href: url, pathname: new URL(url).pathname },
      writable: true,
    });
  }

  it('detects file:// markdown files', async () => {
    setUrl('file:///home/user/docs/readme.md');
    document.body.innerHTML = '<pre>## Hello World</pre>';

    const { detectMarkdownPage } = await import('@/content/detector');
    const result = detectMarkdownPage();

    expect(result.isMarkdown).toBe(true);
    expect(result.source).toBe('file');
    expect(result.rawContent).toBe('## Hello World');
  });

  it('detects .markdown extension', async () => {
    setUrl('file:///docs/notes.markdown');
    document.body.innerHTML = '<pre># Notes</pre>';

    const { detectMarkdownPage } = await import('@/content/detector');
    const result = detectMarkdownPage();

    expect(result.isMarkdown).toBe(true);
    expect(result.source).toBe('file');
  });

  it('detects GitHub blob markdown', async () => {
    setUrl('https://github.com/user/repo/blob/main/README.md');

    const { detectMarkdownPage } = await import('@/content/detector');
    const result = detectMarkdownPage();

    expect(result.isMarkdown).toBe(true);
    expect(result.source).toBe('github');
  });

  it('detects GitLab blob markdown', async () => {
    setUrl('https://gitlab.com/user/repo/-/blob/main/docs/guide.md');

    const { detectMarkdownPage } = await import('@/content/detector');
    const result = detectMarkdownPage();

    expect(result.isMarkdown).toBe(true);
    expect(result.source).toBe('gitlab');
  });

  it('returns false for non-markdown URLs', async () => {
    setUrl('https://example.com/page.html');

    const { detectMarkdownPage } = await import('@/content/detector');
    const result = detectMarkdownPage();

    expect(result.isMarkdown).toBe(false);
    expect(result.source).toBeNull();
  });

  it('returns false for non-md file:// URLs', async () => {
    setUrl('file:///home/user/docs/readme.txt');

    const { detectMarkdownPage } = await import('@/content/detector');
    const result = detectMarkdownPage();

    expect(result.isMarkdown).toBe(false);
  });
});
