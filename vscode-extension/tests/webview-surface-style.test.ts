import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('VS Code Webview 阅读表面', () => {
  it('让外层阅读画布与正文使用同一背景，同时保留目录自身的主题层次', () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), 'vscode-extension/webview/webview.css'),
      'utf8',
    );

    expect(stylesheet).toContain('.feishu-vscode-webview .feishu-app-shell');
    expect(stylesheet).toContain('background-color: var(--feishu-bg-content)');
    expect(stylesheet).toContain('.feishu-vscode-webview--dark');
    expect(stylesheet).toContain('background-color: #1a1a1a');
    expect(stylesheet).not.toContain('.feishu-vscode-webview--resume-stable');
    expect(stylesheet).not.toContain('.feishu-sidebar {\n  background-color: var(--feishu-bg-content)');
  });

  it('VS Code 目录继续使用阅读态的位移动画', () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), 'vscode-extension/webview/webview.css'),
      'utf8',
    );
    const sharedLayoutStylesheet = readFileSync(
      resolve(process.cwd(), 'src/viewer/styles/layout.css'),
      'utf8',
    );

    expect(stylesheet).not.toMatch(/\.feishu-vscode-webview \.feishu-sidebar\s*\{[^}]*transform:\s*none;/);
    expect(stylesheet).not.toMatch(
      /\.feishu-vscode-webview \.feishu-sidebar--collapsed,\s*\.feishu-vscode-webview \.feishu-sidebar--table-scrolling\s*\{[^}]*display:\s*none;/,
    );
    expect(stylesheet).not.toMatch(/\.feishu-vscode-webview \.feishu-sidebar\s*\{[^}]*transition:\s*none;/);
    expect(sharedLayoutStylesheet).toMatch(
      /\.feishu-sidebar\s*\{[^}]*transition:\s*transform var\(--feishu-transition-duration\) ease;/,
    );
  });

  it('白色主题固定 Webview 外层、正文和代码块背景', () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), 'vscode-extension/webview/webview.css'),
      'utf8',
    );

    expect(stylesheet).toMatch(/html,\s*\nbody,\s*\n#webview-root\s*\{[^}]*background-color:\s*#ffffff;/);
    expect(stylesheet).toMatch(
      /\.feishu-vscode-webview--light\s*\{[^}]*background-color:\s*#ffffff;[^}]*color-scheme:\s*light;/,
    );
    expect(stylesheet).toContain('.feishu-vscode-webview--light .feishu-code-block');
    expect(stylesheet).toMatch(
      /\.feishu-vscode-webview--light \.feishu-code-block\s*\{[^}]*background-color:\s*#f7f8fa;/,
    );
  });

  it('暗色主题让外层和代码块使用同一套深色背景', () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), 'vscode-extension/webview/webview.css'),
      'utf8',
    );

    expect(stylesheet).toMatch(
      /html\[data-feishu-vscode-theme="dark"\],\s*body\[data-feishu-vscode-theme="dark"\],\s*#webview-root\[data-feishu-vscode-theme="dark"\]\s*\{[^}]*background-color:\s*#1a1a1a;/,
    );
    expect(stylesheet).toMatch(
      /\.feishu-vscode-webview--dark \.feishu-code-block\s*\{[^}]*background-color:\s*#2d2d2d;/,
    );
    expect(stylesheet).toMatch(
      /\.feishu-vscode-webview--dark \.feishu-code-block__pre,\s*\.feishu-vscode-webview--dark \.feishu-code-block__code\s*\{[^}]*background-color:\s*#2d2d2d;/,
    );
  });

  it('恢复加载层继承当前阅读背景并只对透明度做短过渡', () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), 'vscode-extension/webview/webview.css'),
      'utf8',
    );

    expect(stylesheet).toMatch(
      /\.feishu-vscode-resume-overlay\s*\{[^}]*position:\s*fixed;[^}]*background-color:\s*inherit;[^}]*opacity:\s*0;[^}]*transition:\s*opacity 100ms ease;/,
    );
    expect(stylesheet).toMatch(
      /\.feishu-vscode-resume-overlay--visible\s*\{[^}]*opacity:\s*1;/,
    );
    expect(stylesheet).toContain('.feishu-vscode-resume-overlay__spinner');
  });
});
