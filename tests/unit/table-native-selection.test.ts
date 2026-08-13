import { describe, expect, it } from 'vitest';
import { hasNativeTextSelection } from '@/viewer/components/Markdown/table-native-selection';

describe('table native selection', () => {
  it('recognizes a non-collapsed selection fully contained by the wrapper', () => {
    const wrapper = document.createElement('div');
    const text = document.createTextNode('部分文字');
    wrapper.appendChild(text);
    document.body.appendChild(wrapper);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 2);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(hasNativeTextSelection(wrapper)).toBe(true);
    selection?.removeAllRanges();
  });

  it('does not claim a collapsed or external selection', () => {
    const wrapper = document.createElement('div');
    const inside = document.createTextNode('内部');
    const outside = document.createTextNode('外部');
    wrapper.appendChild(inside);
    document.body.appendChild(wrapper);
    document.body.appendChild(outside);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(outside, 0);
    range.setEnd(outside, 1);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(hasNativeTextSelection(wrapper)).toBe(false);
    selection?.removeAllRanges();
  });
});
