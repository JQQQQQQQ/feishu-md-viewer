import { getActiveAdapter } from './adapters';
import { injectViewerContainer, injectStyles } from './injector';
import { createRoot } from 'react-dom/client';
import { App } from '../viewer/App';
import feishuTheme from '../viewer/styles/feishu-theme.css?inline';
import markdownStyles from '../viewer/styles/markdown.css?inline';
import layoutStyles from '../viewer/styles/layout.css?inline';
import scrollbarStyles from '../viewer/styles/scrollbar.css?inline';
import mermaidStyles from '../viewer/styles/mermaid.css?inline';
import editorStyles from '../viewer/styles/editor.css?inline';
import editorMermaidStyles from '../viewer/styles/editor-mermaid.css?inline';
import saveStatusStyles from '../viewer/styles/save-status.css?inline';
import tailwindStyles from '../viewer/styles/tailwind-output.css?inline';
import darkThemeStyles from '../viewer/styles/dark-theme.css?inline';
import printStyles from '../viewer/styles/print.css?inline';
import wysiwygStyles from '../viewer/styles/wysiwyg.css?inline';

const DEV_MESSAGE_SOURCE = 'feishu-md-viewer-devtools';

function installDevReloadBridge(): void {
  window.addEventListener('message', (event) => {
    const data = event.data as { source?: string; type?: string; requestId?: string } | null;
    if (data?.source !== DEV_MESSAGE_SOURCE || data.type !== 'RELOAD_EXTENSION') return;

    void chrome.runtime.sendMessage({ type: 'DEV_RELOAD_EXTENSION' }).then((response) => {
      window.postMessage({
        source: DEV_MESSAGE_SOURCE,
        type: 'RELOAD_EXTENSION_ACK',
        requestId: data.requestId,
        response,
      }, '*');
    }).catch((error: unknown) => {
      window.postMessage({
        source: DEV_MESSAGE_SOURCE,
        type: 'RELOAD_EXTENSION_ACK',
        requestId: data.requestId,
        error: error instanceof Error ? error.message : String(error),
      }, '*');
    });
  });
}

async function main(): Promise<void> {
  installDevReloadBridge();

  const adapter = getActiveAdapter();
  if (!adapter) return;

  const content = await adapter.getContent();
  if (!content) return;

  const source = adapter.name as 'file' | 'github' | 'gitlab';

  const { shadowRoot, mountPoint } = injectViewerContainer();

  injectStyles(shadowRoot, tailwindStyles);
  injectStyles(shadowRoot, feishuTheme);
  injectStyles(shadowRoot, markdownStyles);
  injectStyles(shadowRoot, layoutStyles);
  injectStyles(shadowRoot, scrollbarStyles);
  injectStyles(shadowRoot, mermaidStyles);
  injectStyles(shadowRoot, editorStyles);
  injectStyles(shadowRoot, editorMermaidStyles);
  injectStyles(shadowRoot, saveStatusStyles);
  injectStyles(shadowRoot, darkThemeStyles);
  injectStyles(shadowRoot, printStyles);
  injectStyles(shadowRoot, wysiwygStyles);

  const root = createRoot(mountPoint);
  root.render(<App markdown={content} source={source} />);
}

main();
