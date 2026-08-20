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
    },
  }));
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('Settings saved');
  });
});
