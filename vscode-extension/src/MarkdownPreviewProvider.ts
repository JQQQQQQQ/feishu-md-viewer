import * as vscode from 'vscode';

export const MARKDOWN_PREVIEW_VIEW_TYPE = 'feishu-md-viewer.markdownPreview';

interface ReadyMessage {
  type: 'ready';
}

export type PreviewThemeMode = 'light' | 'dark' | 'system';
export type PreviewContentAlignment = 'left' | 'center';

export interface PreviewSettings {
  theme: PreviewThemeMode;
  fontSize: number;
  tocSmoothScrollEnabled: boolean;
  contentAlignment: PreviewContentAlignment;
}

export const PREVIEW_SETTINGS_KEY = 'feishu-md-viewer.previewSettings';
export const TABLE_COLUMN_WIDTHS_STORAGE_KEY = 'feishu-md-viewer.tableColumnWidths';
export const TABLE_IDENTITIES_STORAGE_KEY = 'feishu-md-viewer.tableIdentities';

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  theme: 'system',
  fontSize: 15,
  tocSmoothScrollEnabled: true,
  contentAlignment: 'center',
};

export interface PreviewSettingsStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): vscode.Thenable<void>;
}

interface DocumentMessage {
  type: 'document';
  text: string;
  version: number;
  documentKey: string;
  sourceContext: {
    source: 'file';
    runtime: 'vscode-webview';
    documentUrl: string;
    contentUrl: string;
  };
}

interface ThemeMessage {
  type: 'theme';
  kind: 'light' | 'dark';
}

interface SettingsMessage {
  type: 'settings';
  settings: PreviewSettings;
}

interface TableWidthsMessage {
  type: 'table-widths';
  documentKey: string;
  widths: Record<string, number[]>;
  identities?: TableIdentityRecord[];
}

interface TableWidthUpdateMessage {
  type: 'table-width-update';
  documentKey: string;
  tableKey: string;
  widths: number[];
}

interface TableIdentitiesUpdateMessage {
  type: 'table-identities-update';
  documentKey: string;
  identities: TableIdentityRecord[];
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WebviewStateMessage = DocumentMessage | ErrorMessage;

interface TableIdentityRecord {
  id: string;
  currentId: string;
  headingPath: string;
  text: string;
  columnCount: number;
  ordinal: number;
}

interface PersistedTableIdentities {
  version: 1;
  documents: Record<string, TableIdentityRecord[]>;
}

interface PersistedTableWidths {
  version: 1;
  documents: Record<string, Record<string, number[]>>;
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; media-src ${webview.cspSource} https: data:; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
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

function isSettingsMessage(message: unknown): message is { type: 'settings'; settings: unknown } {
  return typeof message === 'object'
    && message !== null
    && (message as { type?: unknown }).type === 'settings'
    && 'settings' in message;
}

function clampFontSize(value: number): number {
  return Math.min(24, Math.max(12, Math.round(value)));
}

export function sanitizePreviewSettings(value: unknown): PreviewSettings {
  const candidate = typeof value === 'object' && value !== null
    ? value as Partial<PreviewSettings>
    : {};

  return {
    theme: candidate.theme === 'light' || candidate.theme === 'dark' || candidate.theme === 'system'
      ? candidate.theme
      : DEFAULT_PREVIEW_SETTINGS.theme,
    fontSize: typeof candidate.fontSize === 'number' && Number.isFinite(candidate.fontSize)
      ? clampFontSize(candidate.fontSize)
      : DEFAULT_PREVIEW_SETTINGS.fontSize,
    tocSmoothScrollEnabled: typeof candidate.tocSmoothScrollEnabled === 'boolean'
      ? candidate.tocSmoothScrollEnabled
      : DEFAULT_PREVIEW_SETTINGS.tocSmoothScrollEnabled,
    contentAlignment: candidate.contentAlignment === 'left' ? 'left' : DEFAULT_PREVIEW_SETTINGS.contentAlignment,
  };
}

function createMemorySettingsStore(): PreviewSettingsStore {
  let value: unknown;
  return {
    get: <T,>(key: string) => key === PREVIEW_SETTINGS_KEY ? value as T | undefined : undefined,
    update: async (key: string, nextValue: unknown) => {
      if (key === PREVIEW_SETTINGS_KEY) value = nextValue;
    },
  };
}

function sanitizeTableWidths(value: unknown): Record<string, number[]> {
  if (typeof value !== 'object' || value === null) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([tableKey, widths]) => (
        tableKey.length > 0
        && Array.isArray(widths)
        && widths.length <= 200
      ))
      .map(([tableKey, widths]) => [
        tableKey,
        (widths as unknown[])
          .filter((width): width is number => (
            typeof width === 'number'
            && Number.isFinite(width)
            && width >= 24
            && width <= 4000
          ))
          .map((width) => Math.round(width)),
      ])
      .filter(([, widths]) => (widths as number[]).length > 0),
  );
}

