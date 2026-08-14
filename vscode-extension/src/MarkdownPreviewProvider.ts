import * as vscode from 'vscode';

export const MARKDOWN_PREVIEW_VIEW_TYPE = 'feishu-md-viewer.markdownPreview';

interface ReadyMessage {
  type: 'ready';
}

interface DocumentMessage {
  type: 'document';
  text: string;
  version: number;
}

interface ThemeMessage {
  type: 'theme';
  kind: 'light' | 'dark';
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WebviewStateMessage = DocumentMessage | ErrorMessage;

function createNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'assets', 'index.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'assets', 'index.css'),
  );
  const nonce = createNonce();

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Feishu Markdown Preview</title>
  </head>
  <body>
    <div id="webview-root"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
}

function isReadyMessage(message: unknown): message is ReadyMessage {
  return typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'ready';
}

function getThemeMessage(theme: vscode.ColorTheme): ThemeMessage {
  const isLight = theme.kind === vscode.ColorThemeKind.Light
    || theme.kind === vscode.ColorThemeKind.HighContrastLight;

  return { type: 'theme', kind: isLight ? 'light' : 'dark' };
}

function getDocumentErrorMessage(uri: vscode.Uri, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `无法读取 Markdown 文档（${uri.toString()}）：${detail || '未知错误'}`;
}

export class MarkdownPreviewDocument implements vscode.CustomDocument {
  private readonly disposables = new Set<vscode.Disposable>();
  private disposed = false;

  constructor(readonly uri: vscode.Uri) {}

  get isDisposed(): boolean {
    return this.disposed;
  }

  addDisposable(disposable: vscode.Disposable): void {
    if (this.disposed) {
      disposable.dispose();
      return;
    }

    this.disposables.add(disposable);
  }

  disposeDisposable(disposable: vscode.Disposable): void {
    this.disposables.delete(disposable);
    disposable.dispose();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.clear();
  }
}

export class MarkdownPreviewProvider implements vscode.CustomReadonlyEditorProvider<MarkdownPreviewDocument> {
  constructor(private readonly extensionUri: vscode.Uri) {}

  openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): MarkdownPreviewDocument {
    return new MarkdownPreviewDocument(uri);
  }

  async resolveCustomEditor(
    document: MarkdownPreviewDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
    };
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri);

    let isReady = false;
    let isDisposed = false;
    let documentChangeListener: vscode.Disposable | undefined;
    let messageListener: vscode.Disposable | undefined;
    let themeListener: vscode.Disposable | undefined;
    let latestState: WebviewStateMessage | undefined;
    let panelDisposeListener: vscode.Disposable;
    const sendLatestState = () => {
      if (!isReady || isDisposed || !latestState) {
        return;
      }

      void panel.webview.postMessage(latestState);
    };
    const sendTheme = (theme: vscode.ColorTheme) => {
      if (!isReady || isDisposed) {
        return;
      }

      void panel.webview.postMessage(getThemeMessage(theme));
    };
    const disposeListeners = () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      if (documentChangeListener) {
        document.disposeDisposable(documentChangeListener);
      }
      if (messageListener) {
        document.disposeDisposable(messageListener);
      }
      if (themeListener) {
        document.disposeDisposable(themeListener);
      }
      document.disposeDisposable(panelDisposeListener);
    };

    panelDisposeListener = panel.onDidDispose(disposeListeners);
    document.addDisposable(panelDisposeListener);
    messageListener = panel.webview.onDidReceiveMessage((message) => {
      if (!isReadyMessage(message) || isReady) {
        return;
      }

      isReady = true;
      sendLatestState();
      if (latestState?.type === 'document') {
        sendTheme(vscode.window.activeColorTheme);
      }
    });
    document.addDisposable(messageListener);

    try {
      const textDocument = await vscode.workspace.openTextDocument(document.uri);
      if (isDisposed || document.isDisposed) {
        return;
      }

      let latestVersion = textDocument.version;
      let latestText = textDocument.getText();
      latestState = {
        type: 'document',
        text: latestText,
        version: latestVersion,
      };
      const documentUri = document.uri.toString();

      documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() !== documentUri || event.document.version <= latestVersion) {
          return;
        }

        latestVersion = event.document.version;
        latestText = event.document.getText();
        latestState = {
          type: 'document',
          text: latestText,
          version: latestVersion,
        };
        sendLatestState();
      });

      document.addDisposable(documentChangeListener);
      themeListener = vscode.window.onDidChangeActiveColorTheme(sendTheme);
      document.addDisposable(themeListener);
      sendLatestState();
      sendTheme(vscode.window.activeColorTheme);
    } catch (error) {
      if (isDisposed || document.isDisposed) {
        return;
      }

      latestState = {
        type: 'error',
        message: getDocumentErrorMessage(document.uri, error),
      };
      sendLatestState();
    }
  }
}
