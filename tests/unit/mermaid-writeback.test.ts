import { describe, it, expect } from 'vitest';
import { replaceMermaidBlock } from '@/viewer/utils/mermaid-writeback';

describe('replaceMermaidBlock', () => {
  const docWithTwoBlocks = [
    '# Title',
    '',
    '```mermaid',
    'graph TD',
    '  A-->B',
    '```',
    '',
    'Some text in between.',
    '',
    '```mermaid',
    'sequenceDiagram',
    '  Alice->>Bob: Hello',
    '```',
    '',
    '## Footer',
  ].join('\n');

  it('replaces the first mermaid block (index 0)', () => {
    const newCode = 'graph LR\n  X-->Y';
    const result = replaceMermaidBlock(docWithTwoBlocks, 0, newCode);

    expect(result).toContain('```mermaid\ngraph LR\n  X-->Y\n```');
    // Second block should be untouched
    expect(result).toContain('sequenceDiagram');
    expect(result).toContain('Alice->>Bob: Hello');
  });

  it('replaces the second mermaid block (index 1) leaving first untouched', () => {
    const newCode = 'sequenceDiagram\n  Bob->>Alice: Hi';
    const result = replaceMermaidBlock(docWithTwoBlocks, 1, newCode);

    // First block should be untouched
    expect(result).toContain('graph TD');
    expect(result).toContain('A-->B');
    // Second block should be replaced
    expect(result).toContain('```mermaid\nsequenceDiagram\n  Bob->>Alice: Hi\n```');
    expect(result).not.toContain('Alice->>Bob: Hello');
  });

  it('returns original content if index is out of range', () => {
    const result = replaceMermaidBlock(docWithTwoBlocks, 5, 'new code');
    expect(result).toBe(docWithTwoBlocks);
  });

  it('handles content with no mermaid blocks gracefully', () => {
    const noMermaid = '# Just markdown\n\nSome paragraph.';
    const result = replaceMermaidBlock(noMermaid, 0, 'graph TD\n  A-->B');
    expect(result).toBe(noMermaid);
  });

  it('preserves surrounding markdown content', () => {
    const newCode = 'pie\n  "A": 50\n  "B": 50';
    const result = replaceMermaidBlock(docWithTwoBlocks, 0, newCode);

    // Title preserved
    expect(result).toContain('# Title');
    // Text between blocks preserved
    expect(result).toContain('Some text in between.');
    // Footer preserved
    expect(result).toContain('## Footer');
  });
});
