import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MermaidPreviewModal } from '@/viewer/components/Mermaid/MermaidPreviewModal';
import { MermaidToolbar } from '@/viewer/components/Mermaid/MermaidToolbar';

const SOURCE = 'flowchart LR\n  A --> B';
const WHEEL_LINE_HEIGHT = 16;

class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

function emulateNativeVerticalCanvasScroll(canvas: HTMLDivElement): void {
  canvas.addEventListener('wheel', (event) => {
    if (!event.shiftKey) canvas.scrollTop += event.deltaY;
  });
}

function renderToolbar() {
  return render(
    <MermaidToolbar code={SOURCE} blockIndex={2}>
      <div className="feishu-mermaid">
        <svg aria-label="示例流程图" viewBox="0 0 100 40"><path d="M0 0" /></svg>
      </div>
    </MermaidToolbar>,
  );
}

function deferAnimationFrames() {
  const callbacks = new Map<number, FrameRequestCallback>();
  const allCallbacks = new Map<number, FrameRequestCallback>();
  let frameId = 0;

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameId += 1;
    callbacks.set(frameId, callback);
    allCallbacks.set(frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    callbacks.delete(id);
  });

  return {
    flush() {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      pending.forEach(([, callback]) => callback(0));
    },
    pending() {
      return callbacks.size;
    },
    latestId() {
      return frameId;
    },
    run(id: number) {
      callbacks.delete(id);
      allCallbacks.get(id)?.(0);
    },
  };
}

function stubCanvasLayout(width: number, height: number, scrollWidth: number, scrollHeight: number) {
  return [
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      return this.classList.contains('mermaid-preview-canvas') ? width : 0;
    }),
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () {
      return this.classList.contains('mermaid-preview-canvas') ? height : 0;
    }),
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
      return this.classList.contains('mermaid-preview-canvas') ? scrollWidth : 0;
    }),
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
      return this.classList.contains('mermaid-preview-canvas') ? scrollHeight : 0;
    }),
  ];
}

