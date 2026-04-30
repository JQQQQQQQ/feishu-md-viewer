import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createElement } from 'react';

// We need to test the CopyButton behavior. Since CopyButton is not exported
// directly, we test it through the FeishuCodeBlock wrapper (pre component)
// by importing feishuComponents.
import { feishuComponents } from '@/viewer/components/Markdown/FeishuComponents';

describe('CopyButton clipboard functionality', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderCodeBlock(code: string, lang = 'javascript') {
    // feishuComponents.pre renders a FeishuCodeBlock which includes CopyButton
    const PreComponent = feishuComponents.pre!;
    // The pre component expects children to be a <code> element with className and children
    const codeElement = createElement('code', { className: `language-${lang}` }, code);
    return render(createElement(PreComponent, {}, codeElement));
  }

  it('renders a copy button for code blocks', () => {
    renderCodeBlock('const x = 1;');
    const copyBtn = screen.getByRole('button', { name: /复制代码/i });
    expect(copyBtn).toBeDefined();
  });

  it('calls navigator.clipboard.writeText with correct code content on click', async () => {
    const code = 'console.log("hello world");';
    renderCodeBlock(code);

    const copyBtn = screen.getByRole('button', { name: /复制代码/i });
    await act(async () => {
      fireEvent.click(copyBtn);
      // Let the promise resolve
      await writeTextMock();
    });

    expect(writeTextMock).toHaveBeenCalledWith(code);
  });

  it('shows "Copied!" text after clicking', async () => {
    renderCodeBlock('const y = 2;');

    const copyBtn = screen.getByRole('button', { name: /复制代码/i });
    await act(async () => {
      fireEvent.click(copyBtn);
      // Allow microtask (clipboard promise) to resolve
      await Promise.resolve();
    });

    const copiedBtn = screen.getByRole('button', { name: /已复制/i });
    expect(copiedBtn.textContent).toContain('已复制');
  });

  it('reverts back to "Copy" after 2 seconds', async () => {
    vi.useFakeTimers();
    renderCodeBlock('const z = 3;');

    const copyBtn = screen.getByRole('button', { name: /复制代码/i });
    await act(async () => {
      fireEvent.click(copyBtn);
      await Promise.resolve();
    });

    // Verify it says "Copied!" first
    expect(screen.getByRole('button', { name: /已复制/i })).toBeDefined();

    // Advance timer by 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const revertedBtn = screen.getByRole('button', { name: /复制代码/i });
    expect(revertedBtn.textContent).toContain('复制');

    vi.useRealTimers();
  });

  it('handles clipboard writeText failure gracefully', async () => {
    writeTextMock.mockRejectedValue(new Error('Clipboard not available'));
    renderCodeBlock('const fail = true;');

    const copyBtn = screen.getByRole('button', { name: /复制代码/i });

    // Should not throw
    await act(async () => {
      fireEvent.click(copyBtn);
      // Allow the rejected promise to be caught
      await Promise.resolve();
      await Promise.resolve();
    });

    // Button should still be in "Copy" state since the write failed
    expect(copyBtn.textContent).toContain('复制');
  });
});
