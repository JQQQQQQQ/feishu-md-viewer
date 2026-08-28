import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { MermaidPreviewModal } from '@/viewer/components/Mermaid/MermaidPreviewModal';
import { MermaidToolbar } from '@/viewer/components/Mermaid/MermaidToolbar';

const SOURCE = 'flowchart LR\n  A --> B';
const SVG = '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>';

function renderToolbar() {
  return render(
    <MermaidToolbar code={SOURCE} blockIndex={2}>
      <div className="feishu-mermaid">
        <svg aria-label="示例流程图" viewBox="0 0 100 40"><path d="M0 0" /></svg>
      </div>
    </MermaidToolbar>,
  );
}

class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Mermaid 预览 Task 2 复审回归', () => {
  it('工具栏焦点未移出时，pointerLeave 后 180ms 仍保持可见；焦点移出后才隐藏', () => {
    vi.useFakeTimers();
    renderToolbar();
    const previewButton = screen.getByRole('button', { name: 'Preview Mermaid diagram' });
    fireEvent.click(previewButton);

    const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
    const toolbar = dialog.querySelector('.mermaid-preview-toolbar')!;
    const zoomInButton = screen.getByRole('button', { name: 'Zoom in Mermaid preview' });

    act(() => { vi.advanceTimersByTime(20); });
    fireEvent.pointerEnter(toolbar);
    zoomInButton.focus();
    fireEvent.pointerLeave(toolbar);
    act(() => { vi.advanceTimersByTime(180); });
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--visible');

    previewButton.focus();
    act(() => { vi.advanceTimersByTime(180); });
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--hidden');
  });

  it('Escape 关闭前显式释放活跃 pointer capture 并清理拖拽状态', () => {
    const onClose = vi.fn();
    render(<MermaidPreviewModal svg={SVG} onClose={onClose} />);

    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas')!;
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => true);
    Object.assign(canvas, { setPointerCapture, releasePointerCapture, hasPointerCapture });

    fireEvent.keyDown(window, { key: ' ' });
    const pointerDown = createEvent.pointerDown(canvas, { button: 0, pointerId: 7, clientX: 20, clientY: 20 });
    fireEvent(canvas, pointerDown);
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(canvas).toHaveClass('mermaid-preview-canvas--dragging');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(canvas).not.toHaveClass('mermaid-preview-canvas--dragging');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
