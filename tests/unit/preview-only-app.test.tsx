import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const hookSpies = vi.hoisted(() => ({
  useAutoSave: vi.fn(),
  useFileAccess: vi.fn(),
}));

vi.mock('@/viewer/hooks/useAutoSave', () => ({
  useAutoSave: hookSpies.useAutoSave,
}));

vi.mock('@/viewer/hooks/useFileAccess', () => ({
  useFileAccess: hookSpies.useFileAccess,
}));

import { App } from '@/viewer/App';
import { useViewerStore } from '@/viewer/store';

const DOCUMENT = '# 预览文档\n\n这是只读正文。';

function renderAppWithLegacyMode(mode: 'edit' | 'source') {
  useViewerStore.setState({
    content: DOCUMENT,
    originalContent: DOCUMENT,
    isDirty: false,
    mode,
    previewLockEnabled: false,
    theme: 'light',
    fontSize: 15,
  });

  return render(<App markdown={DOCUMENT} source="file" />);
}

function renderApp() {
  useViewerStore.setState({
    content: DOCUMENT,
    originalContent: DOCUMENT,
    isDirty: false,
    mode: 'read',
    previewLockEnabled: false,
    theme: 'light',
    fontSize: 15,
  });

  return render(<App markdown={DOCUMENT} source="file" />);
}

describe('预览专用 App 入口', () => {
  beforeEach(() => {
    cleanup();
    hookSpies.useAutoSave.mockReset();
    hookSpies.useFileAccess.mockReset();
    hookSpies.useAutoSave.mockReturnValue({
      lastSaved: null,
      isSaving: false,
      error: null,
    });
    hookSpies.useFileAccess.mockReturnValue({
      fileHandle: null,
      error: null,
      isSupported: false,
      requestFileHandle: vi.fn(),
      saveToHandle: vi.fn(),
      downloadFallback: vi.fn(),
      restoreHandle: vi.fn(),
      persistHandle: vi.fn(),
      setFileHandle: vi.fn(),
      clearError: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
      },
    });
  });

  it.each(['edit', 'source'] as const)(
    '即使遗留模式为 %s，仍只渲染 Markdown 阅读视图',
    (legacyMode) => {
      renderAppWithLegacyMode(legacyMode);

      expect(screen.getByRole('heading', { name: /预览文档/ })).not.toBeNull();
      expect(screen.queryByLabelText('Markdown 源码编辑器')).toBeNull();
      expect(screen.queryByText('编辑器加载中...')).toBeNull();
      expect(screen.queryByText('源码编辑器加载中...')).toBeNull();
    },
  );

  it('不提供编辑、源码或保存控件', () => {
    renderAppWithLegacyMode('edit');

    expect(screen.queryByRole('button', { name: /编辑|阅读/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /源码/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
    expect(screen.queryByText(/已保存|保存中|未保存|保存失败/)).toBeNull();
  });

  it('双击正文后仍保持阅读态', () => {
    renderApp();

    fireEvent.doubleClick(screen.getByText('这是只读正文。'));

    expect(useViewerStore.getState().mode).toBe('read');
    expect(screen.getByRole('article', { name: 'Rendered markdown document' }).getAttribute('data-mode')).toBe('read');
  });

  it.each([
    ['Ctrl+S', { ctrlKey: true }],
    ['Cmd+S', { metaKey: true }],
  ])('%s 不被 App 拦截或写回', (_shortcut, modifiers) => {
    renderApp();
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 's',
      ...modifiers,
    });

    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(hookSpies.useFileAccess).not.toHaveBeenCalled();
    expect(hookSpies.useAutoSave).not.toHaveBeenCalled();
  });

  it('挂载时不初始化文件访问或自动保存，并保留阅读控件', () => {
    renderApp();

    expect(hookSpies.useFileAccess).not.toHaveBeenCalled();
    expect(hookSpies.useAutoSave).not.toHaveBeenCalled();
    expect(screen.getByRole('navigation', { name: 'Table of contents' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Decrease font size' }));
    expect(screen.getByText('14')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Theme: light/ }));
    expect(screen.getByRole('button', { name: /Theme: dark/ })).not.toBeNull();
  });
});
