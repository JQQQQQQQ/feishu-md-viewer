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
  // For file:// protocol, hide the <pre> element that contains raw text
  const preElement = document.querySelector('pre');
  if (preElement) {
    preElement.style.display = 'none';
  }

  // For GitHub/GitLab, we overlay on top rather than hide
  // This preserves the site navigation
}

export function injectStyles(shadowRoot: ShadowRoot, cssText: string): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = cssText;
  shadowRoot.appendChild(styleElement);
}
