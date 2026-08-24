import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewRoot } from '../../src/viewer/PreviewRoot';
import { useViewerStore, type ContentAlignment, type ThemeMode } from '../../src/viewer/store';
import {
  setTableColumnWidthsBridge,
  type TableColumnWidthsBridge,
} from '../../src/viewer/components/Markdown/FeishuTableColumnWidths';
import '../../src/viewer/styles/feishu-theme.css';
import '../../src/viewer/styles/tailwind-output.css';
import '../../src/viewer/styles/markdown.css';
import '../../src/viewer/styles/layout.css';
import '../../src/viewer/styles/scrollbar.css';
import '../../src/viewer/styles/mermaid.css';
import '../../src/viewer/styles/dark-theme.css';
import '../../src/viewer/styles/print.css';
import './webview.css';

type ThemeKind = 'light' | 'dark';

interface DocumentMessage {
  type: 'document';
  text: string;
  version: number;
  documentKey?: string;
}

interface ThemeMessage {
  type: 'theme';
  kind: ThemeKind;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

interface PreviewSettings {
  theme: ThemeMode;
  fontSize: number;
  tocSmoothScrollEnabled: boolean;
  contentAlignment: ContentAlignment;
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

interface TableIdentityRecord {
  id: string;
  currentId: string;
  headingPath: string;
  text: string;
  columnCount: number;
  ordinal: number;
}

interface TableIdentitiesUpdateMessage {
  type: 'table-identities-update';
  documentKey: string;
  identities: TableIdentityRecord[];
}

type WebviewMessage = DocumentMessage | ThemeMessage | SettingsMessage | TableWidthsMessage | ErrorMessage;

type WebviewOutgoingMessage = { type: 'ready' } | SettingsMessage | TableWidthUpdateMessage | TableIdentitiesUpdateMessage;

interface VsCodeApi {
  postMessage(message: WebviewOutgoingMessage): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

function isWebviewMessage(message: unknown): message is WebviewMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false;
  }

  const candidate = message as {
    type?: unknown;
    text?: unknown;
    version?: unknown;
    documentKey?: unknown;
    kind?: unknown;
    message?: unknown;
    settings?: unknown;
    widths?: unknown;
    tableKey?: unknown;
    identities?: unknown;
  };
  if (candidate.type === 'document') {
    return (
      typeof candidate.text === 'string'
      && typeof candidate.version === 'number'
      && Number.isFinite(candidate.version)
      && Number.isInteger(candidate.version)
      && candidate.version >= 0
      && (candidate.documentKey === undefined || typeof candidate.documentKey === 'string')
    );
  }

  if (candidate.type === 'theme') {
    return candidate.kind === 'light' || candidate.kind === 'dark';
  }

