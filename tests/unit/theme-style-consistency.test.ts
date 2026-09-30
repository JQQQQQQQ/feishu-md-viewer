import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/dark-theme.css'),
  'utf8',
);

function readThemeBlock(selector: string): string {
  const match = stylesheet.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  if (!match?.[1]) throw new Error(`找不到主题变量块：${selector}`);
  return match[1];
}

function readCustomProperty(block: string, property: string): string | undefined {
  return block.match(new RegExp(`${property}:\\s*([^;]+);`))?.[1]?.trim();
}

describe('自动主题深色配色', () => {
  it('在系统深色偏好下使用与手动深色模式相同的正文字体颜色', () => {
    const darkTheme = readThemeBlock('\\.feishu-viewer--dark');
    const systemDarkTheme = readThemeBlock('\\.feishu-viewer--system');

    expect(readCustomProperty(systemDarkTheme, '--feishu-text-body')).toBe(
      readCustomProperty(darkTheme, '--feishu-text-body'),
    );
  });
});
