import { describe, expect, it } from 'vitest';
import { getViewerSettingsSyncPatch } from '@/content/settings-sync';

describe('阅读页设置跨上下文同步', () => {
  it('同步扩展设置页关闭目录分隔线的变更', () => {
    expect(getViewerSettingsSyncPatch({
      localFileRefreshMode: 'auto',
      sidebarDividerVisible: false,
    })).toEqual({
      localFileRefreshMode: 'auto',
      sidebarDividerVisible: false,
    });
  });

  it('无相关设置变更时不覆盖阅读页当前状态', () => {
    expect(getViewerSettingsSyncPatch({ theme: 'dark' })).toEqual({});
  });
});
