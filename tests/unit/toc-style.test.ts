import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const stylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/layout.css'),
  'utf8',
).replace(/\s+/g, ' ');

describe('table of contents styles', () => {
  it('keeps major headings bold while they are active', () => {
    expect(stylesheet).toMatch(/\.feishu-toc__link--active\.feishu-toc__link--major\s*\{[^}]*font-weight:\s*600/);
  });
});
