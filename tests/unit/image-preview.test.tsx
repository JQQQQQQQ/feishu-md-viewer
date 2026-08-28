import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FeishuImage, ImagePreviewProvider } from '@/viewer/components/Markdown/ImagePreview';

const imageStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/markdown.css'),
  'utf8',
).replace(/\s+/g, ' ');

describe('图片预览工作台', () => {
  afterEach(() => cleanup());

  it('图片变换不使用动画，避免缩放和旋转时产生顿挫', () => {
    const imageRule = imageStylesheet.match(/\.feishu-image-preview__image\s*\{[^}]*\}/);
    expect(imageRule, 'expected image preview image rule').toBeTruthy();
    expect(imageRule?.[0]).not.toContain('transition: transform');
  });

  it('打开后提供适应、原始尺寸和缩放控制', () => {
    render(<FeishuImage src="https://example.com/demo.png" alt="演示图片" />);

    fireEvent.click(screen.getByRole('button', { name: '预览图片：演示图片' }));

    const dialog = screen.getByRole('dialog', { name: '图片预览：演示图片' });
    expect(within(dialog).getByRole('button', { name: '适应窗口' })).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: '恢复原始尺寸' })).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: '放大图片' })).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: '缩小图片' })).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: '恢复原始尺寸' }).textContent).toContain(
      '原始',
    );
    expect(dialog.querySelector('.feishu-image-preview__zoom')?.textContent).toBe('100%');

    fireEvent.click(within(dialog).getByRole('button', { name: '放大图片' }));
    expect(dialog.querySelector('.feishu-image-preview__zoom')?.textContent).toBe('120%');
    fireEvent.click(within(dialog).getByRole('button', { name: '恢复原始尺寸' }));
    expect(dialog.querySelector('.feishu-image-preview__zoom')?.textContent).toBe('100%');
  });

  it('使用无边框图片画布和底部悬浮操作栏', () => {
    render(<FeishuImage src="https://example.com/demo.png" alt="演示图片" />);
    fireEvent.click(screen.getByRole('button', { name: '预览图片：演示图片' }));

    const dialog = screen.getByRole('dialog', { name: '图片预览：演示图片' });
    expect(dialog.querySelector('.feishu-image-preview__panel')).toBeNull();
    expect(dialog.querySelector('.feishu-image-preview__floating-toolbar')).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: '向左旋转' })).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: '向右旋转' })).not.toBeNull();
    expect(within(dialog).getByRole('link', { name: '下载图片' }).getAttribute('download')).toBe(
      'demo.png',
    );
  });

  it('在工具栏显示图片导航并保留 Raw 图片打开操作', () => {
    render(
      <ImagePreviewProvider>
        <FeishuImage src="https://example.com/first.png" alt="第一张" />
        <FeishuImage src="https://example.com/second.png" alt="第二张" />
      </ImagePreviewProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '预览图片：第一张' }));

    const dialog = screen.getByRole('dialog', { name: '图片预览：第一张' });
    expect(
      (within(dialog).getByRole('button', { name: '上一张图片' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(within(dialog).getByRole('status', { name: '图片位置' }).textContent).toBe('1 / 2');
    expect(
      (within(dialog).getByRole('button', { name: '下一张图片' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(dialog.querySelector('.feishu-image-preview__floating-caption')).toBeNull();
    expect(within(dialog).getByRole('link', { name: '在新标签打开图片' })).not.toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: '下一张图片' }));
    expect(screen.getByRole('dialog', { name: '图片预览：第二张' })).not.toBeNull();
    expect(
      within(screen.getByRole('dialog', { name: '图片预览：第二张' })).getByRole('status', {
        name: '图片位置',
      }).textContent,
    ).toBe('2 / 2');
  });

  it('切换图片时保持蒙版实例，避免重新播放蒙版动画', () => {
    render(
      <ImagePreviewProvider>
        <FeishuImage src="https://example.com/first.png" alt="第一张" />
        <FeishuImage src="https://example.com/second.png" alt="第二张" />
      </ImagePreviewProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '预览图片：第一张' }));
    const dialogBefore = screen.getByRole('dialog', { name: '图片预览：第一张' });
    fireEvent.click(within(dialogBefore).getByRole('button', { name: '放大图片' }));
    fireEvent.click(within(dialogBefore).getByRole('button', { name: '向右旋转' }));
    fireEvent.click(within(dialogBefore).getByRole('button', { name: '下一张图片' }));

    const dialogAfter = screen.getByRole('dialog', { name: '图片预览：第二张' });
    expect(dialogAfter).toBe(dialogBefore);
    expect(dialogAfter.querySelector('.feishu-image-preview__zoom')?.textContent).toBe('100%');
    expect(dialogAfter.querySelector('.feishu-image-preview__rotation')?.textContent).toBe('0°');
  });

  it('点击图片外部画布会关闭预览', () => {
    render(<FeishuImage src="https://example.com/demo.png" alt="演示图片" />);
    fireEvent.click(screen.getByRole('button', { name: '预览图片：演示图片' }));

    const dialog = screen.getByRole('dialog', { name: '图片预览：演示图片' });
    const canvas = dialog.querySelector('.feishu-image-preview__canvas');
    expect(canvas).not.toBeNull();
    fireEvent.click(canvas!);

    expect(screen.queryByRole('dialog', { name: '图片预览：演示图片' })).toBeNull();
  });

  it('旋转图片时只改变画布中的图片变换', () => {
    render(<FeishuImage src="https://example.com/demo.png" alt="演示图片" />);
    fireEvent.click(screen.getByRole('button', { name: '预览图片：演示图片' }));

    const dialog = screen.getByRole('dialog', { name: '图片预览：演示图片' });
    const image = within(dialog).getByRole('img', { name: '演示图片' });
    fireEvent.click(within(dialog).getByRole('button', { name: '向右旋转' }));

    expect(image.getAttribute('style')).toContain('rotate(90deg)');
    expect(dialog.querySelector('.feishu-image-preview__rotation')?.textContent).toBe('90°');
  });

  it('放大后保持画布居中，不切换到左上角对齐', () => {
    render(<FeishuImage src="https://example.com/demo.png" alt="演示图片" />);
    fireEvent.click(screen.getByRole('button', { name: '预览图片：演示图片' }));

    const dialog = screen.getByRole('dialog', { name: '图片预览：演示图片' });
    const canvas = dialog.querySelector('.feishu-image-preview__canvas');
    expect(canvas?.classList.contains('feishu-image-preview__canvas--zoomed')).toBe(false);

    fireEvent.click(within(dialog).getByRole('button', { name: '放大图片' }));
    expect(canvas?.classList.contains('feishu-image-preview__canvas--zoomed')).toBe(false);
  });

  it('图片加载失败时显示可重试状态', () => {
    render(<FeishuImage src="https://example.com/missing.png" alt="失效图片" />);
    fireEvent.click(screen.getByRole('button', { name: '预览图片：失效图片' }));

    const dialog = screen.getByRole('dialog', { name: '图片预览：失效图片' });
    fireEvent.error(within(dialog).getByRole('img', { name: '失效图片' }));

    expect(screen.getByText('图片加载失败')).not.toBeNull();
    expect(screen.getByRole('button', { name: '重新加载图片' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '重新加载图片' }));
    expect(within(dialog).getByRole('img', { name: '失效图片' })).not.toBeNull();
  });
});
