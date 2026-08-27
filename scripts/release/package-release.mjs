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
  await runChecked('zip', ['-r', chromeZipPath, '.'], { cwd: join(root, 'dist'), env: process.env }, commandRunner);
  await runChecked(executable('npm'), ['run', 'build:vscode'], { cwd: root, env: process.env }, commandRunner);
  await runChecked(
    executable('pnpm'),
    ['dlx', '@vscode/vsce', 'package', '--no-dependencies', '--out', vscodeVsixPath],
    { cwd: join(root, 'vscode-extension'), env: process.env },
    commandRunner,
  );

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
