import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TopBar } from '@/viewer/components/Layout/TopBar';
import { useViewerStore } from '@/viewer/store';

afterEach(cleanup);

beforeEach(() => {
  useViewerStore.setState({
    theme: 'system',
    fontSize: 15,
    tocSmoothScrollEnabled: true,
  });
});

it('阅读页工具栏提供正文对齐快捷入口并写入共享设置', () => {
  render(
    <TopBar
      title="示例文档"
      isSidebarOpen
      onToggleSidebar={() => {}}
      settingsEnabled
    />,
  );

  const trigger = screen.getByRole('button', { name: '正文对齐' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitemradio', { name: '正文靠左' }));

  expect(useViewerStore.getState().contentAlignment).toBe('left');
  expect(screen.queryByRole('menu', { name: '正文对齐' })).not.toBeInTheDocument();
});

it('Shadow DOM 中点击正文对齐选项不会被页面级的点外部监听提前关闭', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadowRoot.appendChild(container);
  document.body.appendChild(host);
  const shadow = within(container);

  render(
    <TopBar
      title="示例文档"
      isSidebarOpen
      onToggleSidebar={() => {}}
      settingsEnabled
    />,
    { container },
  );

  fireEvent.click(shadow.getByRole('button', { name: '正文对齐' }));
  fireEvent.mouseDown(shadow.getByRole('menuitemradio', { name: '正文靠左' }));
  fireEvent.click(shadow.getByRole('menuitemradio', { name: '正文靠左' }));

  expect(useViewerStore.getState().contentAlignment).toBe('left');
  host.remove();
});
