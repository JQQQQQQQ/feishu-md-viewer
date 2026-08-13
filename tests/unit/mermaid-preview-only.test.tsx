import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});

describe('Mermaid 预览版源码写回清理', () => {
  it('不再保留 Mermaid 源码替换工具', () => {
    const sourceFile = join(process.cwd(), 'src/viewer/utils/mermaid-writeback.ts');

    expect(existsSync(sourceFile)).toBe(false);
  });
});
