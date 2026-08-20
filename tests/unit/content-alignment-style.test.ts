import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const stylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/markdown.css'),
  'utf8',
).replace(/\s+/g, ' ');

it('keeps the same desktop reading width while switching between left and centered content', () => {
  expect(stylesheet).toMatch(/@media \(min-width: 1024px\)\s*\{\s*\.feishu-viewer__content\s*\{[^}]*max-width:\s*980px/);
  expect(stylesheet).toMatch(/@media \(min-width: 769px\)\s*\{\s*\.feishu-viewer--content-left \.feishu-viewer__content\s*\{[^}]*margin-left:\s*clamp\(24px, 2\.8vw, 72px\)/);
});

it('includes reading-column padding in its width so centered mode has visible free space', () => {
  expect(stylesheet).toMatch(/\.feishu-viewer__content\s*\{[^}]*box-sizing:\s*border-box/);
});
