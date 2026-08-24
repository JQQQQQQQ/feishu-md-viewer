import { describe, expect, it } from 'vitest';
import {
  areTableIdentityRecordsEqual,
  matchTableIdentities,
  type TableIdentityCandidate,
  type TableIdentityRecord,
} from '@/viewer/components/Markdown/FeishuTableIdentity';

function candidate(
  currentId: string,
  headingPath: string,
  text: string,
  columnCount = 2,
  ordinal = 0,
): TableIdentityCandidate {
  return { currentId, headingPath, text, columnCount, ordinal };
}

function record(id: string, current: TableIdentityCandidate): TableIdentityRecord {
  return { ...current, id };
}

describe('FeishuTableIdentity', () => {
  it('treats an unchanged identity snapshot as equal even when the transient candidate id changes', () => {
    const previous = [record('table-a', candidate('old-candidate', 'h2:1', 'A one two', 2, 0))];
    const next = [record('table-a', candidate('new-candidate', 'h2:1', 'A one two', 2, 0))];

    expect(areTableIdentityRecordsEqual(previous, next)).toBe(true);
  });

  it('matches tables strictly by their order within the same heading', () => {
    const previous = [
      record('table-a', candidate('old-1', 'h2:1', 'A one two', 2, 0)),
      record('table-b', candidate('old-2', 'h2:1', 'B three four', 2, 1)),
    ];
    const current = [
      candidate('new-1', 'h2:1', 'A one two', 2, 0),
      candidate('new-2', 'h2:1', 'New five six', 2, 1),
      candidate('new-3', 'h2:1', 'B three four', 2, 2),
    ];

    const matched = matchTableIdentities(previous, current, () => 'table-new');

    expect(matched.map((item) => item.id)).toEqual(['table-a', 'table-b', 'table-new']);
  });

  it('ignores text similarity when assigning identities by heading order', () => {
    const previous = [
      record('table-a', candidate('old-1', 'h2:1', 'shared words', 2, 0)),
      record('table-b', candidate('old-2', 'h2:1', 'shared words', 2, 1)),
    ];
    const current = [
      candidate('new-1', 'h2:1', 'shared words but changed', 2, 0),
      candidate('new-2', 'h2:1', 'shared words but changed too', 2, 1),
    ];

    const matched = matchTableIdentities(previous, current, () => 'table-new');

    expect(matched.map((item) => item.id)).toEqual(['table-a', 'table-b']);
  });

  it('keeps the positional identity when the table column count changes', () => {
    const previous = [
      record('table-a', candidate('old-1', 'h2:1', 'Original', 2, 0)),
    ];
    const current = [
      candidate('new-1', 'h2:1', 'Original with a new column', 3, 0),
    ];

    const matched = matchTableIdentities(previous, current, () => 'table-new');

    expect(matched[0]?.id).toBe('table-a');
  });

  it('uses the group order instead of candidate ordinal metadata', () => {
    const previous = [
      record('table-a', candidate('old-1', 'h2:1', 'First', 2, 9)),
      record('table-b', candidate('old-2', 'h2:1', 'Second', 2, 1)),
    ];
    const current = [
      candidate('new-1', 'h2:1', 'Current first', 2, 99),
      candidate('new-2', 'h2:1', 'Current second', 2, 0),
    ];

    const matched = matchTableIdentities(previous, current, () => 'table-new');

    expect(matched.map((item) => item.id)).toEqual(['table-a', 'table-b']);
  });

  it('keeps identity when table contents change without an insertion', () => {
    const previous = [
      record('table-a', candidate('old-1', 'h2:1', 'Original owner status', 2, 0)),
      record('table-b', candidate('old-2', 'h2:1', 'Build release result', 2, 1)),
    ];
    const current = [
      candidate('new-1', 'h2:1', 'Changed owner status', 2, 0),
      candidate('new-2', 'h2:1', 'Changed release result', 2, 1),
    ];

    const matched = matchTableIdentities(previous, current, () => 'table-new');

    expect(matched.map((item) => item.id)).toEqual(['table-a', 'table-b']);
  });

  it('does not match tables across different heading paths', () => {
    const previous = [
      record('table-a', candidate('old-1', 'h2:1', 'Same content', 2, 0)),
    ];
    const current = [
      candidate('new-1', 'h2:2', 'Same content', 2, 0),
    ];

    const matched = matchTableIdentities(previous, current, () => 'table-new');

    expect(matched[0]?.id).toBe('table-new');
  });
});
