import { describe, expect, it, beforeEach } from 'vitest';
import { jsx } from 'react/jsx-runtime';
import {
  clearMarkdownRenderCache,
  getCachedMarkdownRender,
  setCachedMarkdownRender,
  type CachedMarkdownRender,
} from '@/lib/markdown-render-cache';

function makeCachedRender(contentHash: string, sourceContextKey = 'file::file:///a.md'): CachedMarkdownRender {
  return {
    key: `${contentHash}::${sourceContextKey}`,
    contentHash,
    sourceContextKey,
    rendered: jsx('span', { children: contentHash }),
    createdAt: Date.now(),
  };
}

describe('markdown-render-cache', () => {
  beforeEach(() => clearMarkdownRenderCache());

  it('keeps the current and previous entries and evicts older entries', () => {
    const first = makeCachedRender('one');
    const second = makeCachedRender('two');
    const third = makeCachedRender('three');

    setCachedMarkdownRender(first.key, first);
    setCachedMarkdownRender(second.key, second);
    setCachedMarkdownRender(third.key, third);

    expect(getCachedMarkdownRender(first.key)).toBeUndefined();
    expect(getCachedMarkdownRender(second.key)).toBe(second);
    expect(getCachedMarkdownRender(third.key)).toBe(third);
  });

  it('separates entries with the same content hash by source context', () => {
    const file = makeCachedRender('same', 'file::file:///a.md');
    const github = makeCachedRender('same', 'github::https://github.com/a/readme.md');

    setCachedMarkdownRender(file.key, file);
    setCachedMarkdownRender(github.key, github);

    expect(getCachedMarkdownRender(file.key)).toBe(file);
    expect(getCachedMarkdownRender(github.key)).toBe(github);
  });
});
