import { getActiveAdapter } from './adapters';
import { FileAdapter } from './adapters/file-adapter';
import { injectViewerContainer, injectStyles } from './injector';
import { createLocalFileChangeMonitor, type LocalFileChangeMonitor } from './file-change-monitor';
import { capturePreviewViewport, restorePreviewViewport } from './preview-viewport';
import { createRoot } from 'react-dom/client';
import { App } from '../viewer/App';
import { useViewerStore } from '../viewer/store';
import feishuTheme from '../viewer/styles/feishu-theme.css?inline';
import markdownStyles from '../viewer/styles/markdown.css?inline';
import layoutStyles from '../viewer/styles/layout.css?inline';
import scrollbarStyles from '../viewer/styles/scrollbar.css?inline';
import mermaidStyles from '../viewer/styles/mermaid.css?inline';
import tailwindStyles from '../viewer/styles/tailwind-output.css?inline';
import darkThemeStyles from '../viewer/styles/dark-theme.css?inline';
import printStyles from '../viewer/styles/print.css?inline';

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
  if (content === null) return;

  // Hydrate the persisted mode before starting the polling loop. Otherwise a
  // fast first poll can observe the store's default `prompt` value even when
  // the user selected automatic replacement in the options page.
  await useViewerStore.getState().loadSettings();

  const source = adapter.name as 'file' | 'github' | 'gitlab';

  const { shadowRoot, mountPoint } = injectViewerContainer();

  injectStyles(shadowRoot, tailwindStyles);
  injectStyles(shadowRoot, feishuTheme);
  injectStyles(shadowRoot, markdownStyles);
  injectStyles(shadowRoot, layoutStyles);
  injectStyles(shadowRoot, scrollbarStyles);
  injectStyles(shadowRoot, mermaidStyles);
  injectStyles(shadowRoot, darkThemeStyles);
  injectStyles(shadowRoot, printStyles);

  const root = createRoot(mountPoint);
  let currentContent = content;
  let contentUpdateAvailable = false;
  let contentUpdateRefreshing = false;
  // Keep the content delivered by the change monitor. A second file read
  // triggered by the manual button can briefly return an empty response while
  // Chromium is updating a file:// document; using the observed snapshot is
  // both fresher and avoids clearing a working preview.
  let pendingContent: string | null = null;
  let monitor: LocalFileChangeMonitor | undefined;

  const handleStorageChanged = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'local') return;
    const newSettings = changes.viewerSettings?.newValue as { localFileRefreshMode?: unknown } | undefined;
    if (!newSettings) return;

    // The options page runs in a separate JS context. Sync only the setting
    // needed by the already-open content page without persisting it again.
    useViewerStore.setState({
      localFileRefreshMode: newSettings.localFileRefreshMode === 'auto' ? 'auto' : 'prompt',
      settingsHydrated: true,
    });
  };

  const renderApp = () => {
    root.render(
      <App
        markdown={currentContent}
        source={source}
        contentUpdateAvailable={contentUpdateAvailable}
        contentUpdateRefreshing={contentUpdateRefreshing}
        onRefreshContent={source === 'file' ? refreshContent : undefined}
      />,
    );
  };

  const refreshContent = async (detectedContent?: string) => {
    if (!(adapter instanceof FileAdapter) || contentUpdateRefreshing) return;

    // Capture before the asynchronous file read so a short read delay cannot
    // turn a user's scroll into the new restore position.
    const viewport = capturePreviewViewport(shadowRoot);
    contentUpdateRefreshing = true;
    renderApp();
    const nextContent = detectedContent ?? pendingContent ?? await adapter.getFreshContent();
    if (typeof nextContent === 'string' && nextContent.trim().length > 0) {
      const contentChanged = nextContent !== currentContent;
      currentContent = nextContent;
      pendingContent = null;
      contentUpdateAvailable = false;
      monitor?.setBaseline(nextContent);
      renderApp();

      if (contentChanged) {
        const restore = () => restorePreviewViewport(shadowRoot, viewport);
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(restore);
        } else {
          restore();
        }
      }
    }

    contentUpdateRefreshing = false;
    renderApp();
  };

  renderApp();

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChanged);
    window.addEventListener('beforeunload', () => {
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    }, { once: true });
  }

  if (adapter instanceof FileAdapter) {
    monitor = createLocalFileChangeMonitor({
      initialContent: content,
      readCurrent: () => adapter.getFreshContent(),
      onChanged: (nextContent) => {
        pendingContent = nextContent;
        if (useViewerStore.getState().localFileRefreshMode === 'auto') {
          void refreshContent(nextContent);
          return;
        }

        contentUpdateAvailable = true;
        renderApp();
      },
    });
    monitor.start();
    window.addEventListener('beforeunload', monitor.stop, { once: true });
  }
}

main();
