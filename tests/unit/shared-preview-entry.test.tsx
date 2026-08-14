import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { PreviewRoot } from '@/viewer/PreviewRoot';

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