function sanitizePersistedTableWidths(value: unknown): PersistedTableWidths {
  if (typeof value !== 'object' || value === null) {
    return { version: 1, documents: {} };
  }

  const candidate = value as { version?: unknown; documents?: unknown };
  if (candidate.version !== 1 || typeof candidate.documents !== 'object' || candidate.documents === null) {
    return { version: 1, documents: {} };
  }

  return {
    version: 1,
    documents: Object.fromEntries(
      Object.entries(candidate.documents as Record<string, unknown>)
        .map(([documentKey, widths]) => [documentKey, sanitizeTableWidths(widths)]),
    ),
  };
}

function sanitizeTableIdentities(value: unknown): TableIdentityRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((record): record is Partial<TableIdentityRecord> => typeof record === 'object' && record !== null)
    .map((record) => ({
      id: typeof record.id === 'string' ? record.id : '',
      currentId: typeof record.currentId === 'string' ? record.currentId : '',
      headingPath: typeof record.headingPath === 'string' ? record.headingPath : '',
      text: typeof record.text === 'string' ? record.text.slice(0, 1200) : '',
      columnCount: typeof record.columnCount === 'number' ? Math.max(0, Math.round(record.columnCount)) : 0,
      ordinal: typeof record.ordinal === 'number' ? Math.max(0, Math.round(record.ordinal)) : 0,
    }))
    .filter((record) => record.id.length > 0 && record.headingPath.length > 0)
    .slice(0, 200);
}

