import { create } from 'zustand';

const MAX_HISTORY = 50;
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_DEFAULT = 15;

type EditorMode = 'read' | 'edit';
export type ThemeMode = 'light' | 'dark' | 'system';

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

interface SettingsSlice {
  theme: ThemeMode;
  fontSize: number;
  autoSaveEnabled: boolean;
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
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  loadSettings: () => Promise<void>;
}

export type ViewerStore = DocumentSlice & EditorSlice & UISlice & SettingsSlice & Actions;

function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));
}

async function persistSettings(settings: Partial<SettingsSlice>): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ viewerSettings: settings });
    }
  } catch {
    // Storage may not be available in all contexts
  }
}

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

  // Settings slice
  theme: 'system',
  fontSize: FONT_SIZE_DEFAULT,
  autoSaveEnabled: true,

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

  setTheme: (theme: ThemeMode) => {
    set({ theme });
    void persistSettings({ theme, fontSize: get().fontSize, autoSaveEnabled: get().autoSaveEnabled });
  },

  setFontSize: (size: number) => {
    const clamped = clampFontSize(size);
    set({ fontSize: clamped });
    void persistSettings({ theme: get().theme, fontSize: clamped, autoSaveEnabled: get().autoSaveEnabled });
  },

  increaseFontSize: () => {
    const state = get();
    const newSize = clampFontSize(state.fontSize + 1);
    set({ fontSize: newSize });
    void persistSettings({ theme: state.theme, fontSize: newSize, autoSaveEnabled: state.autoSaveEnabled });
  },

  decreaseFontSize: () => {
    const state = get();
    const newSize = clampFontSize(state.fontSize - 1);
    set({ fontSize: newSize });
    void persistSettings({ theme: state.theme, fontSize: newSize, autoSaveEnabled: state.autoSaveEnabled });
  },

  setAutoSaveEnabled: (enabled: boolean) => {
    set({ autoSaveEnabled: enabled });
    void persistSettings({ theme: get().theme, fontSize: get().fontSize, autoSaveEnabled: enabled });
  },

  loadSettings: async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get('viewerSettings');
        const settings = result['viewerSettings'] as Partial<SettingsSlice> | undefined;
        if (settings) {
          set({
            theme: settings.theme ?? 'system',
            fontSize: clampFontSize(settings.fontSize ?? FONT_SIZE_DEFAULT),
            autoSaveEnabled: settings.autoSaveEnabled ?? true,
          });
        }
      }
    } catch {
      // Storage may not be available
    }
  },
}));
