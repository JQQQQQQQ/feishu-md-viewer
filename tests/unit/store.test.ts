import { describe, it, expect, beforeEach } from 'vitest';
import { useViewerStore } from '@/viewer/store/index';

describe('Zustand ViewerStore', () => {
  beforeEach(() => {
    // Reset the store to a clean state before each test
    useViewerStore.setState({
      content: '',
      originalContent: '',
      isDirty: false,
      mode: 'read',
      history: [],
      historyIndex: -1,
      sidebarOpen: true,
    });
  });

  describe('initDocument', () => {
    it('sets content and originalContent, marks isDirty=false', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('# Hello World');

      const state = useViewerStore.getState();
      expect(state.content).toBe('# Hello World');
      expect(state.originalContent).toBe('# Hello World');
      expect(state.isDirty).toBe(false);
    });
  });

  describe('setContent', () => {
    it('updates content and marks isDirty=true', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('original');

      const { setContent } = useViewerStore.getState();
      setContent('modified');

      const state = useViewerStore.getState();
      expect(state.content).toBe('modified');
      expect(state.isDirty).toBe(true);
    });

    it('pushes to history', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('v1');

      const { setContent } = useViewerStore.getState();
      setContent('v2');

      const state = useViewerStore.getState();
      expect(state.history).toEqual(['v1', 'v2']);
      expect(state.historyIndex).toBe(1);
    });
  });

  describe('undo', () => {
    it('reverts to previous content', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('v1');

      useViewerStore.getState().setContent('v2');
      useViewerStore.getState().undo();

      const state = useViewerStore.getState();
      expect(state.content).toBe('v1');
      expect(state.historyIndex).toBe(0);
    });

    it('at beginning of history does nothing', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('v1');

      useViewerStore.getState().undo();

      const state = useViewerStore.getState();
      expect(state.content).toBe('v1');
      expect(state.historyIndex).toBe(0);
    });
  });

  describe('redo', () => {
    it('restores undone content', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('v1');

      useViewerStore.getState().setContent('v2');
      useViewerStore.getState().undo();
      useViewerStore.getState().redo();

      const state = useViewerStore.getState();
      expect(state.content).toBe('v2');
      expect(state.historyIndex).toBe(1);
    });

    it('at end of history does nothing', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('v1');

      useViewerStore.getState().setContent('v2');
      useViewerStore.getState().redo();

      const state = useViewerStore.getState();
      expect(state.content).toBe('v2');
      expect(state.historyIndex).toBe(1);
    });
  });

  describe('history cap', () => {
    it('is capped at 50 entries', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('v0');

      // Push 55 more entries (total would be 56 without cap)
      for (let i = 1; i <= 55; i++) {
        useViewerStore.getState().setContent(`v${i}`);
      }

      const state = useViewerStore.getState();
      expect(state.history.length).toBe(50);
      // The latest content should still be accessible
      expect(state.content).toBe('v55');
    });
  });

  describe('setMode', () => {
    it('switches between read and edit', () => {
      const { setMode } = useViewerStore.getState();

      setMode('edit');
      expect(useViewerStore.getState().mode).toBe('edit');

      setMode('read');
      expect(useViewerStore.getState().mode).toBe('read');
    });
  });

  describe('resetDocument', () => {
    it('restores originalContent and clears dirty flag', () => {
      const { initDocument } = useViewerStore.getState();
      initDocument('original content');

      useViewerStore.getState().setContent('modified content');
      expect(useViewerStore.getState().isDirty).toBe(true);

      useViewerStore.getState().resetDocument();

      const state = useViewerStore.getState();
      expect(state.content).toBe('original content');
      expect(state.isDirty).toBe(false);
      expect(state.history).toEqual(['original content']);
      expect(state.historyIndex).toBe(0);
    });
  });
});
