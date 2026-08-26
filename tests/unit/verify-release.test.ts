import { describe, expect, it, vi } from 'vitest';

import { runReleaseVerification } from '../../scripts/release/verify-release.mjs';

describe('runReleaseVerification', () => {
  it('按固定顺序执行所有发布门禁并记录未启用的 E2E', async () => {
    const run = vi.fn().mockResolvedValue({ code: 0, output: '' });

    const report = await runReleaseVerification({ cwd: '/repo', run, includeE2E: false });

    expect(report.ok).toBe(true);
    expect(report.steps.map((step) => step.name)).toEqual([
      '单元测试',
      '类型检查',
      'Chrome 构建',
      'VS Code 构建',
      'VS Code 产物验证',
      '发布产物检查',
      '浏览器 E2E',
    ]);
    expect(report.steps.at(-1)).toMatchObject({ status: 'skipped' });
    expect(run).toHaveBeenCalledTimes(6);
  });

  it('任一步失败后停止后续步骤并返回失败报告', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 1, output: 'type error' });

    const report = await runReleaseVerification({ cwd: '/repo', run, includeE2E: false });

    expect(report.ok).toBe(false);
    expect(report.steps[1]).toMatchObject({
      name: '类型检查',
      status: 'failed',
      output: 'type error',
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('CI 显式启用浏览器 E2E 且依赖缺失时返回失败而不静默跳过', async () => {
    const run = vi.fn().mockResolvedValue({ code: 0, output: '' });
    run.mockImplementationOnce(async () => ({ code: 0, output: '' }))
      .mockImplementationOnce(async () => ({ code: 0, output: '' }))
      .mockImplementationOnce(async () => ({ code: 0, output: '' }))
      .mockImplementationOnce(async () => ({ code: 0, output: '' }))
      .mockImplementationOnce(async () => ({ code: 0, output: '' }))
      .mockImplementationOnce(async () => ({ code: 0, output: '' }))
      .mockImplementationOnce(async () => ({ code: 1, output: 'Executable not found' }));

    const report = await runReleaseVerification({
      cwd: '/repo',
      run,
      includeE2E: true,
      env: { CI: '1', RUN_E2E: '1' },
    });

    expect(report.ok).toBe(false);
    expect(report.steps.at(-1)).toMatchObject({
      name: '浏览器 E2E',
      status: 'failed',
      output: expect.stringContaining('npm run test:e2e:install'),
    });
  });
});
