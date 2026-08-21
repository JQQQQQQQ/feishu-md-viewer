import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

type DisposableCallback = () => void;

function createDisposable(callback: DisposableCallback = () => undefined) {
  return { dispose: vi.fn(callback) };
}

const vscodeMock = vi.hoisted(() => {
  const textDocumentListeners = new Set<(event: { document: FakeDocument }) => void>();
  const documentListenerDisposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];

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
      onDidChangeTextDocument: vi.fn((listener: (event: { document: FakeDocument }) => void) => {
        textDocumentListeners.add(listener);
        const disposable = createDisposable(() => textDocumentListeners.delete(listener));
        documentListenerDisposables.push(disposable);
        return disposable;
      }),
      openTextDocument: vi.fn(),
    },
    window: {
      activeColorTheme: { kind: 1 },
      onDidChangeActiveColorTheme: vi.fn(() => createDisposable()),
      registerCustomEditorProvider: vi.fn(() => createDisposable()),
    },
    commands: {
      executeCommand: vi.fn(() => Promise.resolve(undefined)),
      registerCommand: vi.fn(() => createDisposable()),
    },
    fireTextDocumentChange(document: FakeDocument) {
      for (const listener of textDocumentListeners) {
        listener({ document });
      }
    },
    documentListenerDisposables,
    reset() {
      textDocumentListeners.clear();
      documentListenerDisposables.length = 0;
      this.workspace.onDidChangeTextDocument.mockClear();
      this.workspace.openTextDocument.mockReset();
      this.window.onDidChangeActiveColorTheme.mockClear();
      this.window.registerCustomEditorProvider.mockClear();
      this.commands.executeCommand.mockClear();
      this.commands.registerCommand.mockClear();
    },
  };
});

vi.mock('vscode', () => vscodeMock);

import { MarkdownPreviewProvider } from '../src/MarkdownPreviewProvider';
import { activate } from '../src/extension';

interface FakeDocument {
  uri: { toString(): string };
  version: number;
  getText(): string;
}

const customDocumentOpenContext = { backupId: undefined, untitledDocumentData: undefined };
const cancellationToken = { isCancellationRequested: false };
const extensionUri = { toString: () => 'file:///extension' };

function createProvider(): MarkdownPreviewProvider {
  return new MarkdownPreviewProvider(extensionUri);
}

interface FakePanel {
  options: { retainContextWhenHidden?: boolean };
  webview: {
    cspSource: string;
    html: string;
    options: { enableScripts?: boolean; localResourceRoots?: readonly { toString(): string }[] };
    asWebviewUri(resource: { toString(): string }): { toString(): string };
    postMessage: ReturnType<typeof vi.fn>;
    onDidReceiveMessage(listener: (message: unknown) => void): { dispose: ReturnType<typeof vi.fn> };
  };
  onDidDispose(listener: () => void): { dispose: ReturnType<typeof vi.fn> };
  fireMessage(message: unknown): void;
  dispose(): void;
  listenerDisposables: Array<{ dispose: ReturnType<typeof vi.fn> }>;
}

function createDocument(text: string, version: number, uri = 'file:///guide.md'): FakeDocument {
  return {
    uri: { toString: () => uri },
    version,
    getText: () => text,
  };
}

function createPanel(): FakePanel {
  let messageListener: ((message: unknown) => void) | undefined;
  let disposeListener: (() => void) | undefined;
  const listenerDisposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];

  return {
    options: {},
    webview: {
      cspSource: 'vscode-webview://preview',
      html: '',
      options: {},
      asWebviewUri(resource) {
        return { toString: () => `vscode-webview-resource://preview/${resource.toString().replace('file:///', '')}` };
      },
      postMessage: vi.fn(() => Promise.resolve(true)),
      onDidReceiveMessage(listener) {
        messageListener = listener;
        const disposable = createDisposable();
        listenerDisposables.push(disposable);
        return disposable;
      },
    },
    onDidDispose(listener) {
      disposeListener = listener;
      const disposable = createDisposable();
      listenerDisposables.push(disposable);
      return disposable;
    },
    fireMessage(message) {
      messageListener?.(message);
    },
    dispose() {
      disposeListener?.();
    },
    listenerDisposables,
  };
}

