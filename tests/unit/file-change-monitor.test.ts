import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLocalFileChangeMonitor } from '@/content/file-change-monitor';

describe('createLocalFileChangeMonitor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('只在本地文件内容变化后通知一次', async () => {
    vi.useFakeTimers();
    const readCurrent = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('初始内容')
      .mockResolvedValue('新内容');
    const onChanged = vi.fn();
    const monitor = createLocalFileChangeMonitor({
      initialContent: '初始内容',
      readCurrent,
      onChanged,
      intervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChanged).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledWith('新内容');

    await vi.advanceTimersByTimeAsync(3000);
    expect(onChanged).toHaveBeenCalledTimes(1);
    monitor.stop();
  });

  it('刷新完成后可以用新内容作为比较基线继续监听', async () => {
    vi.useFakeTimers();
    const readCurrent = vi.fn<() => Promise<string | null>>().mockResolvedValue('版本 2');
    const onChanged = vi.fn();
    const monitor = createLocalFileChangeMonitor({
      initialContent: '版本 1',
      readCurrent,
      onChanged,
      intervalMs: 500,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(onChanged).toHaveBeenCalledTimes(1);

    monitor.setBaseline('版本 2');
    await vi.advanceTimersByTimeAsync(500);
    expect(onChanged).toHaveBeenCalledTimes(1);

    readCurrent.mockResolvedValue('版本 3');
    await vi.advanceTimersByTimeAsync(500);
    expect(onChanged).toHaveBeenCalledTimes(2);
    expect(onChanged).toHaveBeenLastCalledWith('版本 3');
    monitor.stop();
  });

  it('读取失败或返回空内容时不会打断监听', async () => {
    vi.useFakeTimers();
    const readCurrent = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('新内容');
    const onChanged = vi.fn();
    const monitor = createLocalFileChangeMonitor({
      initialContent: '初始内容',
      readCurrent,
      onChanged,
      intervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledWith('新内容');
    monitor.stop();
  });
});
