import { describe, expect, it, vi } from 'vitest';

import { readLocalFileContent } from '@/background/file-content-reader';

describe('readLocalFileContent', () => {
  it('只读取 file:// Markdown 地址并返回文本', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '# 内容' });

    await expect(readLocalFileContent('file:///docs/readme.md', fetchMock)).resolves.toBe('# 内容');
    expect(fetchMock).toHaveBeenCalledWith('file:///docs/readme.md', { cache: 'no-store' });
  });

  it('拒绝非本地文件或读取失败', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('blocked'));

    await expect(readLocalFileContent('https://example.com/readme.md', fetchMock)).resolves.toBeNull();
    await expect(readLocalFileContent('file:///docs/readme.md', fetchMock)).resolves.toBeNull();
  });
});
