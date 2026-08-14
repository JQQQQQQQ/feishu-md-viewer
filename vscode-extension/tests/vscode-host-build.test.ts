import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const extensionRoot = resolve(process.cwd(), 'vscode-extension');
const packageManifest = JSON.parse(readFileSync(resolve(extensionRoot, 'package.json'), 'utf8')) as {
  main: string;
};

describe('VS Code 宿主构建', () => {
  it('使用独立的可发射宿主 tsconfig，不改变纯类型检查配置', () => {
    const hostConfigPath = resolve(extensionRoot, 'tsconfig.host.json');

    expect(existsSync(hostConfigPath)).toBe(true);
    if (!existsSync(hostConfigPath)) {
      return;
    }

    const hostConfig = JSON.parse(readFileSync(hostConfigPath, 'utf8')) as {
      compilerOptions: { noEmit: boolean; outDir: string; rootDir: string };
    };

    expect(hostConfig.compilerOptions).toMatchObject({
      noEmit: false,
      outDir: './out',
      rootDir: './src',
    });
  });

  it('生成 package.main 指向的宿主入口及其 Provider 依赖', () => {
    const mainPath = resolve(extensionRoot, packageManifest.main);

    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(resolve(extensionRoot, 'out/MarkdownPreviewProvider.js'))).toBe(true);
  });

  it('提供 Extension Development Host 的 F5 启动配置', () => {
    const launchConfigPath = resolve(process.cwd(), '.vscode/launch.json');

    expect(existsSync(launchConfigPath)).toBe(true);
    if (!existsSync(launchConfigPath)) {
      return;
    }

    const launchConfig = JSON.parse(readFileSync(launchConfigPath, 'utf8')) as {
      configurations: Array<{ type: string; request: string; name: string; outFiles?: string[] }>;
    };

    expect(launchConfig.configurations).toContainEqual(expect.objectContaining({
      type: 'extensionHost',
      request: 'launch',
      name: '运行 Feishu Markdown Viewer VS Code 扩展',
      outFiles: ['${workspaceFolder}/vscode-extension/out/**/*.js'],
    }));
  });
});
