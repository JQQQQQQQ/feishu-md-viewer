import { describe, expect, it, vi } from 'vitest';
import { resolveTablePointerIntent } from '@/viewer/components/Markdown/table-pointer-intent';

function setupTable(inShadowRoot = false) {
  const wrapper = document.createElement('div');
  const table = document.createElement('table');
  const cell = document.createElement('td');
  cell.textContent = '可复制的文字';
  table.appendChild(cell);
  wrapper.appendChild(table);
  if (inShadowRoot) {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    shadowRoot.appendChild(wrapper);
    document.body.appendChild(host);
  } else {
    document.body.appendChild(wrapper);
  }
  return { wrapper, cell };
}

describe('table pointer intent', () => {
  function setVsCodeWebview(enabled: boolean) {
    if (enabled) {
      Object.defineProperty(window, 'acquireVsCodeApi', {
        configurable: true,
        value: () => ({ postMessage: () => undefined }),
      });
    } else {
      delete (window as Window & { acquireVsCodeApi?: unknown }).acquireVsCodeApi;
    }
  }

  function mockCaretResult(result: Range | null) {
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => result,
    });
  }

  it('treats a caret hit inside cell text as native text selection', () => {
    const { wrapper, cell } = setupTable();
    mockCaretResult({ commonAncestorContainer: cell.firstChild } as Range);

    expect(resolveTablePointerIntent(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }), wrapper, cell)).toBe('text');
  });

  it('treats a browser caret container that resolves to the cell as native text selection', () => {
    const { wrapper, cell } = setupTable();
    mockCaretResult({ commonAncestorContainer: cell } as Range);

    expect(resolveTablePointerIntent(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }), wrapper, cell)).toBe('text');
  });

  it('does not hijack a populated cell when the caret API cannot resolve a point', () => {
    const { wrapper, cell } = setupTable(true);
    Object.defineProperty(document, 'caretRangeFromPoint', { configurable: true, value: undefined });
    Object.defineProperty(document, 'caretPositionFromPoint', { configurable: true, value: undefined });
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [{ left: 0, right: 100, top: 0, bottom: 20 }],
    });

    expect(resolveTablePointerIntent(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }), wrapper, cell)).toBe('text');
  });

  it('keeps links and buttons in the interactive path', () => {
    const { wrapper, cell } = setupTable();
    const link = document.createElement('a');
    link.href = '#copy';
    link.textContent = '链接';
    cell.replaceChildren(link);

    expect(resolveTablePointerIntent(new MouseEvent('mousedown'), wrapper, cell, link)).toBe('interactive');
  });

  it('keeps an empty cell available for Excel-style range selection', () => {
    const { wrapper, cell } = setupTable();
    cell.textContent = '';
    mockCaretResult(null);

    expect(resolveTablePointerIntent(new MouseEvent('mousedown'), wrapper, cell)).toBe('cell-range');
  });

  it('uses cell-range selection for a single text click in a VS Code Webview', () => {
    const { wrapper, cell } = setupTable();
    setVsCodeWebview(true);
    mockCaretResult({ commonAncestorContainer: cell.firstChild } as Range);

    expect(resolveTablePointerIntent(new MouseEvent('mousedown', { detail: 1 }), wrapper, cell)).toBe('cell-range');

    setVsCodeWebview(false);
  });

  it('keeps double-click text selection available in a VS Code Webview', () => {
    const { wrapper, cell } = setupTable();
    setVsCodeWebview(true);
    mockCaretResult({ commonAncestorContainer: cell.firstChild } as Range);

    expect(resolveTablePointerIntent(new MouseEvent('mousedown', { detail: 2 }), wrapper, cell)).toBe('text');

    setVsCodeWebview(false);
  });
});
