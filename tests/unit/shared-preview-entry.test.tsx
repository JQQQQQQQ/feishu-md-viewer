import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { PreviewRoot } from '@/viewer/PreviewRoot';
import { useViewerStore } from '@/viewer/store';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
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

it('renders the same read-only document contract without a browser URL', () => {
  render(<PreviewRoot markdown="# 标题" source="file" />);

  expect(screen.getByRole('article')).toHaveAttribute('data-mode', 'read');
  expect(screen.getByRole('article')).toHaveClass('feishu-viewer--content-center');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('does not expose persistent settings controls by default', () => {
  render(<PreviewRoot markdown="# 标题" source="file" />);

  expect(screen.queryByRole('group', { name: 'Font size controls' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Theme:/ })).not.toBeInTheDocument();
});

it('keeps a VS Code themed preview read-only without persistent settings controls', () => {
  render(
    <PreviewRoot
      markdown="# 标题"
      source="file"
      themeOverride="dark"
      settingsEnabled={false}
    />
  );

  expect(screen.getByRole('article')).toHaveClass('feishu-viewer--dark');
  expect(screen.getByRole('article')).toHaveAttribute('data-mode', 'read');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Font size controls' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Theme:/ })).not.toBeInTheDocument();
});

it('字号设置变化会更新阅读根节点的正文字号变量', () => {
  useViewerStore.setState({ fontSize: 15 });
  render(<PreviewRoot markdown="正文" source="file" />);

  const article = screen.getByRole('article');
  expect(article).toHaveStyle('--feishu-font-size-body: 15px');

  act(() => useViewerStore.setState({ fontSize: 20 }));

  expect(article).toHaveStyle('--feishu-font-size-body: 20px');
});
