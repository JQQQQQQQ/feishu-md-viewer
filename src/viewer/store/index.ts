import { create } from 'zustand';

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_DEFAULT = 15;
let settingsRevision = 0;

interface ChromeStorageArea {
  get: (keys: string | string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type ContentAlignment = 'left' | 'center';
export type LocalFileRefreshMode = 'prompt' | 'auto';

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
  contentAlignment: ContentAlignment;
  localFileRefreshMode: LocalFileRefreshMode;
  /** 本次阅读会话的设置已完成首次加载，后续不再用旧存储覆盖用户选择。 */
  settingsHydrated: boolean;
}

type PersistedSettings = Omit<SettingsSlice, 'settingsHydrated'>;

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
  setContentAlignment: (alignment: ContentAlignment) => void;
  setLocalFileRefreshMode: (mode: LocalFileRefreshMode) => void;
  loadSettings: () => Promise<void>;
}

export type ViewerStore = DocumentSlice & UISlice & SettingsSlice & Actions;

function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));
}

function currentSettings(state: SettingsSlice): PersistedSettings {
  return {
    theme: state.theme,
    fontSize: state.fontSize,
    tocSmoothScrollEnabled: state.tocSmoothScrollEnabled,
    contentAlignment: state.contentAlignment,
    localFileRefreshMode: state.localFileRefreshMode,
  };
}

async function persistSettings(settings: PersistedSettings): Promise<void> {
  try {
    const storage = getChromeStorage();
    if (storage) await storage.set({ viewerSettings: settings });
  } catch {
    // Storage may not be available in all contexts.
  }
}

function getChromeStorage(): ChromeStorageArea | undefined {
  const runtimeGlobal = globalThis as typeof globalThis & {
    chrome?: { storage?: { local?: ChromeStorageArea } };
  };
  return runtimeGlobal.chrome?.storage?.local;
}

export const useViewerStore = create<ViewerStore>((set, get) => ({
  content: '',
  originalContent: '',

  mode: 'read',
  sidebarOpen: true,

  theme: 'system',
  fontSize: FONT_SIZE_DEFAULT,
  tocSmoothScrollEnabled: true,
  contentAlignment: 'center',
  localFileRefreshMode: 'prompt',
  settingsHydrated: false,

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
    settingsRevision += 1;
    set({ theme, settingsHydrated: true });
    void persistSettings(currentSettings({ ...get(), theme }));
  },

  setFontSize: (size: number) => {
    const fontSize = clampFontSize(size);
    settingsRevision += 1;
    set({ fontSize, settingsHydrated: true });
    void persistSettings(currentSettings({ ...get(), fontSize }));
  },

  increaseFontSize: () => {
    const fontSize = clampFontSize(get().fontSize + 1);
    settingsRevision += 1;
    set({ fontSize, settingsHydrated: true });
    void persistSettings(currentSettings({ ...get(), fontSize }));
  },

  decreaseFontSize: () => {
    const fontSize = clampFontSize(get().fontSize - 1);
    settingsRevision += 1;
    set({ fontSize, settingsHydrated: true });
    void persistSettings(currentSettings({ ...get(), fontSize }));
  },

  setTocSmoothScrollEnabled: (tocSmoothScrollEnabled: boolean) => {
    settingsRevision += 1;
    set({ tocSmoothScrollEnabled, settingsHydrated: true });
    void persistSettings(currentSettings({ ...get(), tocSmoothScrollEnabled }));
  },

  setContentAlignment: (contentAlignment: ContentAlignment) => {
    settingsRevision += 1;
    set({ contentAlignment, settingsHydrated: true });
    void persistSettings(currentSettings({ ...get(), contentAlignment }));
  },

  setLocalFileRefreshMode: (localFileRefreshMode: LocalFileRefreshMode) => {
    settingsRevision += 1;
    set({ localFileRefreshMode, settingsHydrated: true });
    void persistSettings(currentSettings({ ...get(), localFileRefreshMode }));
  },

  loadSettings: async () => {
    if (get().settingsHydrated) return;
    const loadRevision = settingsRevision;
    try {
      const storage = getChromeStorage();
      if (storage) {
        const result = await storage.get('viewerSettings');
        const settings = result['viewerSettings'] as Partial<PersistedSettings> | undefined;
        if (settings) {
          if (settingsRevision !== loadRevision || get().settingsHydrated) return;
          set({
            theme: settings.theme ?? 'system',
            fontSize: clampFontSize(settings.fontSize ?? FONT_SIZE_DEFAULT),
            tocSmoothScrollEnabled: settings.tocSmoothScrollEnabled ?? true,
            contentAlignment: settings.contentAlignment === 'left' ? 'left' : 'center',
            localFileRefreshMode: settings.localFileRefreshMode === 'auto' ? 'auto' : 'prompt',
            // 兼容旧数据：无论存储值为何，都从阅读态启动。
            mode: 'read',
            settingsHydrated: true,
          });
        } else if (settingsRevision === loadRevision && !get().settingsHydrated) {
          set({ settingsHydrated: true });
        }
      }
    } catch {
      // Storage may not be available in all contexts.
    }
  },
}));
