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
    let latestDocument: DocumentMessage | undefined;
    let panelDisposeListener: vscode.Disposable;
    const sendLatestDocument = () => {
      if (!isReady || isDisposed || !latestDocument) {
        return;
      }

      void panel.webview.postMessage(latestDocument);
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
      document.disposeDisposable(panelDisposeListener);
    };

    panelDisposeListener = panel.onDidDispose(disposeListeners);
    document.addDisposable(panelDisposeListener);
    messageListener = panel.webview.onDidReceiveMessage((message) => {
      if (!isReadyMessage(message) || isReady) {
        return;
      }

      isReady = true;
      sendLatestDocument();
    });
    document.addDisposable(messageListener);

    const textDocument = await vscode.workspace.openTextDocument(document.uri);
    if (isDisposed || document.isDisposed) {
      return;
    }

    let latestVersion = textDocument.version;
    let latestText = textDocument.getText();
    latestDocument = {
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
      latestDocument = {
        type: 'document',
        text: latestText,
        version: latestVersion,
      };
      sendLatestDocument();
    });

    document.addDisposable(documentChangeListener);
    sendLatestDocument();
  }
}
