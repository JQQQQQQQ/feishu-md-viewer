import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const RELEASE_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

function assertSemver(value, label) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new Error(`${label}必须是三段数字版本（例如 0.1.1）`);
  }
  return value;
}

export function parseReleaseTag(tag) {
  if (typeof tag !== 'string' || !RELEASE_TAG_PATTERN.test(tag)) {
    throw new Error(`发布标签格式无效：${String(tag)}；必须使用 vX.Y.Z（例如 v0.1.1）`);
  }
  return { tag, version: tag.slice(1) };
}

export function assertChromeVersionMatchesTag(tag, packageVersion) {
  const parsed = parseReleaseTag(tag);
  const version = assertSemver(packageVersion, 'Chrome 项目版本');
  if (parsed.version !== version) {
    throw new Error(`标签版本与 Chrome 项目版本不一致：标签=${parsed.version}，Chrome=${version}`);
  }
  return parsed;
}

export function createReleaseAssetNames(chromeVersion, vscodeVersion) {
  const chrome = assertSemver(chromeVersion, 'Chrome 项目版本');
  const vscode = assertSemver(vscodeVersion, 'VS Code 版本');
  return {
    chromeZip: `feishu-md-viewer-chrome-${chrome}.zip`,
    vscodeVsix: `feishu-md-viewer-vscode-${vscode}.vsix`,
  };
}

export function createReleaseNotes({ tag, chromeVersion, vscodeVersion, chromeZip, vscodeVsix }) {
  const parsed = parseReleaseTag(tag);
  const chrome = assertSemver(chromeVersion, 'Chrome 项目版本');
  const vscode = assertSemver(vscodeVersion, 'VS Code 版本');
  if (parsed.version !== chrome) {
    throw new Error(`Release 说明版本不一致：标签=${parsed.version}，Chrome=${chrome}`);
  }
  return [
    `## Feishu Markdown Viewer ${tag}`,
    '',
    `- Chrome 版本：\`${chrome}\``,
    `- VS Code 版本：\`${vscode}\``,
    '',
    '### 安装包',
    '',
    `- Chrome 扩展：\`${chromeZip}\``,
    `- VS Code 扩展：\`${vscodeVsix}\``,
    '',
    '### 自动化验证',
    '',
    '- 单元测试、类型检查、Chrome/VS Code 构建、产物校验和浏览器 E2E 已通过。',
    '- Windows 原生 VS Code GUI 验收仍请按照仓库中的发布前验收清单人工复核。',
    '',
  ].join('\n');
}

function getArgument(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function resolveTag(args) {
  return getArgument(args, '--tag') ?? process.env.GITHUB_REF_NAME ?? process.env.RELEASE_TAG;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function readReleaseMetadata({ rootDir = process.cwd(), tag } = {}) {
  const resolvedTag = tag ?? process.env.GITHUB_REF_NAME ?? process.env.RELEASE_TAG;
  if (!resolvedTag) throw new Error('缺少发布标签：请传入 --tag vX.Y.Z、GITHUB_REF_NAME 或 RELEASE_TAG');
  const chromePackage = await readJson(resolve(rootDir, 'package.json'));
  const vscodePackage = await readJson(resolve(rootDir, 'vscode-extension', 'package.json'));
  const parsed = assertChromeVersionMatchesTag(resolvedTag, chromePackage.version);
  const names = createReleaseAssetNames(parsed.version, vscodePackage.version);
  return {
    tag: parsed.tag,
    chromeVersion: parsed.version,
    vscodeVersion: assertSemver(vscodePackage.version, 'VS Code 版本'),
    ...names,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const metadata = await readReleaseMetadata({ tag: resolveTag(args) });
  const notes = createReleaseNotes(metadata);
  const outputPath = getArgument(args, '--output');
  const notesPath = getArgument(args, '--notes');
  if (outputPath) await writeFile(resolve(outputPath), `${JSON.stringify(metadata, null, 2)}\n`);
  if (notesPath) await writeFile(resolve(notesPath), notes);
  console.log(JSON.stringify(metadata));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`发布元数据预检失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