  if (candidate.type === 'settings' && typeof candidate.settings === 'object' && candidate.settings !== null) {
    const settings = candidate.settings as Partial<PreviewSettings>;
    return (
      (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system')
      && typeof settings.fontSize === 'number'
      && Number.isFinite(settings.fontSize)
      && typeof settings.tocSmoothScrollEnabled === 'boolean'
      && (settings.contentAlignment === 'left' || settings.contentAlignment === 'center')
    );
  }

  if (candidate.type === 'table-widths' && typeof candidate.documentKey === 'string' && typeof candidate.widths === 'object' && candidate.widths !== null) {
    const validWidths = Object.values(candidate.widths as Record<string, unknown>).every((widths) => (
      Array.isArray(widths)
      && widths.every((width) => typeof width === 'number' && Number.isFinite(width))
    ));
    const validIdentities = candidate.identities === undefined || (
      Array.isArray(candidate.identities)
      && candidate.identities.every((record) => {
        if (typeof record !== 'object' || record === null) return false;
        const identity = record as Partial<TableIdentityRecord>;
        return typeof identity.id === 'string'
          && typeof identity.currentId === 'string'
          && typeof identity.headingPath === 'string'
          && typeof identity.text === 'string'
          && typeof identity.columnCount === 'number'
          && typeof identity.ordinal === 'number';
      })
    );
    return validWidths && validIdentities;
  }

  return candidate.type === 'error' && typeof candidate.message === 'string';
}

function getVsCodeApi(): VsCodeApi | undefined {
  return typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
}

export function WebviewPreview() {
  const [documentState, setDocumentState] = useState<{ text: string; version: number }>();
  const [theme, setTheme] = useState<ThemeKind>('light');
  const [error, setError] = useState<string>();
  const storedTheme = useViewerStore((state) => state.theme);
  const fontSize = useViewerStore((state) => state.fontSize);
  const tocSmoothScrollEnabled = useViewerStore((state) => state.tocSmoothScrollEnabled);
  const contentAlignment = useViewerStore((state) => state.contentAlignment);
  const setStoredTheme = useViewerStore((state) => state.setTheme);
  const setStoredFontSize = useViewerStore((state) => state.setFontSize);
  const setStoredSmoothScroll = useViewerStore((state) => state.setTocSmoothScrollEnabled);
  const setStoredContentAlignment = useViewerStore((state) => state.setContentAlignment);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [isResumeOverlayVisible, setIsResumeOverlayVisible] = useState(
    () => document.visibilityState === 'hidden',
  );
  const resumeGenerationRef = useRef(0);
  const resumeFrameRef = useRef<number>();
  const resumeFallbackTimerRef = useRef<number>();
  const vscodeApi = useMemo(() => getVsCodeApi(), []);
  const tableWidthsRef = useRef<{ documentKey: string; widths: Record<string, number[]> }>({
    documentKey: '',
    widths: {},
  });
  const tableIdentitiesRef = useRef<{ documentKey: string; identities: TableIdentityRecord[]; ready: boolean }>({
    documentKey: '',
    identities: [],
    ready: false,
  });
  const tableWidthsBridgeRef = useRef<TableColumnWidthsBridge>();
  if (!tableWidthsBridgeRef.current) {
    tableWidthsBridgeRef.current = {
      read: (tableKey) => tableWidthsRef.current.widths[tableKey] ?? null,
      write: (tableKey, widths) => {
        const documentKey = tableWidthsRef.current.documentKey;
        if (!vscodeApi || !documentKey) return;
        vscodeApi.postMessage({ type: 'table-width-update', documentKey, tableKey, widths });
      },
      readIdentities: () => tableIdentitiesRef.current.ready
        ? tableIdentitiesRef.current.identities
        : null,
      writeIdentities: (identities) => {
        const documentKey = tableIdentitiesRef.current.documentKey;
        if (!vscodeApi || !documentKey || !tableIdentitiesRef.current.ready) return;
        tableIdentitiesRef.current.identities = identities;
        vscodeApi.postMessage({ type: 'table-identities-update', documentKey, identities });
      },
    };
  }
  const effectiveTheme = storedTheme === 'system' ? theme : storedTheme;

  useEffect(() => {
    if (!vscodeApi || !tableWidthsBridgeRef.current) return undefined;
    setTableColumnWidthsBridge(tableWidthsBridgeRef.current);
    return () => setTableColumnWidthsBridge(undefined);
  }, [vscodeApi]);

  useEffect(() => {
    const themedElements = [
      document.documentElement,
      document.body,
      document.getElementById('webview-root'),
    ].filter((element): element is HTMLElement => element instanceof HTMLElement);

    themedElements.forEach((element) => {
      element.dataset.feishuVscodeTheme = effectiveTheme;
    });

    return () => {
      themedElements.forEach((element) => {
        if (element.dataset.feishuVscodeTheme === effectiveTheme) {
          delete element.dataset.feishuVscodeTheme;
        }
      });
    };
  }, [effectiveTheme]);

  useEffect(() => {
    const cancelPendingResume = () => {
      if (resumeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resumeFrameRef.current);
        resumeFrameRef.current = undefined;
      }
      if (resumeFallbackTimerRef.current !== undefined) {
        window.clearTimeout(resumeFallbackTimerRef.current);
        resumeFallbackTimerRef.current = undefined;
      }
    };

    const beginResume = () => {
      ++resumeGenerationRef.current;
      cancelPendingResume();
      setIsResumeOverlayVisible(true);
      const generation = resumeGenerationRef.current;
      resumeFallbackTimerRef.current = window.setTimeout(() => {
        if (resumeGenerationRef.current !== generation) return;
        resumeFallbackTimerRef.current = undefined;
        setIsResumeOverlayVisible(false);
      }, 800);
    };

    const finishResume = () => {
      const generation = ++resumeGenerationRef.current;
      cancelPendingResume();

      resumeFrameRef.current = window.requestAnimationFrame(() => {
        if (resumeGenerationRef.current !== generation) return;
        resumeFrameRef.current = window.requestAnimationFrame(() => {
          if (resumeGenerationRef.current !== generation) return;
          resumeFrameRef.current = undefined;
          setIsResumeOverlayVisible(false);
        });
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        beginResume();
      } else {
        finishResume();
      }
    };
    // A VS Code context menu also causes the Webview window to blur while the
    // document remains visible. Do not cover the page with the resume spinner
    // for that transient native-menu blur; only use the fallback when VS Code
    // has actually hidden the Webview and no visibilitychange event arrived.
    const handleWindowBlur = () => {
      if (document.visibilityState === 'hidden') beginResume();
    };
    const handleWindowFocus = () => {
      if (document.visibilityState !== 'hidden') finishResume();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      ++resumeGenerationRef.current;
      cancelPendingResume();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    vscodeApi?.postMessage({
      type: 'settings',
      settings: { theme: storedTheme, fontSize, tocSmoothScrollEnabled, contentAlignment },
    });
  }, [contentAlignment, fontSize, settingsHydrated, storedTheme, tocSmoothScrollEnabled, vscodeApi]);

  useEffect(() => {
    vscodeApi?.postMessage({ type: 'ready' });
  }, [vscodeApi]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isWebviewMessage(event.data)) {
        return;
      }

      if (event.data.type === 'document') {
        tableWidthsRef.current = {
          documentKey: event.data.documentKey ?? '',
          widths: {},
        };
        tableIdentitiesRef.current = {
          documentKey: event.data.documentKey ?? '',
          identities: [],
          ready: false,
        };
        setDocumentState((current) => {
          if (current && event.data.version <= current.version) {
            return current;
          }

          return { text: event.data.text, version: event.data.version };
        });
        setError(undefined);
        return;
      }

      if (event.data.type === 'table-widths') {
        if (event.data.documentKey !== tableWidthsRef.current.documentKey) return;
        tableWidthsRef.current.widths = event.data.widths;
        tableIdentitiesRef.current = {
          documentKey: event.data.documentKey,
          identities: event.data.identities ?? [],
          ready: true,
        };
        window.dispatchEvent(new Event('feishu-table-widths-updated'));
        window.dispatchEvent(new Event('feishu-table-identities-updated'));
        return;
      }

      if (event.data.type === 'theme') {
        setTheme(event.data.kind);
        return;
      }

      if (event.data.type === 'settings') {
        setStoredTheme(event.data.settings.theme);
        setStoredFontSize(event.data.settings.fontSize);
        setStoredSmoothScroll(event.data.settings.tocSmoothScrollEnabled);
        setStoredContentAlignment(event.data.settings.contentAlignment);
        setSettingsHydrated(true);
        return;
      }

      setError(event.data.message);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setStoredContentAlignment, setStoredFontSize, setStoredSmoothScroll, setStoredTheme]);

