import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Options } from '@/options/Options';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('在扩展设置页保存正文对齐选择', async () => {
  const set = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({
          viewerSettings: {
            theme: 'light',
            fontSize: 16,
            tocSmoothScrollEnabled: false,
            contentAlignment: 'center',
          },
        }),
        set,
      },
    },
  });

  render(<Options />);

  await waitFor(() => {
    expect(screen.getByLabelText('正文居中')).toBeChecked();
  });
  fireEvent.click(screen.getByLabelText('正文靠左'));

  await waitFor(() => expect(set).toHaveBeenLastCalledWith({
    viewerSettings: {
      theme: 'light',
      fontSize: 16,
      tocSmoothScrollEnabled: false,
      contentAlignment: 'left',
      localFileRefreshMode: 'prompt',
    },
  }));
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('Settings saved');
  });
});

it('在扩展设置页保存本地文件自动刷新选择', async () => {
  const set = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({
          viewerSettings: {
            theme: 'system',
            fontSize: 15,
            tocSmoothScrollEnabled: true,
            contentAlignment: 'center',
            localFileRefreshMode: 'prompt',
          },
        }),
        set,
      },
    },
  });

  render(<Options />);

  await waitFor(() => {
    expect(screen.getByLabelText('提示后手动刷新')).toBeChecked();
  });
  fireEvent.click(screen.getByLabelText('自动刷新'));

  await waitFor(() => expect(set).toHaveBeenLastCalledWith({
    viewerSettings: {
      theme: 'system',
      fontSize: 15,
      tocSmoothScrollEnabled: true,
      contentAlignment: 'center',
      localFileRefreshMode: 'auto',
    },
  }));
});
