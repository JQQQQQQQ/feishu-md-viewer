import { describe, expect, it } from 'vitest';

import {
  assertChromeVersionMatchesTag,
  createReleaseAssetNames,
  createReleaseNotes,
  parseReleaseTag,
} from '../../scripts/release/release-metadata.mjs';

describe('release metadata', () => {
  it('解析 vX.Y.Z 标签', () => {
    expect(parseReleaseTag('v0.1.1')).toEqual({ tag: 'v0.1.1', version: '0.1.1' });
  });

  it.each(['0.1.1', 'v0.1', 'v0.1.1-beta.1', 'v0.1.1/evil'])('拒绝非法标签 %s', (tag) => {
    expect(() => parseReleaseTag(tag)).toThrow(/标签/);
  });

  it('要求标签版本与 Chrome 项目版本一致', () => {
    expect(assertChromeVersionMatchesTag('v0.1.1', '0.1.1')).toEqual({ tag: 'v0.1.1', version: '0.1.1' });
    expect(() => assertChromeVersionMatchesTag('v0.1.1', '0.1.0')).toThrow(/Chrome.*版本/);
  });

  it('生成无路径注入的两端资产名称', () => {
    expect(createReleaseAssetNames('0.1.1', '0.1.7')).toEqual({
      chromeZip: 'feishu-md-viewer-chrome-0.1.1.zip',
      vscodeVsix: 'feishu-md-viewer-vscode-0.1.7.vsix',
    });
  });

  it('生成包含两个版本和下载文件名的中文 Release 说明', () => {
    const notes = createReleaseNotes({
      tag: 'v0.1.1',
      chromeVersion: '0.1.1',
      vscodeVersion: '0.1.7',
      chromeZip: 'feishu-md-viewer-chrome-0.1.1.zip',
      vscodeVsix: 'feishu-md-viewer-vscode-0.1.7.vsix',
    });
    expect(notes).toContain('Chrome 版本：`0.1.1`');
    expect(notes).toContain('VS Code 版本：`0.1.7`');
    expect(notes).toContain('feishu-md-viewer-chrome-0.1.1.zip');
    expect(notes).toContain('Windows 原生 VS Code');
  });
});
