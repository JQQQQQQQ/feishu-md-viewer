import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('release workflow', () => {
  it('只由版本标签触发并声明最小写权限', async () => {
    const yaml = await readFile('.github/workflows/release.yml', 'utf8');
    expect(yaml).toContain("tags: ['v*.*.*']");
    expect(yaml).toMatch(/permissions:\s*\n\s+contents:\s+write/);
    expect(yaml).not.toMatch(/token:\s*['\"][^$]/i);
  });

  it('显式执行 E2E、打包和最终检查后再创建 Release', async () => {
    const yaml = await readFile('.github/workflows/release.yml', 'utf8');
    expect(yaml).toContain('RUN_E2E=1');
    expect(yaml).toContain('xvfb-run');
    expect(yaml).toContain('npm run package:release');
    expect(yaml).toContain('npm run check:artifacts');
    expect(yaml.indexOf('npm run check:artifacts')).toBeLessThan(yaml.indexOf('gh release create'));
  });
});
