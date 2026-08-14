import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DisposableCallback = () => void;

function createDisposable(callback: DisposableCallback = () => undefined) {
  return { dispose: vi.fn(callback) };
}

const vscodeMock = vi.hoisted(() => {
  const themeListeners = new Set<(theme: { kind: number }) => void>();

  return {
    ColorThemeKind: {
      Light: 1,
      Dark: 2,
      HighContrast: 3,
      HighContrastLight: 4,
    },
    Uri: {
      joinPath: (base: { toString(): string }, ...segments: string[]) => ({
        toString: () => `${base.toString()}/${segments.join('/')}`,
      }),
    },
    workspace: {
      onDidChangeTextDocument: vi.fn(() => createDisposable()),
      openTextDocument: vi.fn(),
    },
    window: {
      activeColorTheme: { kind: 1 },
      onDidChangeActiveColorTheme: vi.fn((listener: (theme: { kind: number }) => void) => {
        themeListeners.add(listener);
        return createDisposable(() => themeListeners.delete(listener));
      }),
      registerCustomEditorProvider: vi.fn(() => createDisposable()),
    },
    fireThemeChange(kind: number) {
      this.window.activeColorTheme = { kind };
      for (const listener of themeListeners) {
        listener({ kind });
      }
    },
    reset() {
      themeListeners.clear();
      this.workspace.openTextDocument.mockReset();
      this.workspace.onDidChangeTextDocument.mockClear();
      this.window.onDidChangeActiveColorTheme.mockClear();
      this.window.activeColorTheme = { kind: this.ColorThemeKind.Light };
    },
  };
});

vi.mock('vscode', () => vscodeMock);

vi.mock('../../src/viewer/components/Markdown/MarkdownReadView', () => ({
  MarkdownReadView: ({ content }: { content: string }) => {
    if (content === '[[render-error]]') {
      throw new Error('测试渲染失败');
    }
    return null;
  },
}));

import { MarkdownPreviewProvider } from '../src/MarkdownPreviewProvider';
import { WebviewPreview } from '../webview/entry';

interface FakeTextDocument {
  uri: { toString(): string };
  version: number;
  getText(): string;
}

interface FakePanel {
  webview: {
    cspSource: string;
    html: string;
    options: Record<string, unknown>;
    asWebviewUri(resource: { toString(): string }): { toString(): string };
    postMessage: ReturnType<typeof vi.fn>;
    onDidReceiveMessage(listener: (message: unknown) => void): { dispose: ReturnType<typeof vi.fn> };
  };
  fireMessage(message: unknown): void;
  dispose(): void;
}

function createTextDocument(text: string, version = 1): FakeTextDocument {
  return {
    uri: { toString: () => 'file:///guide.md' },
    version,
    getText: () => text,
  };
}

function createPanel(): FakePanel {
  let messageListener: ((message: unknown) => void) | undefined;
  let disposeListener: (() => void) | undefined;

  return {
    webview: {
      cspSource: 'vscode-webview://preview',
      html: '',
      options: {},
      asWebviewUri: (resource) => ({ toString: () => resource.toString() }),
      postMessage: vi.fn(() => Promise.resolve(true)),
      onDidReceiveMessage(listener) {
        messageListener = listener;
        return createDisposable();
      },
    },
    fireMessage(message) {
      messageListener?.(message);
    },
    dispose() {
      disposeListener?.();
    },
    onDidDispose(listener: () => void) {
      disposeListener = listener;
      return createDisposable();
    },
  } as FakePanel;
}

function sendWebviewMessage(message: unknown): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: message }));
  });
}

describe('VS Code 预览状态', () => {
  beforeEach(() => {
    vscodeMock.reset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('对空 Markdown 文档显示明确空态而不是渲染空白预览', () => {
    render(React.createElement(WebviewPreview));

    sendWebviewMessage({ type: 'document', text: '   \n', version: 1 });

    expect(screen.getByRole('status')).toHaveTextContent('Markdown 文档为空');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('读取文档失败后向已就绪 Webview 发送可显示的错误消息', async () => {
    const provider = new MarkdownPreviewProvider({ toString: () => 'file:///extension' } as never);
    const document = provider.openCustomDocument(
      { toString: () => 'file:///guide.md' } as never,
      { backupId: undefined, untitledDocumentData: undefined } as never,
      { isCancellationRequested: false } as never,
    );
    const panel = createPanel();
    vscodeMock.workspace.openTextDocument.mockRejectedValue(new Error('磁盘不可访问'));

    await expect(provider.resolveCustomEditor(document, panel as never, {} as never)).resolves.toBeUndefined();
    panel.fireMessage({ type: 'ready' });

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: '无法读取 Markdown 文档（file:///guide.md）：磁盘不可访问',
    });
  });

  it('主题变化后向已就绪 Webview 发送 dark 主题，并在 dispose 后停止发送', async () => {
    const provider = new MarkdownPreviewProvider({ toString: () => 'file:///extension' } as never);
    const sourceDocument = createTextDocument('# 主题');
    const document = provider.openCustomDocument(
      sourceDocument.uri as never,
      { backupId: undefined, untitledDocumentData: undefined } as never,
      { isCancellationRequested: false } as never,
    );
    const panel = createPanel();
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);

    await provider.resolveCustomEditor(document, panel as never, {} as never);
    panel.fireMessage({ type: 'ready' });
    panel.webview.postMessage.mockClear();

    vscodeMock.fireThemeChange(vscodeMock.ColorThemeKind.Dark);

    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'theme', kind: 'dark' });

    panel.dispose();
    panel.webview.postMessage.mockClear();
    vscodeMock.fireThemeChange(vscodeMock.ColorThemeKind.Light);

    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('Webview ready 时立即同步当前活动主题', async () => {
    vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };
    const provider = new MarkdownPreviewProvider({ toString: () => 'file:///extension' } as never);
    const sourceDocument = createTextDocument('# 初始主题');
    const document = provider.openCustomDocument(
      sourceDocument.uri as never,
      { backupId: undefined, untitledDocumentData: undefined } as never,
      { isCancellationRequested: false } as never,
    );
    const panel = createPanel();
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);

    await provider.resolveCustomEditor(document, panel as never, {} as never);
    panel.fireMessage({ type: 'ready' });

    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'theme', kind: 'dark' });
  });

  it('渲染错误显示状态，并在收到下一版文档时恢复可用预览', () => {
    render(React.createElement(WebviewPreview));

    sendWebviewMessage({ type: 'document', text: '[[render-error]]', version: 1 });
    expect(screen.getByRole('alert')).toHaveTextContent('渲染错误');

    sendWebviewMessage({ type: 'document', text: '# 恢复后的文档', version: 2 });
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('声明 Markdown 双扩展名、激活事件和原生编辑器回退命令', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'vscode-extension/package.json'), 'utf8'));

    expect(manifest.activationEvents).toContain('onCustomEditor:feishu-md-viewer.markdownPreview');
    expect(manifest.contributes.customEditors[0].selector).toEqual(expect.arrayContaining([
      { filenamePattern: '*.md' },
      { filenamePattern: '*.markdown' },
    ]));
    expect(manifest.contributes.commands).toContainEqual({
      command: 'feishu-md-viewer.reopenWithTextEditor',
      title: '使用原生文本编辑器重新打开',
    });
  });
});
