import { describe, expect, it } from 'vitest';
import { computeMainOffset } from '@/viewer/components/Layout/AppShell';

describe('AppShell main offset', () => {
  it('keeps main offset equal to sidebar width when space is sufficient', () => {
    expect(computeMainOffset(320, 1600)).toBe(320);
  });

  it('caps main offset when sidebar is too wide', () => {
    expect(computeMainOffset(520, 2200)).toBe(400);
  });

  it('preserves minimum readable area on narrower viewport', () => {
    expect(computeMainOffset(360, 1180)).toBe(200);
  });

  it('falls back to 0 for invalid inputs', () => {
    expect(computeMainOffset(Number.NaN, 1400)).toBe(0);
    expect(computeMainOffset(300, Number.NaN)).toBe(0);
  });
});
