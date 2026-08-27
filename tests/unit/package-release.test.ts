import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import packageJson from '../../vscode-extension/package.json';

import { buildReleaseAssets } from '../../scripts/release/package-release.mjs';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createFixture(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'feishu-release-package-'));
  tempRoots.push(rootDir);
  await mkdir(join(rootDir, 'dist'), { recursive: true });
  await mkdir(join(rootDir, 'vscode-extension'), { recursive: true });
  await writeFile(join(rootDir, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  await writeFile(join(rootDir, 'vscode-extension', 'package.json'), JSON.stringify({ version: '0.1.7' }));
  return rootDir;
}

describe('buildReleaseAssets', () => {
  it('VS Code 扩展声明仓库地址以支持 vsce 解析 README 链接', () => {
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'https://github.com/JQQQQQQQ/feishu-md-viewer.git',
    });
  });

  it('按两端版本生成固定资产路径并调用构建命令', async () => {
    const rootDir = await createFixture();
    const runCommand = vi.fn().mockResolvedValue({ code: 0, output: '' });

    const result = await buildReleaseAssets({
      rootDir,
      outputDir: join(rootDir, 'release-assets'),
      tag: 'v1.2.3',
      runCommand,
    });

    expect(result.metadata.chromeZip).toBe('feishu-md-viewer-chrome-1.2.3.zip');
    expect(result.metadata.vscodeVsix).toBe('feishu-md-viewer-vscode-0.1.7.vsix');
    expect(result.chromeZipPath).toBe(join(rootDir, 'release-assets', result.metadata.chromeZip));
    expect(result.vscodeVsixPath).toBe(join(rootDir, 'release-assets', result.metadata.vscodeVsix));
    expect(runCommand).toHaveBeenCalledWith('zip', expect.arrayContaining(['-r']), expect.objectContaining({ cwd: join(rootDir, 'dist') }));
    expect(runCommand).toHaveBeenCalledWith(expect.stringMatching(/pnpm(?:\.cmd)?$/), expect.arrayContaining(['dlx', '@vscode/vsce', 'package']), expect.objectContaining({ cwd: join(rootDir, 'vscode-extension') }));
  });

  it('构建命令失败时抛错且不继续打包', async () => {
    const rootDir = await createFixture();
    const runCommand = vi.fn().mockResolvedValue({ code: 1, output: 'build failed' });

    await expect(buildReleaseAssets({
      rootDir,
      outputDir: join(rootDir, 'release-assets'),
      tag: 'v1.2.3',
      runCommand,
    })).rejects.toThrow(/构建|打包/);
    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  it('运行器没有 zip 命令时使用 Python 标准库创建 Chrome ZIP', async () => {
    const rootDir = await createFixture();
    const runCommand = vi.fn()
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 1, output: 'spawn zip ENOENT' })
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 0, output: '' });

    await buildReleaseAssets({
      rootDir,
      outputDir: join(rootDir, 'release-assets'),
      tag: 'v1.2.3',
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledWith('python3', expect.arrayContaining(['-c', expect.stringContaining('zipfile')]), expect.objectContaining({ cwd: join(rootDir, 'dist') }));
  });

  it('运行器没有 pnpm 命令时使用 Corepack 调用 pnpm 打包 VSIX', async () => {
    const rootDir = await createFixture();
    const runCommand = vi.fn()
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 1, output: 'spawn pnpm ENOENT' })
      .mockResolvedValueOnce({ code: 0, output: '' });

    await buildReleaseAssets({
      rootDir,
      outputDir: join(rootDir, 'release-assets'),
      tag: 'v1.2.3',
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledWith('corepack', expect.arrayContaining(['pnpm', 'dlx', '@vscode/vsce', 'package']), expect.objectContaining({ cwd: join(rootDir, 'vscode-extension') }));
  });
});
