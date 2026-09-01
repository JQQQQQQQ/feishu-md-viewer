import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewerStore } from '@/viewer/store/index';

describe('预览版 ViewerStore', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      storage: {
        local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
      },
    });
    useViewerStore.setState({
      content: '',
      originalContent: '',
      mode: 'read',
      theme: 'system',
      fontSize: 15,
      tocFontSize: 13,
      tocSmoothScrollEnabled: true,
      sidebarDividerVisible: true,
      contentAlignment: 'center',
      localFileRefreshMode: 'prompt',
      settingsHydrated: false,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('加载遗留 edit/source 模式设置后归一化为 read', async () => {
    const get = vi.fn().mockResolvedValue({ viewerSettings: { mode: 'edit', theme: 'dark' } });
    vi.stubGlobal('chrome', { storage: { local: { get, set: vi.fn() } } });

    await useViewerStore.getState().loadSettings();

    expect(useViewerStore.getState().mode).toBe('read');
    expect(useViewerStore.getState().theme).toBe('dark');
  });

  it('持久化阅读设置时保留正文对齐且不写入自动保存或编辑锁定选项', () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(), set } } });

    useViewerStore.getState().setTheme('dark');

    expect(set).toHaveBeenCalledWith({
      viewerSettings: {
        theme: 'dark',
        fontSize: 15,
        tocFontSize: 13,
        tocSmoothScrollEnabled: true,
        sidebarDividerVisible: true,
        contentAlignment: 'center',
        localFileRefreshMode: 'prompt',
      },
    });
  });

  it('保留主题、字号、目录滚动和正文对齐设置', () => {
    useViewerStore.getState().setFontSize(30);
    useViewerStore.getState().setTocSmoothScrollEnabled(false);

    expect(useViewerStore.getState().fontSize).toBe(24);
    expect(useViewerStore.getState().tocSmoothScrollEnabled).toBe(false);
    expect(useViewerStore.getState().contentAlignment).toBe('center');
  });

  it('用户切换正文对齐后，不会被随后读取到的旧设置覆盖', async () => {
    const get = vi.fn().mockResolvedValue({
      viewerSettings: { theme: 'light', contentAlignment: 'left' },
    });
    vi.stubGlobal('chrome', { storage: { local: { get, set: vi.fn() } } });

    await useViewerStore.getState().loadSettings();
    expect(useViewerStore.getState().contentAlignment).toBe('left');

    useViewerStore.getState().setContentAlignment('center');
    await useViewerStore.getState().loadSettings();

    expect(useViewerStore.getState().contentAlignment).toBe('center');
  });

  it('持久化本地文件更新方式并兼容未知值', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({
      viewerSettings: { localFileRefreshMode: 'auto' },
    });
    vi.stubGlobal('chrome', { storage: { local: { get, set } } });

    await useViewerStore.getState().loadSettings();
    expect(useViewerStore.getState().localFileRefreshMode).toBe('auto');

    useViewerStore.getState().setLocalFileRefreshMode('prompt');
    expect(set).toHaveBeenLastCalledWith({
      viewerSettings: {
        theme: 'system',
        fontSize: 15,
        tocFontSize: 13,
        tocSmoothScrollEnabled: true,
        sidebarDividerVisible: true,
        contentAlignment: 'center',
        localFileRefreshMode: 'prompt',
      },
    });
  });

  it('持久化目录与正文分隔线显示设置', () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(), set } } });

    useViewerStore.getState().setSidebarDividerVisible(false);

    expect(useViewerStore.getState().sidebarDividerVisible).toBe(false);
    expect(set).toHaveBeenCalledWith({
      viewerSettings: {
        theme: 'system',
        fontSize: 15,
        tocFontSize: 13,
        tocSmoothScrollEnabled: true,
        sidebarDividerVisible: false,
        contentAlignment: 'center',
        localFileRefreshMode: 'prompt',
      },
    });
  });

  it('限制目录字号范围并持久化统一阅读设置', () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(), set } } });

    useViewerStore.getState().setTocFontSize(30);

    expect(useViewerStore.getState().tocFontSize).toBe(20);
    expect(set).toHaveBeenCalledWith({
      viewerSettings: {
        theme: 'system',
        fontSize: 15,
        tocFontSize: 20,
        tocSmoothScrollEnabled: true,
        sidebarDividerVisible: true,
        contentAlignment: 'center',
        localFileRefreshMode: 'prompt',
      },
    });
  });
});
