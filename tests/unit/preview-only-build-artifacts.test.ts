import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = resolveProjectRoot();
const distDirectory = join(projectRoot, 'dist');

function resolveProjectRoot(): string {
  return join(__dirname, '../..');
}

function listBuildAssets(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    return entry.isDirectory() ? listBuildAssets(entryPath) : [entryPath];
  });
}

describe('预览版构建产物', () => {
  let assetPaths: string[];
  let assetContents: string;

  beforeAll(() => {
    assetPaths = listBuildAssets(distDirectory);
    assetContents = assetPaths
      .filter((assetPath) => /\.(?:js|css)$/.test(assetPath))
      .map((assetPath) => readFileSync(assetPath, 'utf-8'))
      .join('\n');
  }, 120_000);

  it('不再输出 WYSIWYG 或源码编辑器的代码分块', () => {
    const assetNames = assetPaths.map((assetPath) => relative(distDirectory, assetPath));

    expect(assetNames.some((assetName) => /(?:WysiwygEditor|SourceModeEditor)/.test(assetName))).toBe(false);
  });

  it('不再向阅读页面打包编辑器专用样式', () => {
    expect(assetContents).not.toContain('.feishu-wysiwyg');
    expect(assetContents).not.toContain('.md-editor--source');
  });
});