describe('MarkdownPreviewProvider', () => {
  it('激活时注册 Feishu Markdown Custom Editor', () => {
    vscodeMock.reset();
    const context = { subscriptions: [] as Array<{ dispose(): void }>, extensionUri };

    activate(context);

    expect(vscodeMock.window.registerCustomEditorProvider).toHaveBeenCalledWith(
      'feishu-md-viewer.markdownPreview',
      expect.any(MarkdownPreviewProvider),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    );
    expect(vscodeMock.commands.registerCommand).toHaveBeenCalledWith(
      'feishu-md-viewer.reopenWithTextEditor',
      expect.any(Function),
    );
    expect(context.subscriptions).toHaveLength(2);
  });

  it('注册默认优先级的 Markdown 自定义只读编辑器', () => {
    const packageJsonPath = resolve(process.cwd(), 'vscode-extension/package.json');
    const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    expect(manifest.contributes.customEditors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        viewType: 'feishu-md-viewer.markdownPreview',
        displayName: 'Feishu Markdown Preview',
        selector: expect.arrayContaining([
          { filenamePattern: '*.md' },
          { filenamePattern: '*.markdown' },
        ]),
        priority: 'default',
      }),
    ]));
  });

  it('以 CustomDocument 模型打开 URI，并兼容 openContext 与 cancellation token', async () => {
    vscodeMock.reset();
    const sourceDocument = createDocument('# 初始内容', 1);
    const provider = createProvider();

    const customDocument = await provider.openCustomDocument(
      sourceDocument.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    expect(customDocument).toMatchObject({ uri: sourceDocument.uri });
    expect(customDocument).toHaveProperty('dispose', expect.any(Function));
    expect(vscodeMock.workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it('使用自定义文档 URI 读取文本，并在 webview 就绪后发送初始消息', async () => {
    vscodeMock.reset();
    const provider = createProvider();
    const sourceDocument = createDocument('# 初始内容', 3);
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);
    const panel = createPanel();
    const customDocument = await provider.openCustomDocument(
      sourceDocument.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);

    expect(vscodeMock.workspace.openTextDocument).toHaveBeenCalledWith(sourceDocument.uri);

    expect(panel.webview.postMessage).not.toHaveBeenCalled();

    panel.fireMessage({ type: 'ready' });

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'document',
      text: '# 初始内容',
      version: 3,
    });
  });

  it('源文档异步打开期间收到 ready 后会发送加载完成的最新快照', async () => {
    vscodeMock.reset();
    const provider = createProvider();
    const panel = createPanel();
    const sourceDocument = createDocument('# 延迟打开的内容', 7);
    let finishOpening: ((document: FakeDocument) => void) | undefined;
    vscodeMock.workspace.openTextDocument.mockImplementation(
      () => new Promise<FakeDocument>((resolveOpen) => { finishOpening = resolveOpen; }),
    );
    const customDocument = await provider.openCustomDocument(
      sourceDocument.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    const resolving = provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    panel.fireMessage({ type: 'ready' });

    expect(panel.webview.postMessage).not.toHaveBeenCalled();

    finishOpening?.(sourceDocument);
    await resolving;

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'document',
      text: '# 延迟打开的内容',
      version: 7,
    });
  });

  it('Webview 重建后再次发送 ready 时重新发送最新文档快照', async () => {
    vscodeMock.reset();
    const provider = createProvider();
    const panel = createPanel();
    const sourceDocument = createDocument('# 初始内容', 3);
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);
    const customDocument = await provider.openCustomDocument(
      sourceDocument.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    panel.fireMessage({ type: 'ready' });
    panel.webview.postMessage.mockClear();

    vscodeMock.fireTextDocumentChange(createDocument('# Webview 重建前的最新内容', 4));
    panel.webview.postMessage.mockClear();

    // VS Code 切换标签后可能重建 Webview 前端；新的前端会再次发送 ready。
    panel.fireMessage({ type: 'ready' });

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'document',
      text: '# Webview 重建前的最新内容',
      version: 4,
    });
  });

  it('推送新版本并丢弃同一文档的陈旧更新', async () => {
    vscodeMock.reset();
    const provider = createProvider();
    const panel = createPanel();
    const initial = createDocument('# 初始内容', 3);
    vscodeMock.workspace.openTextDocument.mockResolvedValue(initial);
    const customDocument = await provider.openCustomDocument(
      initial.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    panel.fireMessage({ type: 'ready' });
    panel.webview.postMessage.mockClear();

    vscodeMock.fireTextDocumentChange(createDocument('# 新内容', 4));
    vscodeMock.fireTextDocumentChange(createDocument('# 其他文档', 5, 'file:///other.md'));
    vscodeMock.fireTextDocumentChange(createDocument('# 旧内容', 3));

    expect(panel.webview.postMessage).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'document',
      text: '# 新内容',
      version: 4,
    });
  });

  it('ready 前连续更新时只发送最高版本的文档快照', async () => {
    vscodeMock.reset();
    const provider = createProvider();
    const panel = createPanel();
    const initial = createDocument('# 初始内容', 1);
    vscodeMock.workspace.openTextDocument.mockResolvedValue(initial);
    const customDocument = await provider.openCustomDocument(
      initial.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    vscodeMock.fireTextDocumentChange(createDocument('# 第二版', 2));
    vscodeMock.fireTextDocumentChange(createDocument('# 第三版', 3));

    expect(panel.webview.postMessage).not.toHaveBeenCalled();

    panel.fireMessage({ type: 'ready' });

    expect(panel.webview.postMessage).toHaveBeenCalledTimes(2);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'document',
      text: '# 第三版',
      version: 3,
    });
  });

  it('不实现任何自定义文档写回方法，并在面板关闭时释放监听器', async () => {
    vscodeMock.reset();
    const provider = createProvider();
    const panel = createPanel();
    const sourceDocument = createDocument('# 内容', 1);
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);
    const customDocument = await provider.openCustomDocument(
      sourceDocument.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);

    expect(provider).not.toHaveProperty('saveCustomDocument');
    expect(provider).not.toHaveProperty('saveCustomDocumentAs');
    expect(provider).not.toHaveProperty('revertCustomDocument');
    expect(provider).not.toHaveProperty('backupCustomDocument');

    panel.dispose();

    expect(panel.listenerDisposables.every((disposable) => disposable.dispose.mock.calls.length === 1)).toBe(true);
    expect(vscodeMock.documentListenerDisposables).toHaveLength(1);
    expect(vscodeMock.documentListenerDisposables[0]?.dispose).toHaveBeenCalledTimes(1);

    panel.webview.postMessage.mockClear();
    vscodeMock.fireTextDocumentChange(createDocument('# 面板关闭后的内容', 2));

    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('自定义文档释放时清理该文档所属的所有监听器', async () => {
    vscodeMock.reset();
    const provider = createProvider();
    const panel = createPanel();
    const sourceDocument = createDocument('# 内容', 1);
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);
    const customDocument = await provider.openCustomDocument(
      sourceDocument.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    customDocument.dispose();

    expect(panel.listenerDisposables.every((disposable) => disposable.dispose.mock.calls.length === 1)).toBe(true);
    expect(vscodeMock.documentListenerDisposables).toHaveLength(1);
    expect(vscodeMock.documentListenerDisposables[0]?.dispose).toHaveBeenCalledTimes(1);

    panel.webview.postMessage.mockClear();
    vscodeMock.fireTextDocumentChange(createDocument('# 文档释放后的内容', 2));

    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('面板在源文档打开完成前关闭时不遗留任何监听器', async () => {
    vscodeMock.reset();
    const provider = createProvider();
    const panel = createPanel();
    const sourceDocument = createDocument('# 内容', 1);
    let finishOpening: ((document: FakeDocument) => void) | undefined;
    vscodeMock.workspace.openTextDocument.mockImplementation(
      () =>
        new Promise<FakeDocument>((resolveOpen) => {
          finishOpening = resolveOpen;
        }),
    );
    const customDocument = await provider.openCustomDocument(
      sourceDocument.uri,
      customDocumentOpenContext,
      cancellationToken,
    );

    const resolving = provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    panel.dispose();
    finishOpening?.(sourceDocument);
    await resolving;

    expect(vscodeMock.workspace.onDidChangeTextDocument).not.toHaveBeenCalled();
    expect(panel.listenerDisposables).toHaveLength(2);
    expect(panel.listenerDisposables.every((disposable) => disposable.dispose.mock.calls.length === 1)).toBe(true);
  });
});