  if (error) {
    return (
      <section role="alert" aria-live="assertive">
        <h1>无法读取 Markdown 文档</h1>
        <p>{error}</p>
        <p>请检查文件是否可访问，或使用原生文本编辑器重新打开。</p>
      </section>
    );
  }

  if (!documentState) {
    return <p>正在等待 Markdown 文档…</p>;
  }

  if (documentState.text.trim().length === 0) {
    return (
      <section role="status" aria-live="polite">
        <h1>Markdown 文档为空</h1>
        <p>此文件没有可预览的内容。</p>
      </section>
    );
  }

  return (
    <div
      className={`feishu-vscode-webview feishu-vscode-webview--${effectiveTheme}`}
      data-testid="feishu-vscode-webview"
    >
      <PreviewRoot
        key={documentState.version}
        markdown={documentState.text}
        source="file"
        themeOverride={storedTheme === 'system' ? theme : undefined}
        settingsEnabled
      />
      <div
        aria-hidden="true"
        className={`feishu-vscode-resume-overlay${isResumeOverlayVisible ? ' feishu-vscode-resume-overlay--visible' : ''}`}
        data-testid="vscode-resume-overlay"
      >
        <span className="feishu-vscode-resume-overlay__spinner" />
      </div>
    </div>
  );
}

const rootElement = document.getElementById('webview-root');
if (rootElement) {
  createRoot(rootElement).render(<WebviewPreview />);
}
