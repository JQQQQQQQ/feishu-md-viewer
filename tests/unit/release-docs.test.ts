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
});
