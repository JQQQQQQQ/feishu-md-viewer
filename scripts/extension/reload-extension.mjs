#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RELOAD_SNIPPET = 'scripts/extension/trigger-reload.js';

export function parseReloadArgs(argv) {
  let build = true;

  for (const arg of argv) {
    if (arg === '--no-build') {
      build = false;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      return { build, help: true };
    }

    throw new Error(`未知参数：${arg}。可用参数：--no-build、--help`);
  }

  return { build };
}

function toPosixPath(value) {
  return value.replaceAll('\\', '/');
}

export function createReloadPlan({
  rootDir,
  platform = process.platform,
  appData = process.env.APPDATA,
  windowsPlaywrightCli,
} = {}) {
  if (!rootDir) throw new Error('缺少项目根目录。');

  const normalizedRoot = toPosixPath(rootDir);
  const playwrightCommand = platform === 'win32' && appData
    ? `${toPosixPath(appData).replace(/\/$/, '')}/npm/playwright-cli.cmd`
    : windowsPlaywrightCli ?? 'playwright-cli';

  return {
    buildCommand: { command: 'npm', args: ['run', 'build'] },
    playwrightCommand,
    reloadSnippetPath: `${normalizedRoot.replace(/\/$/, '')}/${RELOAD_SNIPPET}`,
    reloadSnippetArg: RELOAD_SNIPPET,
  };
}

export function isReloadCommandSuccessful({ status, output }) {
  if (output.split(/\r?\n/).some(line => /^###\s*Error\b/i.test(line.trim()))) return false;
  if (/RELOAD_EXTENSION_ACK[\s\S]*success["']?\s*:\s*true/i.test(output)) return true;
  return status === 0;
}

export function resolveAutomationCwd({ useWindowsCliFromWsl, cwd, windowsCwd = '/mnt/c/Users/Q' }) {
  return useWindowsCliFromWsl ? windowsCwd : cwd;
}

function convertWslPathToWindows(value) {
  if (!value.startsWith('/')) return value;
  const result = spawnSync('wslpath', ['-w', value], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return result.status === 0 && result.stdout ? result.stdout.trim() : value;
}

function run(command, args, options = {}) {
  const useWindowsCliFromWsl = process.platform !== 'win32' && command.toLowerCase().endsWith('.cmd');
  const executable = useWindowsCliFromWsl ? 'cmd.exe' : command;
  const commandArgs = useWindowsCliFromWsl
    ? ['/d', '/c', convertWslPathToWindows(command), ...args]
    : args;
  const captureOutput = options.captureOutput === true;
  const result = spawnSync(executable, commandArgs, {
    cwd: resolveAutomationCwd({ useWindowsCliFromWsl, cwd: options.cwd }),
    env: process.env,
    shell: !useWindowsCliFromWsl,
    stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : options.silent ? 'ignore' : 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (captureOutput) {
    const output = `${result.stdout?.toString() ?? ''}${result.stderr?.toString() ?? ''}`;
    process.stdout.write(output);
    return { status: result.status ?? 1, output };
  }

  return result.status ?? 1;
}

function printHelp() {
  console.log(`用法：npm run extension:reload -- [选项]

重新构建 Chrome 扩展，并通过当前 Chrome Markdown 页面触发扩展重载。

选项：
  --no-build  跳过构建，只执行扩展重载，适合快速验证
  --help      显示帮助

前置条件：
  1. Chrome 已打开一个由 Feishu MD Viewer 渲染的 Markdown 页面
  2. 本机已安装 playwright-cli，并允许连接当前 Chrome
`);
}

export function main({ argv = process.argv.slice(2), rootDir = dirname(dirname(dirname(fileURLToPath(import.meta.url)))) } = {}) {
  const options = parseReloadArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }

  const windowsPlaywrightCli = process.platform !== 'win32'
    ? '/mnt/c/Users/Q/AppData/Roaming/npm/playwright-cli.cmd'
    : undefined;
  const plan = createReloadPlan({ rootDir, windowsPlaywrightCli });
  if (!existsSync(plan.reloadSnippetPath)) {
    console.error(`找不到重载脚本：${plan.reloadSnippetPath}`);
    return 1;
  }

  if (options.build) {
    console.log('正在构建 Chrome 扩展…');
    if (run(plan.buildCommand.command, plan.buildCommand.args, { cwd: rootDir }) !== 0) {
      console.error('扩展构建失败，已停止重载。');
      return 1;
    }
  }

  console.log('正在连接当前 Chrome…');
  const hasSession = run(plan.playwrightCommand, ['-s=chrome', 'tab-list'], { silent: true }) === 0;
  if (!hasSession && run(plan.playwrightCommand, ['attach', '--extension=chrome']) !== 0) {
    console.error('无法连接 Chrome。请确认 Chrome 已打开，并已安装/启用 playwright-cli 连接扩展。');
    return 1;
  }

  console.log('正在触发扩展重载…');
  const reloadResult = run(plan.playwrightCommand, [
    '-s=chrome',
    'run-code',
    '--filename',
    process.platform !== 'win32' && plan.playwrightCommand.toLowerCase().endsWith('.cmd')
      ? convertWslPathToWindows(plan.reloadSnippetPath)
      : plan.reloadSnippetArg,
  ], { cwd: rootDir, captureOutput: true });

  // detach 只断开自动化连接，不会关闭 Chrome 或标签页。
  run(plan.playwrightCommand, ['-s=chrome', 'detach'], { silent: true });

  if (!isReloadCommandSuccessful(reloadResult)) {
    console.error('扩展重载失败。请确认当前标签页是 Markdown 预览页面。');
    return 1;
  }

  console.log('扩展已触发重载，当前 Markdown 页面应已重新注入最新版本。');
  return 0;
}

if (process.argv[1] && toPosixPath(process.argv[1]) === toPosixPath(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
