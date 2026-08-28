import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MermaidToolbar } from '@/viewer/components/Mermaid/MermaidToolbar';

const SOURCE = 'flowchart LR\n  A --> B';

function renderToolbar() {
  return render(
    <MermaidToolbar code={SOURCE} blockIndex={2}>
      <div className="feishu-mermaid">
        <svg aria-label="示例流程图" viewBox="0 0 100 40"><path d="M0 0" /></svg>
      </div>
    </MermaidToolbar>,
  );
}

describe('Mermaid 预览专用工具栏', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('保留预览、复制源码和导出，同时不提供编辑入口', async () => {
    renderToolbar();

    expect(screen.getByRole('button', { name: 'Preview Mermaid diagram' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Copy Mermaid source' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Export diagram as SVG' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Export diagram as PNG' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /编辑源码|编辑流程图|Edit Mermaid/i })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Mermaid source' }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(SOURCE);

    fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
    expect(screen.getByRole('dialog', { name: 'Mermaid diagram preview' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Zoom in Mermaid preview' })).not.toBeNull();
  });

  it('滚轮只保留原生画布滚动，不改变预览缩放', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));

    const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
    const canvas = dialog.querySelector('.mermaid-preview-canvas');
    const zoomLabel = dialog.querySelector('.mermaid-preview-toolbar__zoom');
    expect(canvas).not.toBeNull();
    expect(zoomLabel?.textContent).toBe('100%');

    const event = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    canvas?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(zoomLabel?.textContent).toBe('100%');
  });

  it('默认隐藏底部工具栏，热区或工具栏键盘操作显示且不改变画布布局', () => {
    vi.useFakeTimers();
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
    const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
    const toolbar = dialog.querySelector('.mermaid-preview-toolbar');
    const hitArea = dialog.querySelector('.mermaid-preview-bottom-hit-area');
    const canvas = dialog.querySelector('.mermaid-preview-canvas')!;
    const canvasStructure = {
      childCount: canvas.childElementCount,
      childClasses: Array.from(canvas.children).map((child) => child.className),
      className: canvas.className,
      style: canvas.getAttribute('style'),
      contentStyle: canvas.firstElementChild?.getAttribute('style'),
    };
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--hidden');
    expect(hitArea).not.toBeNull();
    fireEvent.pointerEnter(hitArea!);
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--visible');

    fireEvent.pointerLeave(hitArea!);
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--visible');
    fireEvent.pointerEnter(toolbar!);
    vi.advanceTimersByTime(180);
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--visible');
    expect({
      childCount: canvas.childElementCount,
      childClasses: Array.from(canvas.children).map((child) => child.className),
      className: canvas.className,
      style: canvas.getAttribute('style'),
      contentStyle: canvas.firstElementChild?.getAttribute('style'),
    }).toEqual(canvasStructure);

    fireEvent.pointerLeave(toolbar!);
    act(() => { vi.advanceTimersByTime(180); });
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--hidden');
    fireEvent.keyDown(toolbar!, { key: 'Enter' });
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--visible');
  });

  it('只在按住空格时进入画布平移状态，并正确处理指针与滚轮事件', () => {
    vi.useFakeTimers();
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas')!;
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => true);
    Object.assign(canvas, { setPointerCapture, releasePointerCapture, hasPointerCapture });
    let scrollLeft = 200;
    let scrollTop = 200;
    Object.defineProperties(canvas, {
      clientWidth: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 160 },
      scrollWidth: { configurable: true, value: 800 },
      scrollHeight: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value; } },
      scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } },
    });
    const normalDown = createEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent(canvas, normalDown);
    expect(normalDown.defaultPrevented).toBe(false);
    expect(setPointerCapture).not.toHaveBeenCalled();
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 60 });
    expect(canvas.scrollLeft).toBe(200);
    expect(canvas.scrollTop).toBe(200);
    expect(canvas).not.toHaveClass('mermaid-preview-canvas--space-pan');
    fireEvent.keyDown(window, { key: ' ' });
    expect(canvas).toHaveClass('mermaid-preview-canvas--space-pan');
    const spaceDown = createEvent.pointerDown(canvas, { button: 0, pointerId: 2, clientX: 10, clientY: 10 });
    fireEvent(canvas, spaceDown);
    expect(spaceDown.defaultPrevented).toBe(true);
    expect(setPointerCapture).toHaveBeenCalledWith(2);
    expect(canvas).toHaveClass('mermaid-preview-canvas--dragging');
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 50, clientY: 60 });
    expect(canvas.scrollLeft).toBe(160);
    expect(canvas.scrollTop).toBe(150);
    fireEvent.pointerUp(canvas, { button: 0, pointerId: 2 });
    expect(releasePointerCapture).toHaveBeenCalledWith(2);
    expect(canvas).not.toHaveClass('mermaid-preview-canvas--dragging');
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 3, clientX: 10, clientY: 10 });
    fireEvent.pointerCancel(canvas, { pointerId: 3 });
    expect(canvas).not.toHaveClass('mermaid-preview-canvas--dragging');
    fireEvent.keyUp(window, { key: ' ' });
    expect(canvas).not.toHaveClass('mermaid-preview-canvas--space-pan');

    const zoomLabel = screen.getByRole('dialog').querySelector('.mermaid-preview-toolbar__zoom');
    const zoomBefore = zoomLabel?.textContent;
    const scrollLeftBefore = canvas.scrollLeft;
    const scrollTopBefore = canvas.scrollTop;
    fireEvent.wheel(canvas, { deltaY: 80, shiftKey: false });
    expect(canvas.scrollTop).toBe(scrollTopBefore + 80);
    expect(zoomLabel?.textContent).toBe(zoomBefore);
    fireEvent.wheel(canvas, { deltaY: 80, shiftKey: true });
    expect(canvas.scrollLeft).toBeGreaterThan(scrollLeftBefore);
    expect(zoomLabel?.textContent).toBe(zoomBefore);
    vi.useRealTimers();
  });

  it('canvas、dialog 和 toolbar 点击不关闭，Esc 与遮罩点击关闭并恢复焦点', async () => {
    renderToolbar();
    const previewButton = screen.getByRole('button', { name: 'Preview Mermaid diagram' });
    fireEvent.click(previewButton);
    let dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
    fireEvent.click(dialog.querySelector('.mermaid-preview-canvas')!);
    fireEvent.click(dialog.querySelector('.mermaid-preview-dialog')!);
    fireEvent.click(dialog.querySelector('.mermaid-preview-toolbar')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(previewButton).toHaveFocus());

    fireEvent.click(previewButton);
    dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(previewButton).toHaveFocus());
  });
});

describe('Mermaid 预览版源码写回清理', () => {
  it('不再保留 Mermaid 源码替换工具', () => {
    const sourceFile = join(process.cwd(), 'src/viewer/utils/mermaid-writeback.ts');

    expect(existsSync(sourceFile)).toBe(false);
  });
});
