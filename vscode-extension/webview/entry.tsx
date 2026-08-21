import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewRoot } from '../../src/viewer/PreviewRoot';
import { useViewerStore, type ThemeMode } from '../../src/viewer/store';
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
}

interface ThemeMessage {
  type: 'theme';
  kind: ThemeKind;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WebviewMessage = DocumentMessage | ThemeMessage | ErrorMessage;

interface VsCodeApi {
  postMessage(message: { type: 'ready' }): void;
  getState?: () => unknown;
  setState?: (state: unknown) => unknown;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

function isWebviewMessage(message: unknown): message is WebviewMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false;
  }

  const candidate = message as { type?: unknown; text?: unknown; version?: unknown; kind?: unknown; message?: unknown };
  if (candidate.type === 'document') {
    return (
      typeof candidate.text === 'string'
      && typeof candidate.version === 'number'
      && Number.isFinite(candidate.version)
      && Number.isInteger(candidate.version)
      && candidate.version >= 0
    );
  }

  if (candidate.type === 'theme') {
    return candidate.kind === 'light' || candidate.kind === 'dark';
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
  const setStoredTheme = useViewerStore((state) => state.setTheme);
  const setStoredFontSize = useViewerStore((state) => state.setFontSize);
  const setStoredSmoothScroll = useViewerStore((state) => state.setTocSmoothScrollEnabled);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [isResumeOverlayVisible, setIsResumeOverlayVisible] = useState(
    () => document.visibilityState === 'hidden',
  );
  const resumeGenerationRef = useRef(0);
  const resumeFrameRef = useRef<number>();
  const resumeFallbackTimerRef = useRef<number>();
  const vscodeApi = useMemo(() => getVsCodeApi(), []);
  const effectiveTheme = storedTheme === 'system' ? theme : storedTheme;

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
    const handleWindowBlur = () => beginResume();
    const handleWindowFocus = () => finishResume();

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
    const state = vscodeApi?.getState?.() as { settings?: {
      theme?: ThemeMode;
      fontSize?: number;
      tocSmoothScrollEnabled?: boolean;
    } } | undefined;
    const settings = state?.settings;
    if (!settings) {
      setSettingsHydrated(true);
      return;
    }
    if (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system') {
      setStoredTheme(settings.theme);
    }
    if (typeof settings.fontSize === 'number') setStoredFontSize(settings.fontSize);
    if (typeof settings.tocSmoothScrollEnabled === 'boolean') {
      setStoredSmoothScroll(settings.tocSmoothScrollEnabled);
    }
    setSettingsHydrated(true);
  }, [setStoredFontSize, setStoredSmoothScroll, setStoredTheme, vscodeApi]);

  useEffect(() => {
    if (!settingsHydrated) return;
    vscodeApi?.setState?.({
      settings: { theme: storedTheme, fontSize, tocSmoothScrollEnabled },
    });
  }, [fontSize, settingsHydrated, storedTheme, tocSmoothScrollEnabled, vscodeApi]);

  useEffect(() => {
    vscodeApi?.postMessage({ type: 'ready' });
  }, [vscodeApi]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isWebviewMessage(event.data)) {
        return;
      }

      if (event.data.type === 'document') {
        setDocumentState((current) => {
          if (current && event.data.version <= current.version) {
            return current;
          }

          return { text: event.data.text, version: event.data.version };
        });
        setError(undefined);
        return;
      }

      if (event.data.type === 'theme') {
        setTheme(event.data.kind);
        return;
      }

      setError(event.data.message);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
