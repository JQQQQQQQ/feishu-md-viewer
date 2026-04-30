/**
 * Injects the React viewer app into the page using ShadowDOM for style isolation.
 * The ShadowDOM approach ensures our Feishu styles don't conflict with host page styles.
 */

export interface InjectionContext {
  shadowRoot: ShadowRoot;
  mountPoint: HTMLElement;
}

export function injectViewerContainer(): InjectionContext {
  // Create the host element for our ShadowDOM
  const hostElement = document.createElement('div');
  hostElement.id = 'feishu-md-viewer-host';
  hostElement.setAttribute('aria-label', 'Feishu Markdown Viewer');

  // Attach shadow DOM with open mode (for debugging accessibility)
  const shadowRoot = hostElement.attachShadow({ mode: 'open' });

  // Create the mount point inside shadow DOM
  const mountPoint = document.createElement('div');
  mountPoint.id = 'feishu-md-viewer-root';
  mountPoint.setAttribute('role', 'main');
  mountPoint.setAttribute('aria-label', 'Markdown document viewer');
  shadowRoot.appendChild(mountPoint);

  // Hide original page content
  hideOriginalContent();

  // Append our host to the document body
  document.body.appendChild(hostElement);

  return { shadowRoot, mountPoint };
}

function hideOriginalContent(): void {
  // Hide ALL existing body children to prevent content from showing twice.
  // For file:// protocol the raw text lives in a <pre>, but other elements
  // (e.g. styling divs, extra nodes injected by browsers) can also appear.
  const children = Array.from(document.body.children);
  for (const child of children) {
    if (child.id === 'feishu-md-viewer-host') continue; // Don't hide our own host
    (child as HTMLElement).style.display = 'none';
  }

  // Reset body margin/padding to avoid layout gaps
  document.body.style.margin = '0';
  document.body.style.padding = '0';
}

export function injectStyles(shadowRoot: ShadowRoot, cssText: string): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = cssText;
  shadowRoot.appendChild(styleElement);
}