function sanitizePersistedTableIdentities(value: unknown): PersistedTableIdentities {
  if (typeof value !== 'object' || value === null) return { version: 1, documents: {} };
  const candidate = value as { version?: unknown; documents?: unknown };
  if (candidate.version !== 1 || typeof candidate.documents !== 'object' || candidate.documents === null) {
    return { version: 1, documents: {} };
  }

  return {
    version: 1,
    documents: Object.fromEntries(
      Object.entries(candidate.documents as Record<string, unknown>)
        .map(([documentKey, identities]) => [documentKey, sanitizeTableIdentities(identities)]),
    ),
  };
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
  private readonly settingsStore: PreviewSettingsStore;
  private readonly settingsSenders = new Set<(settings?: PreviewSettings) => void>();
  private readonly tableWidthsSenders = new Set<{
    documentKey: string;
    send: () => void;
  }>();
  private tableWidthsState: PersistedTableWidths | undefined;
  private tableIdentitiesState: PersistedTableIdentities | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    settingsStore?: PreviewSettingsStore,
  ) {
    this.settingsStore = settingsStore ?? createMemorySettingsStore();
  }

  private getPreviewSettings(): PreviewSettings {
    return sanitizePreviewSettings(this.settingsStore.get<unknown>(PREVIEW_SETTINGS_KEY));
  }

  private broadcastPreviewSettings(settings: PreviewSettings): void {
    for (const sendSettings of this.settingsSenders) {
      sendSettings(settings);
    }
  }

  private savePreviewSettings(value: unknown): void {
    const settings = sanitizePreviewSettings(value);
    try {
      void Promise.resolve(this.settingsStore.update(PREVIEW_SETTINGS_KEY, settings)).catch(() => undefined);
    } catch {
      // 持久化失败时仍要保证已打开的预览可以同步设置。
    }
    this.broadcastPreviewSettings(settings);
  }

  private getTableWidthsState(): PersistedTableWidths {
    if (!this.tableWidthsState) {
      this.tableWidthsState = sanitizePersistedTableWidths(
        this.settingsStore.get<unknown>(TABLE_COLUMN_WIDTHS_STORAGE_KEY),
      );
    }

    return this.tableWidthsState;
  }

  private getDocumentTableWidths(documentKey: string): Record<string, number[]> {
    return this.getTableWidthsState().documents[documentKey] ?? {};
  }

  private getTableIdentitiesState(): PersistedTableIdentities {
    if (!this.tableIdentitiesState) {
      this.tableIdentitiesState = sanitizePersistedTableIdentities(
        this.settingsStore.get<unknown>(TABLE_IDENTITIES_STORAGE_KEY),
      );
    }
    return this.tableIdentitiesState;
  }

  private getDocumentTableIdentities(documentKey: string): TableIdentityRecord[] {
    return this.getTableIdentitiesState().documents[documentKey] ?? [];
  }

  private sendDocumentTableWidths(documentKey: string): void {
    for (const sender of this.tableWidthsSenders) {
      if (sender.documentKey === documentKey) sender.send();
    }
  }

  private saveTableWidthUpdate(message: TableWidthUpdateMessage): void {
    if (!message.documentKey || !message.tableKey || !Array.isArray(message.widths)) return;

    const widths = sanitizeTableWidths({ [message.tableKey]: message.widths })[message.tableKey];
    if (!widths) return;

    const state = this.getTableWidthsState();
    state.documents[message.documentKey] = {
      ...(state.documents[message.documentKey] ?? {}),
      [message.tableKey]: widths,
    };
    try {
      void Promise.resolve(this.settingsStore.update(TABLE_COLUMN_WIDTHS_STORAGE_KEY, state)).catch(() => undefined);
    } catch {
      // 持久化失败时仍保持当前预览可用。
    }
    this.sendDocumentTableWidths(message.documentKey);
  }

  private saveTableIdentitiesUpdate(message: TableIdentitiesUpdateMessage): void {
    if (!message.documentKey) return;
    const state = this.getTableIdentitiesState();
    state.documents[message.documentKey] = sanitizeTableIdentities(message.identities);
    try {
      void Promise.resolve(this.settingsStore.update(TABLE_IDENTITIES_STORAGE_KEY, state)).catch(() => undefined);
    } catch {
      // 身份缓存失败时仍保持当前预览可用。
    }
    this.sendDocumentTableWidths(message.documentKey);
  }

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
    const documentDirectory = document.uri.fsPath
      ? vscode.Uri.file(document.uri.fsPath.slice(0, Math.max(
        document.uri.fsPath.lastIndexOf('/'),
        document.uri.fsPath.lastIndexOf('\\'),
      )))
      : undefined;
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        ...(documentDirectory ? [documentDirectory] : []),
      ],
    };
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri);

    let isReady = false;
    let isDisposed = false;
    let documentChangeListener: vscode.Disposable | undefined;
    let messageListener: vscode.Disposable | undefined;
    let themeListener: vscode.Disposable | undefined;
    let latestState: WebviewStateMessage | undefined;
    let panelDisposeListener: vscode.Disposable;
    const documentKey = document.uri.toString();
    const sourceContext = {
      source: 'file' as const,
      runtime: 'vscode-webview' as const,
      documentUrl: documentKey,
      contentUrl: panel.webview.asWebviewUri(document.uri).toString(),
    };
    const sendSettings = (settings?: PreviewSettings) => {
      if (!isReady || isDisposed) {
        return;
      }

      void panel.webview.postMessage({
        type: 'settings',
        settings: settings ?? this.getPreviewSettings(),
      } satisfies SettingsMessage);
    };
    const settingsDisposable: vscode.Disposable = {
      dispose: () => this.settingsSenders.delete(sendSettings),
    };
    const sendTableWidths = () => {
      if (!isReady || isDisposed || !latestState) return;

      void panel.webview.postMessage({
        type: 'table-widths',
        documentKey,
        widths: this.getDocumentTableWidths(documentKey),
        ...(this.getDocumentTableIdentities(documentKey).length > 0
          ? { identities: this.getDocumentTableIdentities(documentKey) }
          : {}),
      } satisfies TableWidthsMessage);
    };
    const tableWidthsDisposable: vscode.Disposable = {
      dispose: () => {
        for (const sender of this.tableWidthsSenders) {
          if (sender.send === sendTableWidths) this.tableWidthsSenders.delete(sender);
        }
      },
    };
    this.settingsSenders.add(sendSettings);
    this.tableWidthsSenders.add({ documentKey, send: sendTableWidths });
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
      this.settingsSenders.delete(sendSettings);
      document.disposeDisposable(settingsDisposable);
      document.disposeDisposable(tableWidthsDisposable);
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
    document.addDisposable(settingsDisposable);
    document.addDisposable(tableWidthsDisposable);
    messageListener = panel.webview.onDidReceiveMessage((message) => {
      if (typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'table-width-update') {
        const update = message as Partial<TableWidthUpdateMessage>;
        if (
          update.documentKey === documentKey
          && typeof update.tableKey === 'string'
          && Array.isArray(update.widths)
        ) {
          this.saveTableWidthUpdate({
            type: 'table-width-update',
            documentKey,
            tableKey: update.tableKey,
            widths: update.widths,
          });
        }
        return;
      }

      if (typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'table-identities-update') {
        const update = message as Partial<TableIdentitiesUpdateMessage>;
        if (
          update.documentKey === documentKey
          && Array.isArray(update.identities)
        ) {
          this.saveTableIdentitiesUpdate({
            type: 'table-identities-update',
            documentKey,
            identities: update.identities as TableIdentityRecord[],
          });
        }
        return;
      }

      if (isSettingsMessage(message)) {
        if (isReady) {
          this.savePreviewSettings(message.settings);
        }
        return;
      }

      if (!isReadyMessage(message)) {
        return;
      }

      isReady = true;
      // VS Code can destroy a hidden Webview and recreate it when its tab is
      // shown again. The recreated frontend sends a new ready message, and it
      // needs the latest document snapshot even though this provider was
      // already ready for the previous frontend instance.
      sendLatestState();
      sendTheme(vscode.window.activeColorTheme);
      sendSettings();
      sendTableWidths();
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
        documentKey,
        sourceContext,
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
          documentKey,
          sourceContext,
        };
        sendLatestState();
      });

      document.addDisposable(documentChangeListener);
      themeListener = vscode.window.onDidChangeActiveColorTheme(sendTheme);
      document.addDisposable(themeListener);
      sendLatestState();
      sendTheme(vscode.window.activeColorTheme);
      sendSettings();
      sendTableWidths();
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
