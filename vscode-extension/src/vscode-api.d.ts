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

  export const enum ColorThemeKind {
    Light = 1,
    Dark = 2,
    HighContrast = 3,
    HighContrastLight = 4,
  }

  export interface ColorTheme {
    readonly kind: ColorThemeKind;
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
    const activeColorTheme: ColorTheme;
    function onDidChangeActiveColorTheme(listener: (colorTheme: ColorTheme) => void): Disposable;
    function registerCustomEditorProvider<T extends CustomDocument>(
      viewType: string,
      provider: CustomReadonlyEditorProvider<T>,
    ): Disposable;
  }

  export namespace commands {
    function registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable;
    function executeCommand<T = unknown>(command: string, ...rest: unknown[]): Thenable<T>;
  }
}
