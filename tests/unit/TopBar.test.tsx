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
    tocFontSize: 13,
    tocSmoothScrollEnabled: true,
    sidebarDividerVisible: true,
    contentAlignment: 'center',
  });
});

it('阅读页工具栏通过统一设置面板提供正文对齐快捷入口并写入共享设置', () => {
  render(<TopBar title="示例文档" isSidebarOpen onToggleSidebar={() => {}} settingsEnabled />);

  const settingsTrigger = screen.getByRole('button', { name: '打开阅读设置' });
  expect(settingsTrigger).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(settingsTrigger);
  expect(screen.getByRole('dialog', { name: '阅读设置' })).toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: '正文对齐' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitemradio', { name: '正文靠左' }));

  expect(useViewerStore.getState().contentAlignment).toBe('left');
  expect(screen.queryByRole('menu', { name: '正文对齐' })).not.toBeInTheDocument();
});

it('统一设置面板可以切换目录字号，并支持点击外部或 Escape 关闭', () => {
  render(<TopBar title="示例文档" isSidebarOpen onToggleSidebar={() => {}} settingsEnabled />);

  fireEvent.click(screen.getByRole('button', { name: '打开阅读设置' }));
  expect(screen.getByRole('dialog', { name: '阅读设置' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Increase TOC font size' }));
  expect(useViewerStore.getState().tocFontSize).toBe(14);

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: '阅读设置' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '打开阅读设置' }));
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('dialog', { name: '阅读设置' })).not.toBeInTheDocument();
});

it('Shadow DOM 中点击正文对齐选项不会被页面级的点外部监听提前关闭', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadowRoot.appendChild(container);
  document.body.appendChild(host);
  const shadow = within(container);

  render(<TopBar title="示例文档" isSidebarOpen onToggleSidebar={() => {}} settingsEnabled />, {
    container,
  });

  fireEvent.click(shadow.getByRole('button', { name: '打开阅读设置' }));
  fireEvent.click(shadow.getByRole('button', { name: '正文对齐' }));
  fireEvent.mouseDown(shadow.getByRole('menuitemradio', { name: '正文靠左' }));
  fireEvent.click(shadow.getByRole('menuitemradio', { name: '正文靠左' }));

  expect(useViewerStore.getState().contentAlignment).toBe('left');
  host.remove();
});

it('阅读页可以切换目录与正文分隔线显示设置', () => {
  render(<TopBar title="示例文档" isSidebarOpen onToggleSidebar={() => {}} settingsEnabled />);

  fireEvent.click(screen.getByRole('button', { name: '打开阅读设置' }));
  const toggle = screen.getByRole('button', { name: '目录与正文分隔线' });
  expect(toggle).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(toggle);

  expect(useViewerStore.getState().sidebarDividerVisible).toBe(false);
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