describe('Mermaid 预览专用工具栏', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.stubGlobal('PointerEvent', TestPointerEvent);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it('首次布局前隐藏画布，使用 viewBox 计算宽图 D2 缩放并从安全起点显示', () => {
    const frames = deferAnimationFrames();
    stubCanvasLayout(400, 300, 1000, 700);
    render(
      <MermaidPreviewModal
        svg={'<svg viewBox="0 0 1200 120" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'}
        onClose={vi.fn()}
      />,
    );

    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas') as HTMLDivElement;
    let scrollLeft = 160;
    let scrollTop = 80;
    Object.defineProperties(canvas, {
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value; } },
      scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } },
    });

    expect(canvas).toHaveAttribute('aria-busy', 'true');
    act(() => frames.flush());

    expect(canvas).not.toHaveAttribute('aria-busy');
    expect(canvas.querySelector('.mermaid-preview-content')).toHaveStyle({ width: 'max(100%, 900px)' });
    expect(scrollLeft).toBe(0);
    expect(scrollTop).toBe(0);
  });

  it('在初始布局帧前点击适应也会完成定位并显示最终画布', () => {
    const frames = deferAnimationFrames();
    stubCanvasLayout(400, 300, 1000, 700);
    render(
      <MermaidPreviewModal
        svg={'<svg viewBox="0 0 1200 120" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'}
        onClose={vi.fn()}
      />,
    );

    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas') as HTMLDivElement;
    expect(canvas).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Fit Mermaid preview to window' }));
    act(() => frames.flush());

    expect(canvas).not.toHaveAttribute('aria-busy');
    expect(canvas.querySelector('.mermaid-preview-content')).toHaveStyle({ width: 'max(100%, 900px)' });
  });

  it('超长图首次打开和点击适应都保留至少 75% 的 D2 缩放与安全起点', () => {
    const frames = deferAnimationFrames();
    stubCanvasLayout(400, 300, 700, 1400);
    render(
      <MermaidPreviewModal
        svg={'<svg viewBox="0 0 120 1200" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'}
        onClose={vi.fn()}
      />,
    );

    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas') as HTMLDivElement;
    let scrollLeft = 150;
    let scrollTop = 500;
    Object.defineProperties(canvas, {
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value; } },
      scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } },
    });

    act(() => frames.flush());
    expect(canvas.querySelector('.mermaid-preview-content')).toHaveStyle({ height: 'max(100%, 900px)' });
    expect(scrollLeft).toBe(0);
    expect(scrollTop).toBe(0);

    scrollLeft = 160;
    scrollTop = 640;
    fireEvent.click(screen.getByRole('button', { name: 'Fit Mermaid preview to window' }));
    act(() => frames.flush());
    expect(canvas.querySelector('.mermaid-preview-content')).toHaveStyle({ height: 'max(100%, 900px)' });
    expect(scrollLeft).toBe(0);
    expect(scrollTop).toBe(0);
  });

  it('短图首次打开和点击适应都完整居中', () => {
    const frames = deferAnimationFrames();
    stubCanvasLayout(400, 300, 800, 600);
    render(
      <MermaidPreviewModal
        svg={'<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'}
        onClose={vi.fn()}
      />,
    );

    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas') as HTMLDivElement;
    let scrollLeft = 0;
    let scrollTop = 0;
    Object.defineProperties(canvas, {
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value; } },
      scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } },
    });

    act(() => frames.flush());
    expect(scrollLeft).toBe(200);
    expect(scrollTop).toBe(150);

    scrollLeft = 0;
    scrollTop = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Fit Mermaid preview to window' }));
    act(() => frames.flush());
    expect(scrollLeft).toBe(200);
    expect(scrollTop).toBe(150);
  });

  it('100% 恢复实际尺寸后在一个可取消的布局帧内回到宽图安全起点', () => {
    const frames = deferAnimationFrames();
    stubCanvasLayout(400, 300, 1240, 800);
    render(
      <MermaidPreviewModal
        svg={'<svg viewBox="0 0 1200 120" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'}
        onClose={vi.fn()}
      />,
    );

    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas') as HTMLDivElement;
    let scrollLeft = 0;
    let scrollTop = 0;
    Object.defineProperties(canvas, {
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value; } },
      scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } },
    });
    act(() => frames.flush());
    scrollLeft = 320;
    scrollTop = 120;

    fireEvent.click(screen.getByRole('button', { name: 'Reset Mermaid preview to actual size' }));

    expect(frames.pending()).toBe(1);
    expect(scrollLeft).toBe(320);
    expect(scrollTop).toBe(120);
    act(() => frames.flush());
    expect(scrollLeft).toBe(0);
    expect(scrollTop).toBe(0);
  });

  it('连续按钮缩放只保留最后一个滚动同步帧', () => {
    const frames = deferAnimationFrames();
    stubCanvasLayout(400, 300, 1200, 900);
    render(
      <MermaidPreviewModal
        svg={'<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'}
        onClose={vi.fn()}
      />,
    );

    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas') as HTMLDivElement;
    Object.defineProperties(canvas, {
      scrollLeft: { configurable: true, writable: true, value: 180 },
      scrollTop: { configurable: true, writable: true, value: 120 },
    });
    act(() => frames.flush());

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in Mermaid preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in Mermaid preview' }));

    expect(frames.pending()).toBe(1);
    act(() => frames.flush());
    expect(screen.getByRole('dialog').querySelector('.mermaid-preview-toolbar__zoom')).toHaveTextContent('108%');
  });

  it('关闭或卸载后即使旧 RAF 被调用也不会写入画布滚动位置', () => {
    const frames = deferAnimationFrames();
    stubCanvasLayout(400, 300, 1200, 900);
    const onClose = vi.fn();
    const view = render(
      <MermaidPreviewModal
        svg={'<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'}
        onClose={onClose}
      />,
    );

    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas') as HTMLDivElement;
    let scrollLeft = 180;
    let scrollTop = 120;
    Object.defineProperties(canvas, {
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value; } },
      scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } },
    });
    act(() => frames.flush());
    scrollLeft = 180;
    scrollTop = 120;

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in Mermaid preview' }));
    const closeFrame = frames.latestId();
    fireEvent.click(screen.getByRole('button', { name: 'Close Mermaid preview' }));
    act(() => frames.run(closeFrame));
    expect(onClose).toHaveBeenCalledOnce();
    expect(scrollLeft).toBe(180);
    expect(scrollTop).toBe(120);

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in Mermaid preview' }));
    const unmountFrame = frames.latestId();
    view.unmount();
    act(() => frames.run(unmountFrame));
    expect(scrollLeft).toBe(180);
    expect(scrollTop).toBe(120);
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
    emulateNativeVerticalCanvasScroll(canvas);
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
    fireEvent.keyUp(window, { key: ' ' });
    expect(releasePointerCapture).toHaveBeenCalledWith(2);
    expect(canvas).not.toHaveClass('mermaid-preview-canvas--dragging');
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 90, clientY: 100 });
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
    const lineWheel = createEvent.wheel(canvas, { deltaY: 3, deltaMode: 1, shiftKey: true, cancelable: true });
    fireEvent(canvas, lineWheel);
    expect(lineWheel.defaultPrevented).toBe(true);
    expect(canvas.scrollLeft).toBe(scrollLeftBefore + 3 * WHEEL_LINE_HEIGHT);
    const pageWheel = createEvent.wheel(canvas, { deltaY: 1, deltaMode: 2, shiftKey: true, cancelable: true });
    fireEvent(canvas, pageWheel);
    expect(pageWheel.defaultPrevented).toBe(true);
    expect(canvas.scrollLeft).toBe(scrollLeftBefore + 3 * WHEEL_LINE_HEIGHT + canvas.clientWidth);
    const zeroWheel = createEvent.wheel(canvas, { deltaY: 0, deltaX: 0, shiftKey: true, cancelable: true });
    fireEvent(canvas, zeroWheel);
    expect(zeroWheel.defaultPrevented).toBe(false);
    expect(canvas.scrollLeft).toBe(scrollLeftBefore + 3 * WHEEL_LINE_HEIGHT + canvas.clientWidth);
    canvas.scrollLeft = canvas.scrollWidth - canvas.clientWidth;
    const exhaustedWheel = createEvent.wheel(canvas, { deltaY: 80, shiftKey: true, cancelable: true });
    fireEvent(canvas, exhaustedWheel);
    expect(exhaustedWheel.defaultPrevented).toBe(false);
    expect(canvas.scrollLeft).toBe(canvas.scrollWidth - canvas.clientWidth);
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
