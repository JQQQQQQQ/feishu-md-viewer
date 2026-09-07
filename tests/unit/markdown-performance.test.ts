import { describe, expect, it, vi } from 'vitest';
import { jsx } from 'react/jsx-runtime';
import {
  getMarkdownContentHash,
  getMarkdownSourceContextKey,
  markMarkdownPhase,
  measureMarkdownPhase,
} from '@/lib/markdown-performance';

describe('markdown-performance', () => {
  it('returns stable hashes for identical content and different hashes after edits', () => {
    expect(getMarkdownContentHash('# A')).toBe(getMarkdownContentHash('# A'));
    expect(getMarkdownContentHash('# A')).not.toBe(getMarkdownContentHash('# B'));
  });

  it('builds a stable source-context key without including view settings', () => {
    const key = getMarkdownSourceContextKey({
      source: 'file',
      runtime: 'browser',
      documentUrl: 'file:///docs/readme.md',
      contentUrl: 'file:///docs/readme.md',
      assetBaseUrl: 'file:///docs/',
      linkBaseUrl: 'file:///docs/',
    });

    expect(key).toContain('file');
    expect(key).toContain('file:///docs/readme.md');
    expect(key).not.toContain('theme');
    expect(key).not.toContain('fontSize');
  });

  it('does not throw when performance APIs are unavailable', () => {
    const originalPerformance = globalThis.performance;
    vi.stubGlobal('performance', undefined);

    expect(() => markMarkdownPhase('markdown-index')).not.toThrow();
    expect(measureMarkdownPhase('markdown-parse', () => 'ok')).toBe('ok');

    vi.stubGlobal('performance', originalPerformance);
  });

  it('returns the task result even when performance.mark throws', () => {
    const mark = vi.spyOn(performance, 'mark').mockImplementation(() => {
      throw new Error('unsupported');
    });

    expect(measureMarkdownPhase('markdown-parse', () => jsx('span', { children: 'ok' }))).toBeDefined();

    mark.mockRestore();
  });
});
