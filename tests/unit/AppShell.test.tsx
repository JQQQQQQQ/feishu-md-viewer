import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/viewer/components/Layout/AppShell';

describe('AppShell 响应式目录状态', () => {
  beforeEach(() => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Webview 隐藏期间短暂进入抽屉模式后恢复桌面时仍保留目录', () => {
    let mediaHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_type: string, handler: (event: MediaQueryListEvent) => void) => {
        mediaHandler = handler;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => media,
    });
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    try {
      render(<AppShell title="测试" tocItems={[]}><p>正文</p></AppShell>);
      const navigation = screen.getByLabelText('Document navigation');
      expect(navigation).toHaveAttribute('aria-hidden', 'false');

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => mediaHandler?.({ matches: true } as MediaQueryListEvent));
      expect(navigation).toHaveAttribute('aria-hidden', 'false');

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      act(() => mediaHandler?.({ matches: false } as MediaQueryListEvent));

      expect(navigation).toHaveAttribute('aria-hidden', 'false');
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', originalVisibility);
      } else {
        delete (document as { visibilityState?: unknown }).visibilityState;
      }
    }
  });

  it('Webview 恢复首帧短暂报告窄屏时不会闪入抽屉模式', () => {
    const frames: FrameRequestCallback[] = [];
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => media,
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    try {
      render(<AppShell title="测试" tocItems={[]}><p>正文</p></AppShell>);
      const navigation = screen.getByLabelText('Document navigation');
      expect(navigation).toHaveAttribute('aria-hidden', 'false');

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => document.dispatchEvent(new Event('visibilitychange')));

      media.matches = true;
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(navigation).toHaveAttribute('aria-hidden', 'false');

      act(() => frames.shift()?.(0));
      expect(navigation).toHaveAttribute('aria-hidden', 'false');

      media.matches = false;
      act(() => frames.shift()?.(16));
      expect(navigation).toHaveAttribute('aria-hidden', 'false');
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', originalVisibility);
      } else {
        delete (document as { visibilityState?: unknown }).visibilityState;
      }
    }
  });

  it('visibilityState 仍为 visible 时也忽略失焦期间的临时窄屏结果', () => {
    let mediaHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const frames: FrameRequestCallback[] = [];
    const media = {
      matches: false,
      addEventListener: vi.fn((_type: string, handler: (event: MediaQueryListEvent) => void) => {
        mediaHandler = handler;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => media,
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

    render(<AppShell title="测试" tocItems={[]}><p>正文</p></AppShell>);
    const navigation = screen.getByLabelText('Document navigation');
    expect(navigation).toHaveAttribute('aria-hidden', 'false');

    act(() => window.dispatchEvent(new Event('blur')));
    media.matches = true;
    act(() => mediaHandler?.({ matches: true } as MediaQueryListEvent));
    expect(navigation).toHaveAttribute('aria-hidden', 'false');
    expect(navigation).not.toHaveClass('feishu-sidebar--collapsed');

    media.matches = false;
    act(() => window.dispatchEvent(new Event('focus')));
    act(() => frames.shift()?.(0));
    act(() => frames.shift()?.(16));

    expect(navigation).toHaveAttribute('aria-hidden', 'false');
    expect(navigation).not.toHaveClass('feishu-sidebar--collapsed');
  });

  it('VS Code 未发送 blur 时根据 document.hasFocus 拒绝后台媒体查询', () => {
    let mediaHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const frames: FrameRequestCallback[] = [];
    const media = {
      matches: false,
      addEventListener: vi.fn((_type: string, handler: (event: MediaQueryListEvent) => void) => {
        mediaHandler = handler;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => media,
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1413 });
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1398 });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    render(<AppShell title="测试" tocItems={[]}><p>正文</p></AppShell>);
    const navigation = screen.getByLabelText('Document navigation');
    expect(navigation).toHaveAttribute('aria-hidden', 'false');

    vi.mocked(document.hasFocus).mockReturnValue(false);
    media.matches = true;
    act(() => mediaHandler?.({ matches: true } as MediaQueryListEvent));
    expect(navigation).toHaveAttribute('aria-hidden', 'false');
    expect(navigation).not.toHaveClass('feishu-sidebar--collapsed');

    vi.mocked(document.hasFocus).mockReturnValue(true);
    media.matches = false;
    act(() => window.dispatchEvent(new Event('focus')));
    act(() => frames.shift()?.(0));
    act(() => frames.shift()?.(16));

    expect(navigation).toHaveAttribute('aria-hidden', 'false');
    expect(navigation).not.toHaveClass('feishu-sidebar--collapsed');
  });

  it('表格离开垂直可视范围后清除左移触发的目录隐藏状态', () => {
    render(<AppShell title="测试" tocItems={[]}><p>正文</p></AppShell>);
    const navigation = screen.getByLabelText('Document navigation');
    const main = document.querySelector('.feishu-app-shell__main');
    expect(main).toBeInstanceOf(HTMLElement);
    if (!(main instanceof HTMLElement)) return;

    act(() => {
      main.dispatchEvent(new CustomEvent('feishu-table-horizontal-scroll', {
        bubbles: true,
        detail: { scrollLeft: 24 },
      }));
    });
    expect(navigation).toHaveAttribute('aria-hidden', 'true');
    expect(navigation).toHaveClass('feishu-sidebar--table-scrolling');

    act(() => {
      main.dispatchEvent(new CustomEvent('feishu-table-horizontal-scroll', {
        bubbles: true,
        detail: { scrollLeft: 0 },
      }));
    });
    expect(navigation).toHaveAttribute('aria-hidden', 'false');
    expect(navigation).not.toHaveClass('feishu-sidebar--table-scrolling');
  });
});
