import type { MarkdownBlock } from './markdown-blocks';

export const LARGE_DOCUMENT_BLOCK_THRESHOLD = 1200;
export const LARGE_DOCUMENT_HEADING_THRESHOLD = 500;
export const LARGE_DOCUMENT_MERMAID_THRESHOLD = 80;
export const MARKDOWN_RENDER_BATCH_SIZE = 80;
export const MARKDOWN_NAVIGATION_BATCHES_PER_TURN = 8;
export const MARKDOWN_TOC_NAVIGATE_EVENT = 'feishu-toc-navigate';
export const MARKDOWN_HEADING_READY_EVENT = 'feishu-heading-ready';
export const MARKDOWN_HEADINGS_CHANGED_EVENT = 'feishu-headings-changed';

export interface MarkdownRenderShape {
  blockCount: number;
  headingCount: number;
  mermaidCount: number;
}

export type MarkdownRenderStrategy = 'sync' | 'progressive';

export function classifyMarkdownRenderStrategy(shape: MarkdownRenderShape): MarkdownRenderStrategy {
  return shape.blockCount >= LARGE_DOCUMENT_BLOCK_THRESHOLD
    || shape.headingCount >= LARGE_DOCUMENT_HEADING_THRESHOLD
    || shape.mermaidCount >= LARGE_DOCUMENT_MERMAID_THRESHOLD
    ? 'progressive'
    : 'sync';
}

export function chunkMarkdownBlocks<T>(blocks: T[], batchSize = MARKDOWN_RENDER_BATCH_SIZE): T[][] {
  const safeBatchSize = Number.isFinite(batchSize) && batchSize > 0
    ? Math.floor(batchSize)
    : MARKDOWN_RENDER_BATCH_SIZE;
  const chunks: T[][] = [];
  for (let index = 0; index < blocks.length; index += safeBatchSize) {
    chunks.push(blocks.slice(index, index + safeBatchSize));
  }
  return chunks;
}

export function getInitialMarkdownBatchCount(totalBatches: number): number {
  return totalBatches > 0 ? 1 : 0;
}

export type ProgressiveRenderSchedule = (callback: () => void) => unknown;
export type ProgressiveRenderCancel = (handle: unknown) => void;

export interface ProgressiveRenderSchedulerOptions {
  schedule: ProgressiveRenderSchedule;
  cancelSchedule: ProgressiveRenderCancel;
}

export interface ProgressiveRenderScheduler {
  start(totalBatches: number, onBatch: (batchIndex: number) => void): void;
  schedule(callback: () => void): void;
  cancel(): void;
}

export function createProgressiveRenderScheduler({
  schedule,
  cancelSchedule,
}: ProgressiveRenderSchedulerOptions): ProgressiveRenderScheduler {
  let generation = 0;
  let pendingHandle: unknown;

  const cancel = () => {
    generation += 1;
    if (pendingHandle !== undefined) {
      cancelSchedule(pendingHandle);
      pendingHandle = undefined;
    }
  };

  const scheduleOne = (callback: () => void) => {
    if (pendingHandle !== undefined) return;
    const currentGeneration = generation;
    pendingHandle = schedule(() => {
      pendingHandle = undefined;
      if (currentGeneration !== generation) return;
      callback();
    });
  };

  const start = (totalBatches: number, onBatch: (batchIndex: number) => void) => {
    cancel();
    if (!Number.isFinite(totalBatches) || totalBatches <= 0) return;

    let nextBatchIndex = 0;
    onBatch(nextBatchIndex);
    nextBatchIndex += 1;

    const scheduleNext = () => {
      if (nextBatchIndex >= totalBatches) return;
      scheduleOne(() => {
        if (nextBatchIndex >= totalBatches) return;
        onBatch(nextBatchIndex);
        nextBatchIndex += 1;
        scheduleNext();
      });
    };

    scheduleNext();
  };

  return { start, schedule: scheduleOne, cancel };
}

export function createBrowserProgressiveRenderScheduler(): ProgressiveRenderScheduler {
  const handles = new Set<ReturnType<typeof setTimeout>>();
  const schedule: ProgressiveRenderSchedule = (callback) => {
    const idleWindow = typeof window !== 'undefined'
      ? window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      }
      : undefined;

    if (idleWindow?.requestIdleCallback) {
      return idleWindow.requestIdleCallback(callback, { timeout: 120 });
    }

    const handle = setTimeout(() => {
      handles.delete(handle);
      callback();
    }, 0);
    handles.add(handle);
    return handle;
  };

  const cancelSchedule: ProgressiveRenderCancel = (handle) => {
    if (typeof handle === 'number' && typeof window !== 'undefined') {
      const idleWindow = window as Window & { cancelIdleCallback?: (value: number) => void };
      if (idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(handle);
        return;
      }
    }
    if (handles.has(handle as ReturnType<typeof setTimeout>)) {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
      handles.delete(handle as ReturnType<typeof setTimeout>);
    }
  };

  return createProgressiveRenderScheduler({ schedule, cancelSchedule });
}

export function getMarkdownRenderShape(blocks: MarkdownBlock[]): MarkdownRenderShape {
  return {
    blockCount: blocks.length,
    headingCount: blocks.filter((block) => block.kind === 'heading').length,
    mermaidCount: blocks.filter((block) => block.kind === 'mermaid').length,
  };
}
