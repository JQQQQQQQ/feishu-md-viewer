import { act, cleanup, render, screen } from '@testing-library/react';
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
    if (!expectsDarkClass) {
      expect(screen.getByRole('article')).toHaveClass('feishu-viewer--light');
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
