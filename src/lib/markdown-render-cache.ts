import type { ReactElement } from 'react';

export interface CachedMarkdownRender {
  key: string;
  contentHash: string;
  sourceContextKey: string;
  rendered: ReactElement;
  createdAt: number;
}

const MAX_CACHE_ENTRIES = 2;
const cache = new Map<string, CachedMarkdownRender>();

export function getCachedMarkdownRender(key: string): CachedMarkdownRender | undefined {
  return cache.get(key);
}

export function setCachedMarkdownRender(key: string, value: CachedMarkdownRender): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export function clearMarkdownRenderCache(): void {
  cache.clear();
}
