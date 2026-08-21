import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createWebviewHtml } from '../src/MarkdownPreviewProvider';
import { WebviewPreview } from '../webview/entry';

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage: ReturnType<typeof vi.fn> };
  }
}

const postMessage = vi.fn();

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (base: { toString(): string }, ...segments: string[]) => ({
      toString: () => `${base.toString()}/${segments.join('/')}`,
    }),
  },
}));

function sendWebviewMessage(message: unknown): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: message }));
  });
}

async function mountWebview(): Promise<void> {
  render(<WebviewPreview />);
}

describe('VS Code Webview preview', () => {
  beforeEach(() => {
    postMessage.mockReset();
    window.acquireVsCodeApi = () => ({ postMessage });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete window.acquireVsCodeApi;
  });

  it('挂载后只发送一次 ready 握手', async () => {
    await mountWebview();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });
  });

  it('收到 document 消息后渲染 Markdown', async () => {
    await mountWebview();

    sendWebviewMessage({ type: 'document', text: '# Webview 标题', version: 1 });

    expect(await screen.findByRole('heading', { name: 'Webview 标题' })).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAttribute('data-mode', 'read');
  });

  it('阅读态提供主题、字号和目录滚动设置', async () => {
    await mountWebview();
    sendWebviewMessage({ type: 'document', text: '# 设置入口', version: 1 });

    expect(await screen.findByRole('heading', { name: '设置入口' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Theme:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /TOC scroll:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease font size' })).toBeInTheDocument();
  });

  it('忽略版本未递增的 document 消息', async () => {
    await mountWebview();

    sendWebviewMessage({ type: 'document', text: '# 新版本', version: 2 });
    expect(await screen.findByRole('heading', { name: '新版本' })).toBeInTheDocument();

    sendWebviewMessage({ type: 'document', text: '# 旧版本', version: 1 });

    expect(screen.getByRole('heading', { name: '新版本' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '旧版本' })).not.toBeInTheDocument();
  });

  it('忽略非有限、负数或非整数的 document 版本', async () => {
    await mountWebview();
    sendWebviewMessage({ type: 'document', text: '# 有效版本', version: 2 });
    expect(await screen.findByRole('heading', { name: '有效版本' })).toBeInTheDocument();

    for (const version of [Number.NaN, Number.POSITIVE_INFINITY, -1, 2.5]) {
      sendWebviewMessage({ type: 'document', text: '# 非法版本', version });
    }

    expect(screen.getByRole('heading', { name: '有效版本' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '非法版本' })).not.toBeInTheDocument();
  });

  it('在尚未收到文档时显示空态', async () => {
    await mountWebview();

    expect(screen.getByText('正在等待 Markdown 文档…')).toBeInTheDocument();
  });

  it.each([
    ['light', false],
    ['dark', true],
  ] as const)('收到 %s 主题消息后更新预览根类名', async (kind, expectsDarkClass) => {
    await mountWebview();
    sendWebviewMessage({ type: 'document', text: '# 主题', version: 1 });
    await screen.findByRole('heading', { name: '主题' });

    sendWebviewMessage({ type: 'theme', kind });

    expect(screen.getByRole('article').classList.contains('feishu-viewer--dark')).toBe(expectsDarkClass);
    expect(document.documentElement).toHaveAttribute('data-feishu-vscode-theme', kind);
    if (!expectsDarkClass) {
      expect(screen.getByRole('article')).toHaveClass('feishu-viewer--light');
    }
  });

  it('标签恢复时用加载层遮住两个渲染帧', async () => {
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const animationFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    const flushAnimationFrame = (timestamp: number) => {
      const callbacks = animationFrames.splice(0);
      act(() => callbacks.forEach((callback) => callback(timestamp)));
    };

    try {
      await mountWebview();
      sendWebviewMessage({ type: 'document', text: '# 保持目录状态', version: 1 });
      const overlay = screen.getByTestId('vscode-resume-overlay');

      expect(overlay).not.toHaveClass('feishu-vscode-resume-overlay--visible');

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      fireEvent(document, new Event('visibilitychange'));
      expect(overlay).toHaveClass('feishu-vscode-resume-overlay--visible');

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      fireEvent(document, new Event('visibilitychange'));
      expect(overlay).toHaveClass('feishu-vscode-resume-overlay--visible');

      flushAnimationFrame(1);
      expect(overlay).toHaveClass('feishu-vscode-resume-overlay--visible');

      flushAnimationFrame(2);
      expect(overlay).not.toHaveClass('feishu-vscode-resume-overlay--visible');
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', originalVisibility);
      } else {
        delete (document as { visibilityState?: unknown }).visibilityState;
      }
    }
  });

  it('VS Code 仅触发窗口 blur/focus 时也显示恢复加载层', async () => {
    const animationFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    const flushAnimationFrame = (timestamp: number) => {
      const callbacks = animationFrames.splice(0);
      act(() => callbacks.forEach((callback) => callback(timestamp)));
    };

    await mountWebview();
    sendWebviewMessage({ type: 'document', text: '# 窗口切换', version: 1 });
    const overlay = screen.getByTestId('vscode-resume-overlay');

    fireEvent(window, new Event('blur'));
    expect(overlay).toHaveClass('feishu-vscode-resume-overlay--visible');

    fireEvent(window, new Event('focus'));
    flushAnimationFrame(1);
    flushAnimationFrame(2);

    expect(overlay).not.toHaveClass('feishu-vscode-resume-overlay--visible');
  });

  it('blur 后没有收到 focus 时也会自动结束恢复状态', async () => {
    vi.useFakeTimers();

    try {
      await mountWebview();
      sendWebviewMessage({ type: 'document', text: '# 无 focus 回调', version: 1 });
      const overlay = screen.getByTestId('vscode-resume-overlay');

      fireEvent(window, new Event('blur'));
      expect(overlay).toHaveClass('feishu-vscode-resume-overlay--visible');

      act(() => vi.advanceTimersByTime(1000));

      expect(overlay).not.toHaveClass('feishu-vscode-resume-overlay--visible');
    } finally {
      vi.useRealTimers();
    }
  });

  it('连续隐藏时旧的恢复帧不能提前关闭加载层', async () => {
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const animationFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    const flushAnimationFrame = (timestamp: number) => {
      const callbacks = animationFrames.splice(0);
      act(() => callbacks.forEach((callback) => callback(timestamp)));
    };

    try {
      await mountWebview();
      sendWebviewMessage({ type: 'document', text: '# 连续切换', version: 1 });
      const overlay = screen.getByTestId('vscode-resume-overlay');

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      fireEvent(document, new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      fireEvent(document, new Event('visibilitychange'));
      flushAnimationFrame(1);

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      fireEvent(document, new Event('visibilitychange'));
      flushAnimationFrame(2);

      expect(overlay).toHaveClass('feishu-vscode-resume-overlay--visible');
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', originalVisibility);
      } else {
        delete (document as { visibilityState?: unknown }).visibilityState;
      }
    }
  });

  it('仅将 VS Code 转换后的本地脚本和样式 URI 写入严格 CSP', () => {
    const html = createWebviewHtml({
      cspSource: 'vscode-webview://preview',
      asWebviewUri: vi.fn((resource: { toString(): string }) => ({
        toString: () => `vscode-webview-resource://preview/${resource.toString().replace('file:///', '')}`,
      })),
    } as never, {
      toString: () => 'file:///extension',
    } as never);

    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-");
    expect(html).toContain("style-src vscode-webview://preview 'unsafe-inline'");
    expect(html).toContain('vscode-webview-resource://preview/');
    expect(html).toContain('<script nonce="');
    expect(html).toContain('type="module"');
    expect(html).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(html).not.toContain('file://');
    expect(html).not.toContain('<script src=');
  });
});
