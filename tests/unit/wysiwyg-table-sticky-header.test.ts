import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/wysiwyg.css'),
  'utf-8',
);

const normalized = stylesheet.replace(/\s+/g, ' ');

describe('wysiwyg table sticky header styles', () => {
  it('keeps table headers sticky with top offset in editor mode', () => {
    expect(normalized).toMatch(
      /\.feishu-wysiwyg__editor th\s*\{[^}]*position:\s*sticky;[^}]*top:\s*calc\(var\(--feishu-topbar-height,\s*56px\)\s*\+\s*3px\);/i,
    );
  });

  it('sets thead stacking context to keep sticky headers above table body', () => {
    expect(normalized).toMatch(
      /\.feishu-wysiwyg__editor thead\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*4;/i,
    );
  });

  it('does not reintroduce clipping on editor tables that breaks sticky behavior', () => {
    expect(normalized).not.toMatch(
      /\.feishu-wysiwyg__editor table\s*\{[^}]*overflow:\s*hidden;/i,
    );
    expect(normalized).not.toMatch(
      /\.feishu-wysiwyg__editor table\s*\{[^}]*clip-path:\s*inset\(/i,
    );
  });

  it('avoids resetting table header position back to relative', () => {
    expect(normalized).not.toMatch(
      /\.feishu-wysiwyg__editor table td,\s*\.feishu-wysiwyg__editor table th\s*\{[^}]*position:\s*relative;/i,
    );
  });
});
