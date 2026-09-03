import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiagramToolbar } from '@/viewer/components/Diagram/DiagramToolbar';

describe('通用图表预览', () => {
  it('DOT 工具栏使用 DOT 文案并能打开全屏预览', () => {
    render(
      <DiagramToolbar
        code="digraph G {}"
        blockIndex={0}
        kind="DOT"
        svgSelector=".feishu-dot svg"
      >
        <div className="feishu-dot">
          <svg aria-label="DOT 图表" />
        </div>
      </DiagramToolbar>,
    );

    fireEvent.click(screen.getByRole('button', { name: '预览 DOT 图表' }));

    expect(screen.getByRole('dialog', { name: 'DOT 图表预览' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '× 退出' })).toBeTruthy();
  });

  it('没有正文 SVG 时不打开预览', () => {
    render(
      <DiagramToolbar code="digraph G {}" blockIndex={1} kind="DOT" svgSelector=".feishu-dot svg">
        <div className="feishu-dot">loading</div>
      </DiagramToolbar>,
    );

    fireEvent.click(screen.getByRole('button', { name: '预览 DOT 图表' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
