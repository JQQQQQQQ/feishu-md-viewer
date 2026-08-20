import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewerStore } from '@/viewer/store/index';

describe('预览版 ViewerStore', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      storage: { local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) } },
    });
    useViewerStore.setState({
      content: '',
      originalContent: '',
      mode: 'read',
      theme: 'system',
      fontSize: 15,
      tocSmoothScrollEnabled: true,
      contentAlignment: 'center',
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
        tocSmoothScrollEnabled: true,
        contentAlignment: 'center',
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
});
