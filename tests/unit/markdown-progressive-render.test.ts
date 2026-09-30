import { describe, expect, it } from 'vitest';
import {
  classifyMarkdownRenderStrategy,
  chunkMarkdownBlocks,
  createProgressiveRenderScheduler,
  getInitialMarkdownBatchCount,
} from '@/lib/markdown-progressive-render';

describe('markdown progressive render strategy', () => {
  it('keeps ordinary documents on synchronous rendering', () => {
    expect(classifyMarkdownRenderStrategy({ blockCount: 1199, headingCount: 499, mermaidCount: 79 }))
      .toBe('sync');
  });

  it('enables progressive rendering when any large-document threshold is reached', () => {
    expect(classifyMarkdownRenderStrategy({ blockCount: 1200, headingCount: 0, mermaidCount: 0 }))
      .toBe('progressive');
    expect(classifyMarkdownRenderStrategy({ blockCount: 0, headingCount: 500, mermaidCount: 0 }))
      .toBe('progressive');
    expect(classifyMarkdownRenderStrategy({ blockCount: 0, headingCount: 0, mermaidCount: 80 }))
      .toBe('progressive');
  });

  it('chunks blocks without losing order', () => {
    const blocks = Array.from({ length: 165 }, (_, index) => ({ renderKey: `block-${index}` }));
    const chunks = chunkMarkdownBlocks(blocks, 80);
    expect(chunks.map((chunk) => chunk.length)).toEqual([80, 80, 5]);
    expect(chunks.flat().map((block) => block.renderKey)).toEqual(blocks.map((block) => block.renderKey));
  });

  it('renders at least one batch immediately', () => {
    expect(getInitialMarkdownBatchCount(0)).toBe(0);
    expect(getInitialMarkdownBatchCount(5)).toBe(1);
  });

  it('commits the first batch immediately and schedules the remaining batches', () => {
    const scheduled: Array<() => void> = [];
    const committed: number[] = [];
    const scheduler = createProgressiveRenderScheduler({
      schedule: (callback) => scheduled.push(callback),
      cancelSchedule: () => undefined,
    });

    scheduler.start(3, (batchIndex) => committed.push(batchIndex));
    expect(committed).toEqual([0]);
    scheduled.shift()?.();
    expect(committed).toEqual([0, 1]);
    scheduled.shift()?.();
    expect(committed).toEqual([0, 1, 2]);
  });

  it('cancels old work so stale batches cannot commit', () => {
    const scheduled: Array<() => void> = [];
    const committed: number[] = [];
    const scheduler = createProgressiveRenderScheduler({
      schedule: (callback) => scheduled.push(callback),
      cancelSchedule: () => undefined,
    });

    scheduler.start(3, (batchIndex) => committed.push(batchIndex));
    scheduler.cancel();
    scheduled.shift()?.();
    expect(committed).toEqual([0]);
  });

  it('schedules one deferred task without draining all batches', () => {
    const scheduled: Array<() => void> = [];
    const committed: number[] = [];
    const scheduler = createProgressiveRenderScheduler({
      schedule: (callback) => scheduled.push(callback),
      cancelSchedule: () => undefined,
    });

    scheduler.schedule(() => committed.push(1));
    scheduler.schedule(() => committed.push(2));
    expect(committed).toEqual([]);
    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(committed).toEqual([1]);
  });
});
