declare module 'vscode' {
  export interface Disposable {
    dispose(): void;
  }

  export interface Event<T> {
    (listener: (event: T) => unknown, thisArgs?: unknown, disposables?: Disposable[]): Disposable;
  }

  export interface Thenable<T> extends PromiseLike<T> {}

  export interface Uri {
    toString(): string;
  }

  export namespace Uri {
    function joinPath(base: Uri, ...pathSegments: string[]): Uri;
  }

  export interface TextDocument {
    readonly uri: Uri;
    readonly version: number;
    getText(): string;
  }

  export interface CustomDocument {
    readonly uri: Uri;
    dispose(): void;
  }

  export interface CustomDocumentOpenContext {
    readonly backupId: string | undefined;
    readonly untitledDocumentData: Uint8Array | undefined;
  }

  export interface CancellationToken {
    readonly isCancellationRequested: boolean;
    readonly onCancellationRequested: Event<void>;
  }

  export interface Webview {
    cspSource: string;
    html: string;
    options: WebviewOptions;
    asWebviewUri(localResource: Uri): Uri;
    postMessage(message: unknown): PromiseLike<boolean>;
    onDidReceiveMessage(listener: (message: unknown) => void): Disposable;
  }

  export interface WebviewOptions {
    enableScripts?: boolean;
    localResourceRoots?: readonly Uri[];
  }

  export interface WebviewPanel {
    readonly webview: Webview;
    onDidDispose(listener: () => void): Disposable;
  }

  export interface TextDocumentChangeEvent {
    readonly document: TextDocument;
  }

  export interface CustomReadonlyEditorProvider<T extends CustomDocument = CustomDocument> {
    openCustomDocument(
      uri: Uri,
      openContext: CustomDocumentOpenContext,
      token: CancellationToken,
    ): T | Thenable<T>;
    resolveCustomEditor(document: T, panel: WebviewPanel, token: CancellationToken): void | Thenable<void>;
  }

  export interface ExtensionContext {
    readonly subscriptions: Disposable[];
    readonly extensionUri: Uri;
  }

  export namespace workspace {
    function openTextDocument(uri: Uri): Thenable<TextDocument>;
    function onDidChangeTextDocument(listener: (event: TextDocumentChangeEvent) => void): Disposable;
  }

  export namespace window {
    function registerCustomEditorProvider<T extends CustomDocument>(
      viewType: string,
      provider: CustomReadonlyEditorProvider<T>,
    ): Disposable;
  }
}
