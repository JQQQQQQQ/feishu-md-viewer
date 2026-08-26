import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileAdapter } from '@/content/adapters/file-adapter';

describe('FileAdapter', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'file:///docs/readme.md', pathname: '/docs/readme.md' },
    });
  });

  it('通过重新读取 file URL 获取磁盘上的最新内容', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '# 新内容',
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new FileAdapter();

    await expect(adapter.getFreshContent()).resolves.toBe('# 新内容');
    expect(fetchMock).toHaveBeenCalledWith('file:///docs/readme.md', { cache: 'no-store' });
  });

  it('浏览器拒绝读取本地文件时返回空值', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('blocked')));
    const adapter = new FileAdapter();

    await expect(adapter.getFreshContent()).resolves.toBeNull();
  });

  it('读取到空响应时不把已有预览替换成空文档', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new FileAdapter();

    await expect(adapter.getFreshContent()).resolves.toBeNull();
  });

  it('内容脚本直接读取失败时通过扩展后台读取最新内容', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ content: '# 后台读取的新内容' });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('blocked by file origin')));
    const adapter = new FileAdapter();

    await expect(adapter.getFreshContent()).resolves.toBe('# 后台读取的新内容');
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'READ_FILE_CONTENT',
      url: 'file:///docs/readme.md',
    });
  });
});
