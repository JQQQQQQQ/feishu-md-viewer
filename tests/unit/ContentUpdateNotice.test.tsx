import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { ContentUpdateNotice } from '@/viewer/components/Common/ContentUpdateNotice';

describe('ContentUpdateNotice', () => {
  it('显示文件更新提示并在点击后触发局部刷新', () => {
    const onRefresh = vi.fn();
    render(<ContentUpdateNotice onRefresh={onRefresh} />);

    expect(screen.getByRole('status')).toHaveTextContent('Markdown 文件已更新');
    fireEvent.click(screen.getByRole('button', { name: '立即刷新' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledWith();
  });
});
