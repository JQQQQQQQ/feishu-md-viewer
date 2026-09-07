import type { ReactElement } from 'react';
import type { MarkdownSourceContext } from './markdown-resource-resolver';

type PerformanceLike = Pick<Performance, 'mark' | 'measure'>;

function getPerformance(): PerformanceLike | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const candidate = globalThis.performance;
  if (!candidate || typeof candidate.mark !== 'function' || typeof candidate.measure !== 'function') {
    return undefined;
  }
  return candidate;
}

function isDevelopmentBuild(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/**
 * A small deterministic hash for cache keys. It intentionally hashes UTF-16 code
 * units, matching JavaScript string identity without introducing a dependency.
 */
export function getMarkdownContentHash(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getMarkdownSourceContextKey(sourceContext?: MarkdownSourceContext): string {
  if (!sourceContext) return 'none';
  return [
    sourceContext.source,
    sourceContext.runtime ?? 'default',
    sourceContext.documentUrl,
    sourceContext.contentUrl ?? '',
    sourceContext.assetBaseUrl,
    sourceContext.linkBaseUrl,
  ].join('::');
}

export function getMarkdownRenderCacheKey(
  contentHash: string,
  sourceContext?: MarkdownSourceContext,
): string {
  return `${contentHash}::${getMarkdownSourceContextKey(sourceContext)}`;
}

export function markMarkdownPhase(name: string): void {
  if (!isDevelopmentBuild()) return;
  try {
    getPerformance()?.mark(name);
  } catch {
    // Performance instrumentation must never affect rendering.
  }
}

export function measureMarkdownPhase<T>(name: string, task: () => T): T {
  const performanceApi = isDevelopmentBuild() ? getPerformance() : undefined;
  const startMark = `${name}:start`;
  const endMark = `${name}:end`;

  if (performanceApi) {
    try {
      performanceApi.mark(startMark);
    } catch {
      // Continue with the task if a host does not support named marks.
    }
  }

  try {
    return task();
  } finally {
    if (performanceApi) {
      try {
        performanceApi.mark(endMark);
        performanceApi.measure(name, startMark, endMark);
      } catch {
        // Ignore unsupported or partially implemented Performance APIs.
      }
    }
  }
}

export type MarkdownRenderValue = ReactElement;
