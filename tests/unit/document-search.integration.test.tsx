import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownReadView } from '@/viewer/components/Markdown/MarkdownReadView';
import { useViewerStore } from '@/viewer/store';

const scrollIntoView = vi.fn();

describe('阅读页文档搜索', () => {
  beforeEach(() => {
    scrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    useViewerStore.setState({ tocSmoothScrollEnabled: false });
  });

  it('打开搜索后高亮正文命中、支持跳转并在关闭时清理高亮', () => {
    const view = render(<MarkdownReadView content={'# Alpha\n\nAlpha beta alpha'} />);

    fireEvent.click(screen.getByRole('button', { name: '打开文档搜索' }));
    const input = screen.getByRole('textbox', { name: '搜索文档' });
    fireEvent.change(input, { target: { value: 'alpha' } });

    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(view.container.querySelectorAll('.feishu-search-mark')).toHaveLength(3);
    expect(view.container.querySelector('.feishu-search-mark--active')).not.toBeNull();
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'auto',
      block: 'center',
      inline: 'nearest',
    });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(view.container.querySelectorAll('.feishu-search-mark')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '打开文档搜索' })).toBeInTheDocument();
  });

  it('使用 Ctrl/Cmd + F 打开项目内搜索而不是浏览器原生查找', () => {
    render(<MarkdownReadView content={'# Title\n\nSearchable content'} />);

    const event = fireEvent.keyDown(document, { key: 'f', ctrlKey: true, cancelable: true });

    expect(event).toBe(false);
    expect(screen.getByRole('textbox', { name: '搜索文档' })).toBeInTheDocument();
  });
});
