import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const BASE_STEPS = [
  ['类型检查', 'npm', ['run', 'typecheck']],
  ['Chrome 构建', 'npm', ['run', 'build']],
  ['VS Code 构建', 'npm', ['run', 'build:vscode']],
  ['VS Code 产物验证', 'npm', ['run', 'verify:vscode']],
  ['发布产物检查', 'npm', ['run', 'check:artifacts']],
  ['单元测试', 'npm', ['test', '--', '--run']],
];

function npmExecutable() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runCommand(command, args, { cwd, env } = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => {
      resolveResult({ code: 1, output: `${output}${error.message}` });
    });
    child.on('close', (code) => {
      resolveResult({ code: code ?? 1, output });
    });
  });
}

function createStep(name, command, args) {
  return { name, command, args };
}

export async function runReleaseVerification({
  cwd = process.cwd(),
  run = runCommand,
  includeE2E = process.env.RUN_E2E === '1',
  env = process.env,
} = {}) {
  const steps = [];
  const commands = BASE_STEPS.map(([name, _command, args]) => createStep(name, npmExecutable(), args));
  if (includeE2E) commands.push(createStep('浏览器 E2E', npmExecutable(), ['run', 'test:e2e']));

  for (const step of commands) {
    const startedAt = Date.now();
    const result = await run(step.command, step.args, { cwd, env: { ...env } });
    const status = result.code === 0 ? 'passed' : 'failed';
    const output = result.output ?? '';
    const dependencyHint = step.name === '浏览器 E2E'
      && status === 'failed'
      && /executable (?:doesn't exist|not found)|browser.*install/i.test(output)
      ? '\n浏览器依赖缺失，请先执行：npm run test:e2e:install\n'
      : '';
    steps.push({
      name: step.name,
      command: [step.command, ...step.args].join(' '),
      status,
      durationMs: Date.now() - startedAt,
      output: `${output}${dependencyHint}`,
    });
    if (status === 'failed') break;
  }

  if (!includeE2E && steps.length === BASE_STEPS.length && steps.every((step) => step.status === 'passed')) {
    steps.push({
      name: '浏览器 E2E',
      command: 'npm run test:e2e',
      status: 'skipped',
      durationMs: 0,
      output: '未设置 RUN_E2E=1；质量门禁未执行浏览器 E2E。',
    });
  }

  return {
    ok: steps.length > 0 && steps.every((step) => step.status !== 'failed'),
    steps,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const report = await runReleaseVerification({ includeE2E: process.env.RUN_E2E === '1' });
  for (const step of report.steps) {
    const icon = step.status === 'passed' ? '✓' : step.status === 'skipped' ? '–' : '✗';
    console.log(`${icon} ${step.name} (${step.durationMs}ms)`);
    if (step.status === 'failed' && step.output) console.error(step.output);
  }
  if (!report.ok) process.exitCode = 1;
}
