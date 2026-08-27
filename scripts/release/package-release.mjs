import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

import { createReleaseNotes, readReleaseMetadata } from './release-metadata.mjs';

function executable(name) {
  return process.platform === 'win32' && (name === 'npm' || name === 'pnpm') ? `${name}.cmd` : name;
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
    child.on('error', (error) => resolveResult({ code: 1, output: `${output}${error.message}` }));
    child.on('close', (code) => resolveResult({ code: code ?? 1, output }));
  });
}

async function runChecked(command, args, options, run) {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    throw new Error(`构建或打包失败：${[command, ...args].join(' ')}\n${result.output ?? ''}`);
  }
  return result;
}

async function createChromeZip(zipPath, distDir, run) {
  const zipArgs = ['-r', zipPath, '.'];
  const zipResult = await run('zip', zipArgs, { cwd: distDir, env: process.env });
  if (zipResult.code === 0) return;

  if (!/ENOENT|not found|不存在/i.test(zipResult.output ?? '')) {
    throw new Error(`构建或打包失败：zip ${zipArgs.join(' ')}\n${zipResult.output ?? ''}`);
  }

  const pythonScript = [
    'import os, sys, zipfile',
    'output = sys.argv[1]',
    'with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:',
    '    for root, _, files in os.walk("."):',
    '        for name in files:',
    '            path = os.path.join(root, name)',
    '            archive.write(path, os.path.relpath(path, "."))',
  ].join('\n');
  await runChecked('python3', ['-c', pythonScript, zipPath], { cwd: distDir, env: process.env }, run);
}

async function packageVsix(vsixPath, vscodeDir, run) {
  const args = ['dlx', '@vscode/vsce', 'package', '--no-dependencies', '--out', vsixPath];
  const pnpmResult = await run(executable('pnpm'), args, { cwd: vscodeDir, env: process.env });
  if (pnpmResult.code === 0) return;
  if (!/ENOENT|not found|不存在/i.test(pnpmResult.output ?? '')) {
    throw new Error(`构建或打包失败：${[executable('pnpm'), ...args].join(' ')}\n${pnpmResult.output ?? ''}`);
  }
  await runChecked('corepack', ['pnpm', ...args], { cwd: vscodeDir, env: process.env }, run);
}

export async function buildReleaseAssets({
  rootDir = process.cwd(),
  outputDir,
  tag,
  run = runCommand,
  runCommand: injectedRun,
} = {}) {
  const commandRunner = injectedRun ?? run;
  if (!outputDir) throw new Error('缺少发布资产输出目录：请传入 outputDir');

  const root = resolve(rootDir);
  const output = resolve(outputDir);
  const metadata = await readReleaseMetadata({ rootDir: root, tag });
  const chromeZipPath = join(output, metadata.chromeZip);
  const vscodeVsixPath = join(output, metadata.vscodeVsix);

  await mkdir(output, { recursive: true });
  await Promise.all([
    rm(chromeZipPath, { force: true }),
    rm(vscodeVsixPath, { force: true }),
  ]);

  await runChecked(executable('npm'), ['run', 'build'], { cwd: root, env: process.env }, commandRunner);
  await createChromeZip(chromeZipPath, join(root, 'dist'), commandRunner);
  await runChecked(executable('npm'), ['run', 'build:vscode'], { cwd: root, env: process.env }, commandRunner);
  await packageVsix(vscodeVsixPath, join(root, 'vscode-extension'), commandRunner);

  return { metadata, chromeZipPath, vscodeVsixPath };
}

function getArgument(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const outputDir = getArgument(args, '--output');
  const result = await buildReleaseAssets({
    tag: getArgument(args, '--tag'),
    outputDir,
  });
  const notesPath = getArgument(args, '--notes');
  if (notesPath) await writeFile(resolve(notesPath), createReleaseNotes(result.metadata));
  console.log(JSON.stringify(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`发布资产打包失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
