import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('默认隐藏底部工具栏，进入底部热区后显示且不改变画布结构', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
    const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
    const toolbar = dialog.querySelector('.mermaid-preview-toolbar');
    const hitArea = dialog.querySelector('.mermaid-preview-bottom-hit-area');
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--hidden');
    expect(hitArea).not.toBeNull();
    fireEvent.pointerEnter(hitArea!);
    expect(toolbar).toHaveClass('mermaid-preview-toolbar--visible');
  });

  it('只在按住空格时进入画布平移状态', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
    const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas')!;
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    expect(canvas).not.toHaveClass('mermaid-preview-canvas--space-pan');
    fireEvent.keyDown(window, { key: ' ' });
    expect(canvas).toHaveClass('mermaid-preview-canvas--space-pan');
    fireEvent.keyUp(window, { key: ' ' });
  });

  it('点击遮罩关闭，点击画布内容不关闭', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
    const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
    const overlay = dialog.parentElement!;
    fireEvent.pointerDown(dialog.querySelector('.mermaid-preview-canvas')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(overlay);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Preview Mermaid diagram' })).toHaveFocus();
  });
});

describe('Mermaid 预览版源码写回清理', () => {
  it('不再保留 Mermaid 源码替换工具', () => {
    const sourceFile = join(process.cwd(), 'src/viewer/utils/mermaid-writeback.ts');

    expect(existsSync(sourceFile)).toBe(false);
  });
});
