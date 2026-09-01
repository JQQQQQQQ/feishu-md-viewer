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

function createSettingsStore(initial: unknown = undefined) {
  let value = initial;
  return {
    get: vi.fn(() => value),
    update: vi.fn(async (_key: string, nextValue: unknown) => {
      value = nextValue;
    }),
  };
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
      documentKey: 'file:///guide.md',
      sourceContext: {
        source: 'file',
        runtime: 'vscode-webview',
        documentUrl: 'file:///guide.md',
        contentUrl: 'vscode-webview-resource://preview/guide.md',
      },
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

    expect(panel.webview.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'document' }));

    finishOpening?.(sourceDocument);
    await resolving;

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'document',
      text: '# 延迟打开的内容',
      version: 7,
      documentKey: 'file:///guide.md',
      sourceContext: {
        source: 'file',
        runtime: 'vscode-webview',
        documentUrl: 'file:///guide.md',
        contentUrl: 'vscode-webview-resource://preview/guide.md',
      },
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
      documentKey: 'file:///guide.md',
      sourceContext: {
        source: 'file',
        runtime: 'vscode-webview',
        documentUrl: 'file:///guide.md',
        contentUrl: 'vscode-webview-resource://preview/guide.md',
      },
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
      documentKey: 'file:///guide.md',
      sourceContext: {
        source: 'file',
        runtime: 'vscode-webview',
        documentUrl: 'file:///guide.md',
        contentUrl: 'vscode-webview-resource://preview/guide.md',
      },
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

    expect(panel.webview.postMessage).toHaveBeenCalledTimes(4);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'document',
      text: '# 第三版',
      version: 3,
      documentKey: 'file:///guide.md',
      sourceContext: {
        source: 'file',
        runtime: 'vscode-webview',
        documentUrl: 'file:///guide.md',
        contentUrl: 'vscode-webview-resource://preview/guide.md',
      },
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

  it('ready 后向 Webview 发送扩展级全局预览设置', async () => {
    vscodeMock.reset();
    const settingsStore = createSettingsStore({
      theme: 'dark',
      fontSize: 19,
      tocSmoothScrollEnabled: false,
      contentAlignment: 'left',
    });
    const provider = new MarkdownPreviewProvider(extensionUri, settingsStore as never);
    const sourceDocument = createDocument('# 全局设置');
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);
    const customDocument = await provider.openCustomDocument(sourceDocument.uri, customDocumentOpenContext, cancellationToken);
    const panel = createPanel();

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    panel.fireMessage({ type: 'ready' });

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'settings',
      settings: {
        theme: 'dark',
        fontSize: 19,
        tocFontSize: 13,
        tocSmoothScrollEnabled: false,
        contentAlignment: 'left',
      },
    });
  });

  it('一个预览页修改设置后持久化并同步到其他已打开预览页', async () => {
    vscodeMock.reset();
    const settingsStore = createSettingsStore();
    const provider = new MarkdownPreviewProvider(extensionUri, settingsStore as never);
    const sourceDocument = createDocument('# 文档一');
    const secondDocument = createDocument('# 文档二', 1, 'file:///second.md');
    vscodeMock.workspace.openTextDocument
      .mockResolvedValueOnce(sourceDocument)
      .mockResolvedValueOnce(secondDocument);
    const first = await provider.openCustomDocument(sourceDocument.uri, customDocumentOpenContext, cancellationToken);
    const second = await provider.openCustomDocument(secondDocument.uri, customDocumentOpenContext, cancellationToken);
    const firstPanel = createPanel();
    const secondPanel = createPanel();

    await provider.resolveCustomEditor(first, firstPanel, cancellationToken);
    await provider.resolveCustomEditor(second, secondPanel, cancellationToken);
    firstPanel.fireMessage({ type: 'ready' });
    secondPanel.fireMessage({ type: 'ready' });
    firstPanel.webview.postMessage.mockClear();
    secondPanel.webview.postMessage.mockClear();

    firstPanel.fireMessage({
      type: 'settings',
      settings: { theme: 'light', fontSize: 18, tocSmoothScrollEnabled: true, contentAlignment: 'center' },
    });

    expect(settingsStore.update).toHaveBeenCalledWith('feishu-md-viewer.previewSettings', {
      theme: 'light',
      fontSize: 18,
      tocFontSize: 13,
      tocSmoothScrollEnabled: true,
      contentAlignment: 'center',
    });
    expect(firstPanel.webview.postMessage).toHaveBeenCalledWith({
      type: 'settings',
      settings: { theme: 'light', fontSize: 18, tocFontSize: 13, tocSmoothScrollEnabled: true, contentAlignment: 'center' },
    });
    expect(secondPanel.webview.postMessage).toHaveBeenCalledWith({
      type: 'settings',
      settings: { theme: 'light', fontSize: 18, tocFontSize: 13, tocSmoothScrollEnabled: true, contentAlignment: 'center' },
    });
  });

  it('表格列宽按文档 URI 持久化，并在重新解析预览时恢复', async () => {
    vscodeMock.reset();
    const widthsStore = createSettingsStore();
    const sourceDocument = createDocument('# 表格文档', 1, 'file:///table.md');
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);
    const provider = new MarkdownPreviewProvider(extensionUri, widthsStore as never);
    const customDocument = await provider.openCustomDocument(sourceDocument.uri, customDocumentOpenContext, cancellationToken);
    const panel = createPanel();

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    panel.fireMessage({ type: 'ready' });
    panel.fireMessage({
      type: 'table-width-update',
      documentKey: 'file:///table.md',
      tableKey: 'table-fingerprint-1',
      widths: [180, 260],
    });

    expect(widthsStore.update).toHaveBeenCalledWith(
      'feishu-md-viewer.tableColumnWidths',
      expect.objectContaining({
        version: 1,
        documents: {
          'file:///table.md': { 'table-fingerprint-1': [180, 260] },
        },
      }),
    );

    const reopenedProvider = new MarkdownPreviewProvider(extensionUri, widthsStore as never);
    const reopenedDocument = await reopenedProvider.openCustomDocument(sourceDocument.uri, customDocumentOpenContext, cancellationToken);
    const reopenedPanel = createPanel();
    await reopenedProvider.resolveCustomEditor(reopenedDocument, reopenedPanel, cancellationToken);
    reopenedPanel.fireMessage({ type: 'ready' });

    expect(reopenedPanel.webview.postMessage).toHaveBeenCalledWith({
      type: 'table-widths',
      documentKey: 'file:///table.md',
      widths: { 'table-fingerprint-1': [180, 260] },
    });
  });

  it('表格身份映射按文档 URI单独持久化并触发同文档预览同步', async () => {
    vscodeMock.reset();
    const identitiesStore = createSettingsStore();
    const sourceDocument = createDocument('# 表格文档', 1, 'file:///identity-table.md');
    vscodeMock.workspace.openTextDocument.mockResolvedValue(sourceDocument);
    const provider = new MarkdownPreviewProvider(extensionUri, identitiesStore as never);
    const customDocument = await provider.openCustomDocument(sourceDocument.uri, customDocumentOpenContext, cancellationToken);
    const panel = createPanel();

    await provider.resolveCustomEditor(customDocument, panel, cancellationToken);
    panel.fireMessage({ type: 'ready' });
    panel.webview.postMessage.mockClear();
    const identities = [{
      id: 'table-original',
      currentId: 'table-runtime',
      headingPath: 'h2:1',
      text: 'A B',
      columnCount: 2,
      ordinal: 0,
    }];

    panel.fireMessage({
      type: 'table-identities-update',
      documentKey: 'file:///identity-table.md',
      identities,
    });

    expect(identitiesStore.update).toHaveBeenCalledWith(
      'feishu-md-viewer.tableIdentities',
      {
        version: 1,
        documents: { 'file:///identity-table.md': identities },
      },
    );
  });
});
