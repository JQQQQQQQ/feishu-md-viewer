/**
 * Background service worker for Feishu MD Viewer.
 * Handles context menu registration, message passing, and settings persistence.
 */

import { isAllowedUrl } from '@/shared/utils/url-validation';

const CONTEXT_MENU_ID = 'open-in-feishu-viewer';

interface ViewerSettings {
  theme: 'light' | 'dark' | 'auto';
  sidebarDefault: boolean;
  autoRender: boolean;
}

const DEFAULT_SETTINGS: ViewerSettings = {
  theme: 'auto',
  sidebarDefault: true,
  autoRender: true,
};

/**
 * Opens the extension viewer page with the given markdown URL.
 */
function openViewer(url: string): void {
  const viewerUrl = chrome.runtime.getURL(
    `src/viewer/viewer.html?url=${encodeURIComponent(url)}`
  );
  void chrome.tabs.create({ url: viewerUrl });
}

/**
 * Register context menu on extension install/update.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Open in Feishu Viewer',
    contexts: ['link'],
    targetUrlPatterns: [
      'file:///*/*.md',
      'file:///*/*.markdown',
      '*://github.com/*/*/blob/*/*.md',
      '*://github.com/*/*/blob/*/*.markdown',
      '*://gitlab.com/*/*/-/blob/*/*.md',
      '*://gitlab.com/*/*/-/blob/*/*.markdown',
      '*://raw.githubusercontent.com/*/*.md',
      '*://raw.githubusercontent.com/*/*.markdown',
    ],
  });

  // Initialize default settings
  void chrome.storage.local.get('settings').then((result) => {
    if (!result['settings']) {
      void chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
  });
});

/**
 * Handle context menu click events.
 */
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const linkUrl = info.linkUrl;
  if (!linkUrl) return;

  if (!isAllowedUrl(linkUrl)) return;

  openViewer(linkUrl);
});

/**
 * Handle messages from content scripts and viewer pages.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message as { type: string; url?: string; settings?: Partial<ViewerSettings> };

  switch (msg.type) {
    case 'OPEN_VIEWER': {
      const url = msg.url;
      if (url && isAllowedUrl(url)) {
        openViewer(url);
      }
      sendResponse({ success: true });
      break;
    }

    case 'GET_SETTINGS': {
      void chrome.storage.local.get('settings').then((result) => {
        const settings = (result['settings'] as ViewerSettings | undefined) ?? DEFAULT_SETTINGS;
        sendResponse({ settings });
      });
      return true; // Keep message channel open for async response
    }

    case 'UPDATE_SETTINGS': {
      const updates = msg.settings;
      if (updates) {
        void chrome.storage.local.get('settings').then((result) => {
          const current = (result['settings'] as ViewerSettings | undefined) ?? DEFAULT_SETTINGS;
          const merged = { ...current, ...updates };
          void chrome.storage.local.set({ settings: merged }).then(() => {
            sendResponse({ settings: merged });
          });
        });
      }
      return true; // Keep message channel open for async response
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return undefined;
});
