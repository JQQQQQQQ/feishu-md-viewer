import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { App } from '@/viewer/App';
import { useViewerStore } from '@/viewer/store';

const DOCUMENT = '# 预览文档\n\n这是只读正文。';

function renderAppWithLegacyMode() {
  useViewerStore.setState({
    content: DOCUMENT,
    originalContent: DOCUMENT,
    mode: 'read',
    theme: 'light',
    fontSize: 15,
    contentAlignment: 'center',
    settingsHydrated: false,
  });

  return render(<App markdown={DOCUMENT} source="file" />);
}

function renderApp() {
  useViewerStore.setState({
    content: DOCUMENT,
    originalContent: DOCUMENT,
    mode: 'read',
    theme: 'light',
    fontSize: 15,
    contentAlignment: 'center',
    settingsHydrated: false,
  });

  return render(<App markdown={DOCUMENT} source="file" />);
}

describe('预览专用 App 入口', () => {
  beforeEach(() => {
    cleanup();
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

  it('即使存储中有旧内容，仍只渲染传入的 Markdown 阅读视图', () => {
      renderAppWithLegacyMode();

      expect(screen.getByRole('heading', { name: /预览文档/ })).not.toBeNull();
      expect(screen.queryByLabelText('Markdown 源码编辑器')).toBeNull();
      expect(screen.queryByText('编辑器加载中...')).toBeNull();
      expect(screen.queryByText('源码编辑器加载中...')).toBeNull();
  });

  it('不提供编辑、源码或保存控件', () => {
    renderAppWithLegacyMode();

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
  });

  it('Chrome 兼容包装器显式启用阅读设置控件', () => {
    renderApp();

    expect(screen.getByRole('navigation', { name: 'Table of contents' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Decrease font size' }));
    expect(screen.getByText('14')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Theme: light/ }));
    expect(screen.getByRole('button', { name: /Theme: dark/ })).not.toBeNull();
  });

  it('阅读页快捷对齐菜单会立即更新完整预览的布局状态', () => {
    renderApp();
    const article = screen.getByRole('article', { name: 'Rendered markdown document' });

    expect(article.classList.contains('feishu-viewer--content-center')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '正文对齐' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '正文靠左' }));

    expect(article.classList.contains('feishu-viewer--content-left')).toBe(true);
    expect(article.classList.contains('feishu-viewer--content-center')).toBe(false);
  });

  it('本地文件更新时显示非打断式局部刷新提示', () => {
    const onRefresh = vi.fn();
    render(<App markdown={DOCUMENT} source="file" contentUpdateAvailable onRefreshContent={onRefresh} />);

    expect(screen.getByRole('status')).toHaveTextContent('Markdown 文件已更新');
    fireEvent.click(screen.getByRole('button', { name: '立即刷新' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

});
