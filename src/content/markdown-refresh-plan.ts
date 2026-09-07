import {
  diffMarkdownBlocks,
  indexMarkdownBlocks,
  type MarkdownBlockDiff,
} from '../lib/markdown-blocks';
import { getMarkdownContentHash, measureMarkdownPhase } from '../lib/markdown-performance';
import type { MarkdownSourceContext } from '../lib/markdown-resource-resolver';

export interface MarkdownRefreshPlan {
  mode: 'noop' | 'incremental' | 'full';
  previousHash: string;
  nextHash: string;
  diff?: MarkdownBlockDiff;
  reason?: string;
}

export function createMarkdownRefreshPlan(
  previousContent: string,
  nextContent: string,
  sourceContext?: MarkdownSourceContext,
): MarkdownRefreshPlan {
  const previousHash = getMarkdownContentHash(previousContent);
  const nextHash = getMarkdownContentHash(nextContent);
  if (previousHash === nextHash) {
    return { mode: 'noop', previousHash, nextHash };
  }

  // Keep the source context in the public signature so callers can build a
  // single planner for browser and VS Code refreshes. Context-specific
  // resource resolution remains in the Markdown pipeline.
  void sourceContext;
  const previousBlocks = indexMarkdownBlocks(previousContent);
  const nextBlocks = indexMarkdownBlocks(nextContent);
  const diff = measureMarkdownPhase('markdown-refresh-diff', () =>
    diffMarkdownBlocks(previousBlocks, nextBlocks),
  );

  if (diff.requiresFullParse) {
    return {
      mode: 'full',
      previousHash,
      nextHash,
      diff,
      reason: diff.fallbackReason ?? 'Markdown 块差异无法安全增量更新',
    };
  }

  return { mode: 'incremental', previousHash, nextHash, diff };
}
