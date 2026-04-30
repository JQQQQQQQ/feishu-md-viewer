import { describe, it, expect, beforeEach } from 'vitest';
import { useViewerStore } from '@/viewer/store/index';

describe('Theme switching & settings', () => {
  beforeEach(() => {
    useViewerStore.setState({
      theme: 'system',
      fontSize: 15,
      autoSaveEnabled: true,
    });
  });

  describe('theme', () => {
    it('has initial theme value of "system"', () => {
      const state = useViewerStore.getState();
      expect(state.theme).toBe('system');
    });

    it('setTheme("dark") updates theme to dark', () => {
      useViewerStore.getState().setTheme('dark');
      expect(useViewerStore.getState().theme).toBe('dark');
    });

    it('setTheme("light") updates theme to light', () => {
      useViewerStore.getState().setTheme('light');
      expect(useViewerStore.getState().theme).toBe('light');
    });

    it('setTheme("system") resets to system', () => {
      useViewerStore.getState().setTheme('dark');
      useViewerStore.getState().setTheme('system');
      expect(useViewerStore.getState().theme).toBe('system');
    });
  });

  describe('fontSize', () => {
    it('setFontSize(18) updates fontSize to 18', () => {
      useViewerStore.getState().setFontSize(18);
      expect(useViewerStore.getState().fontSize).toBe(18);
    });

    it('setFontSize clamps to minimum (12)', () => {
      useViewerStore.getState().setFontSize(8);
      expect(useViewerStore.getState().fontSize).toBe(12);
    });

    it('setFontSize clamps to maximum (24)', () => {
      useViewerStore.getState().setFontSize(30);
      expect(useViewerStore.getState().fontSize).toBe(24);
    });

    it('setFontSize(12) is valid at lower bound', () => {
      useViewerStore.getState().setFontSize(12);
      expect(useViewerStore.getState().fontSize).toBe(12);
    });

    it('setFontSize(24) is valid at upper bound', () => {
      useViewerStore.getState().setFontSize(24);
      expect(useViewerStore.getState().fontSize).toBe(24);
    });

    it('increaseFontSize increments by 1', () => {
      useViewerStore.getState().setFontSize(15);
      useViewerStore.getState().increaseFontSize();
      expect(useViewerStore.getState().fontSize).toBe(16);
    });

    it('decreaseFontSize decrements by 1', () => {
      useViewerStore.getState().setFontSize(15);
      useViewerStore.getState().decreaseFontSize();
      expect(useViewerStore.getState().fontSize).toBe(14);
    });

    it('increaseFontSize does not exceed max', () => {
      useViewerStore.getState().setFontSize(24);
      useViewerStore.getState().increaseFontSize();
      expect(useViewerStore.getState().fontSize).toBe(24);
    });

    it('decreaseFontSize does not go below min', () => {
      useViewerStore.getState().setFontSize(12);
      useViewerStore.getState().decreaseFontSize();
      expect(useViewerStore.getState().fontSize).toBe(12);
    });
  });
});
