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
    let isReady = false;
    let isDisposed = false;
    let documentChangeListener: vscode.Disposable | undefined;
    let messageListener: vscode.Disposable | undefined;
    let panelDisposeListener: vscode.Disposable;
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

    const textDocument = await vscode.workspace.openTextDocument(document.uri);
    if (isDisposed || document.isDisposed) {
      return;
    }

    let latestVersion = textDocument.version;
    let latestText = textDocument.getText();
    const documentUri = document.uri.toString();

    const sendLatestDocument = () => {
      if (!isReady || isDisposed) {
        return;
      }

      const message: DocumentMessage = {
        type: 'document',
        text: latestText,
        version: latestVersion,
      };
      void panel.webview.postMessage(message);
    };

    documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== documentUri || event.document.version <= latestVersion) {
        return;
      }

      latestVersion = event.document.version;
      latestText = event.document.getText();
      sendLatestDocument();
    });
    messageListener = panel.webview.onDidReceiveMessage((message) => {
      if (!isReadyMessage(message) || isReady) {
        return;
      }

      isReady = true;
      sendLatestDocument();
    });

    document.addDisposable(documentChangeListener);
    document.addDisposable(messageListener);
  }
}
