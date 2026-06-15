import { describe, it, expect } from 'vitest';
import { createHeadingId, createUniqueHeadingIdFactory } from '@/viewer/utils/heading-slug';

describe('heading-slug', () => {
  it('creates normalized heading ids', () => {
    expect(createHeadingId('Hello, World!')).toBe('hello-world');
    expect(createHeadingId('中文 标题 Test')).toBe('中文-标题-test');
  });

  it('creates unique heading ids in sequence', () => {
    const nextId = createUniqueHeadingIdFactory();
    expect(nextId('Repeat')).toBe('repeat');
    expect(nextId('Repeat')).toBe('repeat-2');
    expect(nextId('Repeat')).toBe('repeat-3');
  });

  it('falls back to section for symbol-only headings', () => {
    const nextId = createUniqueHeadingIdFactory();
    expect(nextId('!!!')).toBe('section');
    expect(nextId('!!!')).toBe('section-2');
  });
});
