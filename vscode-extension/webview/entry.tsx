import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewRoot } from '../../src/viewer/PreviewRoot';
import '../../src/viewer/styles/feishu-theme.css';
import '../../src/viewer/styles/tailwind-output.css';
import '../../src/viewer/styles/markdown.css';
import '../../src/viewer/styles/layout.css';
import '../../src/viewer/styles/scrollbar.css';
import '../../src/viewer/styles/mermaid.css';
import '../../src/viewer/styles/dark-theme.css';
import '../../src/viewer/styles/print.css';

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

  useEffect(() => {
    getVsCodeApi()?.postMessage({ type: 'ready' });
  }, []);

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
    <PreviewRoot
      key={documentState.version}
      markdown={documentState.text}
      source="file"
      themeOverride={theme}
      settingsEnabled={false}
    />
  );
}

const rootElement = document.getElementById('webview-root');
if (rootElement) {
  createRoot(rootElement).render(<WebviewPreview />);
}
