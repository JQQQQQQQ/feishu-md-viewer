import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('release documentation', () => {
  it('包含自动发布的最短操作路径和失败边界', async () => {
    const readme = await readFile('README.md', 'utf8');
    const guide = await readFile('docs/release-automation.md', 'utf8');

    expect(readme).toContain('git tag vX.Y.Z');
    expect(readme).toContain('GitHub Actions');
    expect(guide).toContain('标签版本必须与根 package.json 一致');
    expect(guide).toContain('不会覆盖已有 Release');
    expect(guide).toContain('Windows 原生 VS Code');
  });

  it('为当前稳定版本提供变更记录和可执行的反馈入口', async () => {
    const [changelog, bugTemplate, featureTemplate] = await Promise.all([
      readFile('CHANGELOG.md', 'utf8'),
      readFile('.github/ISSUE_TEMPLATE/bug_report.yml', 'utf8'),
      readFile('.github/ISSUE_TEMPLATE/feature_request.yml', 'utf8'),
    ]);

    expect(changelog).toContain('## [0.1.1]');
    expect(changelog).toContain('Chrome 扩展');
    expect(changelog).toContain('VS Code');
    expect(bugTemplate).toContain('复现步骤');
    expect(bugTemplate).toContain('运行环境');
    expect(featureTemplate).toContain('问题背景');
    expect(featureTemplate).toContain('期望方案');
  });
});
