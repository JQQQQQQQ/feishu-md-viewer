import { create } from 'zustand';

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_DEFAULT = 15;

export type ThemeMode = 'light' | 'dark' | 'system';

interface DocumentSlice {
  content: string;
  originalContent: string;
}

interface UISlice {
  /**
   * 仅为兼容旧的持久化状态和仍会在 Task 3 删除的编辑器模块保留。
   * 预览版不会写入 edit/source，也不会据此选择渲染分支。
   */
  mode: 'read';
  sidebarOpen: boolean;
}

interface SettingsSlice {
  theme: ThemeMode;
  fontSize: number;
  tocSmoothScrollEnabled: boolean;
}

interface Actions {
  initDocument: (content: string) => void;
  setContent: (content: string) => void;
  setMode: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  setTocSmoothScrollEnabled: (enabled: boolean) => void;
  loadSettings: () => Promise<void>;
}

export type ViewerStore = DocumentSlice & UISlice & SettingsSlice & Actions;

function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));
}

function currentSettings(state: SettingsSlice): SettingsSlice {
  return {
    theme: state.theme,
    fontSize: state.fontSize,
    tocSmoothScrollEnabled: state.tocSmoothScrollEnabled,
  };
}

async function persistSettings(settings: SettingsSlice): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ viewerSettings: settings });
    }
  } catch {
    // Storage may not be available in all contexts.
  }
}

export const useViewerStore = create<ViewerStore>((set, get) => ({
  content: '',
  originalContent: '',

  mode: 'read',
  sidebarOpen: true,

  theme: 'system',
  fontSize: FONT_SIZE_DEFAULT,
  tocSmoothScrollEnabled: true,

  initDocument: (content: string) => {
    set({ content, originalContent: content, mode: 'read' });
  },

  // 该兼容 action 会在编辑器模块删除后移除；阅读入口不会调用它。
  setContent: (content: string) => {
    set({ content });
  },

  setMode: () => {
    set({ mode: 'read' });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (sidebarOpen: boolean) => {
    set({ sidebarOpen });
  },

  setTheme: (theme: ThemeMode) => {
    set({ theme });
    void persistSettings(currentSettings({ ...get(), theme }));
  },

  setFontSize: (size: number) => {
    const fontSize = clampFontSize(size);
    set({ fontSize });
    void persistSettings(currentSettings({ ...get(), fontSize }));
  },

  increaseFontSize: () => {
    const fontSize = clampFontSize(get().fontSize + 1);
    set({ fontSize });
    void persistSettings(currentSettings({ ...get(), fontSize }));
  },

  decreaseFontSize: () => {
    const fontSize = clampFontSize(get().fontSize - 1);
    set({ fontSize });
    void persistSettings(currentSettings({ ...get(), fontSize }));
  },

  setTocSmoothScrollEnabled: (tocSmoothScrollEnabled: boolean) => {
    set({ tocSmoothScrollEnabled });
    void persistSettings(currentSettings({ ...get(), tocSmoothScrollEnabled }));
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
            tocSmoothScrollEnabled: settings.tocSmoothScrollEnabled ?? true,
            // 兼容旧数据：无论存储值为何，都从阅读态启动。
            mode: 'read',
          });
        }
      }
    } catch {
      // Storage may not be available in all contexts.
    }
  },
}));
