import { describe, expect, it } from 'vitest';
import {
  createReloadPlan,
  isReloadCommandSuccessful,
  parseReloadArgs,
  resolveAutomationCwd,
} from '../../scripts/extension/reload-extension.mjs';

describe('extension reload script', () => {
  it('defaults to building the Chrome extension before reloading it', () => {
    expect(parseReloadArgs([])).toEqual({ build: true });

    const plan = createReloadPlan({
      rootDir: '/workspace/feishu-md-viewer',
      platform: 'win32',
      appData: 'C:/Users/Q/AppData/Roaming',
    });

    expect(plan.buildCommand).toEqual({ command: 'npm', args: ['run', 'build'] });
    expect(plan.playwrightCommand).toBe('C:/Users/Q/AppData/Roaming/npm/playwright-cli.cmd');
    expect(plan.reloadSnippetPath).toBe('/workspace/feishu-md-viewer/scripts/extension/trigger-reload.js');
    expect(plan.reloadSnippetArg).toBe('scripts/extension/trigger-reload.js');
  });

  it('supports skipping the build for a fast reload', () => {
    expect(parseReloadArgs(['--no-build'])).toEqual({ build: false });
  });

  it('can use the Windows playwright-cli from a WSL checkout', () => {
    const plan = createReloadPlan({
      rootDir: '/root/workspace/feishu-md-viewer',
      platform: 'linux',
      windowsPlaywrightCli: '/mnt/c/Users/Q/AppData/Roaming/npm/playwright-cli.cmd',
    });

    expect(plan.playwrightCommand).toBe('/mnt/c/Users/Q/AppData/Roaming/npm/playwright-cli.cmd');
  });

  it('rejects unknown options with an actionable error', () => {
    expect(() => parseReloadArgs(['--reload-only'])).toThrow(
      '未知参数：--reload-only。可用参数：--no-build、--help',
    );
  });

  it('does not treat a playwright-cli error block as a successful reload', () => {
    expect(isReloadCommandSuccessful({ status: 0, output: '### Error\nTimeoutError: page.waitForFunction timed out' })).toBe(false);
    expect(isReloadCommandSuccessful({ status: 0, output: '### Result\n{ "success": true }' })).toBe(true);
    expect(isReloadCommandSuccessful({ status: 1, output: '### Result\n{"type":"RELOAD_EXTENSION_ACK","response":{"success":true}}' })).toBe(true);
    expect(isReloadCommandSuccessful({ status: 1, output: '' })).toBe(false);
  });

  it('uses the Windows user directory so WSL and manual CLI sessions share state', () => {
    expect(resolveAutomationCwd({ useWindowsCliFromWsl: true, cwd: '/root/workspace/feishu-md-viewer' })).toBe('/mnt/c/Users/Q');
    expect(resolveAutomationCwd({ useWindowsCliFromWsl: false, cwd: '/root/workspace/feishu-md-viewer' })).toBe('/root/workspace/feishu-md-viewer');
  });
});
