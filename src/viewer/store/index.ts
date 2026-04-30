import { create } from 'zustand';

const MAX_HISTORY = 50;

type EditorMode = 'read' | 'edit';

interface DocumentSlice {
  content: string;
  originalContent: string;
  isDirty: boolean;
}

interface EditorSlice {
  mode: EditorMode;
  history: string[];
  historyIndex: number;
}

interface UISlice {
  sidebarOpen: boolean;
}

interface Actions {
  setContent: (content: string) => void;
  setMode: (mode: EditorMode) => void;
  undo: () => void;
  redo: () => void;
  resetDocument: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  initDocument: (content: string) => void;
}

export type ViewerStore = DocumentSlice & EditorSlice & UISlice & Actions;

export const useViewerStore = create<ViewerStore>((set, get) => ({
  // Document slice
  content: '',
  originalContent: '',
  isDirty: false,

  // Editor slice
  mode: 'read',
  history: [],
  historyIndex: -1,

  // UI slice
  sidebarOpen: true,

  // Actions
  initDocument: (content: string) => {
    set({
      content,
      originalContent: content,
      isDirty: false,
      history: [content],
      historyIndex: 0,
    });
  },

  setContent: (content: string) => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(content);

    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    set({
      content,
      isDirty: content !== state.originalContent,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  setMode: (mode: EditorMode) => {
    set({ mode });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;

    const newIndex = state.historyIndex - 1;
    const content = state.history[newIndex];
    if (content === undefined) return;

    set({
      content,
      historyIndex: newIndex,
      isDirty: content !== state.originalContent,
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;

    const newIndex = state.historyIndex + 1;
    const content = state.history[newIndex];
    if (content === undefined) return;

    set({
      content,
      historyIndex: newIndex,
      isDirty: content !== state.originalContent,
    });
  },

  resetDocument: () => {
    const state = get();
    set({
      content: state.originalContent,
      isDirty: false,
      history: [state.originalContent],
      historyIndex: 0,
    });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },
}));
