import { describe, expect, it } from 'vitest';
import { computeMainOffset, resolveSidebarToggleState, shouldHideSidebarForTableScroll } from '@/viewer/components/Layout/AppShell';

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

  it('hides the sidebar only after the table has moved horizontally', () => {
    expect(shouldHideSidebarForTableScroll(0)).toBe(false);
    expect(shouldHideSidebarForTableScroll(8)).toBe(false);
    expect(shouldHideSidebarForTableScroll(9)).toBe(true);
    expect(shouldHideSidebarForTableScroll(Number.NaN)).toBe(false);
  });

  it('uses the existing topbar toggle to restore a table-hidden sidebar before toggling it', () => {
    expect(resolveSidebarToggleState(true, true)).toEqual({
      sidebarOpen: true,
      tableScrollHidden: false,
    });
    expect(resolveSidebarToggleState(true, false)).toEqual({
      sidebarOpen: false,
      tableScrollHidden: false,
    });
  });

  it('keeps the normal content offset independent from table sidebar hiding', () => {
    expect(computeMainOffset(260, 1440)).toBe(260);
  });

  it('uses the same main offset while a table temporarily hides the sidebar', () => {
    expect(computeMainOffset(320, 1600)).toBe(320);
  });
});
