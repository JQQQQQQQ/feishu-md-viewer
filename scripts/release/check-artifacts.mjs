import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, resolve } from 'node:path';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_ENTRY = 0x02014b50;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

function isSafeManifestPath(path) {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path)) return false;
  const normalized = normalize(path).replaceAll('\\', '/');
  return normalized !== '..' && !normalized.startsWith('../') && !normalized.includes('/../');
}

function collectManifestPaths(manifest) {
  const paths = [];
  const add = (value) => {
    if (typeof value === 'string') paths.push(value);
  };

  add(manifest?.background?.service_worker);
  add(manifest?.options_page);
  for (const script of manifest?.content_scripts ?? []) {
    for (const file of script?.js ?? []) add(file);
    for (const file of script?.css ?? []) add(file);
  }
  for (const icon of Object.values(manifest?.icons ?? {})) add(icon);
  for (const resourceGroup of manifest?.web_accessible_resources ?? []) {
    for (const resource of resourceGroup?.resources ?? []) add(resource);
  }
  return [...new Set(paths)];
}

function findZipEndOfCentralDirectory(buffer) {
  const minimumSize = 22;
  const start = Math.max(0, buffer.length - 0xffff - minimumSize);
  for (let index = buffer.length - minimumSize; index >= start; index -= 1) {
    if (buffer.readUInt32LE(index) === ZIP_END_OF_CENTRAL_DIRECTORY) return index;
  }
  return -1;
}

function listZipEntries(buffer) {
  const endOffset = findZipEndOfCentralDirectory(buffer);
  if (endOffset < 0) return [];

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const directorySize = buffer.readUInt32LE(endOffset + 12);
  const directoryOffset = buffer.readUInt32LE(endOffset + 16);
  const directoryEnd = Math.min(buffer.length, directoryOffset + directorySize);
  const entries = [];
  let offset = directoryOffset;

  for (let index = 0; index < entryCount && offset + 46 <= directoryEnd; index += 1) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_ENTRY) break;
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > directoryEnd) break;
    entries.push(buffer.subarray(fileNameStart, fileNameEnd).toString('utf8'));
    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function createReport() {
  const checks = [];
  const errors = [];
  const warnings = [];
  return {
    checks,
    errors,
    warnings,
    get ok() {
      return errors.length === 0;
    },
  };
}

function addCheck(report, name, ok, detail) {
  report.checks.push({ name, ok, detail });
  if (!ok) report.errors.push(`${name}: ${detail}`);
}

async function checkJsonFile(report, name, path) {
  const value = await readJson(path);
  addCheck(report, name, value !== null, value === null ? `文件不存在或不是有效 JSON：${path}` : '有效');
  return value;
}

async function checkChromeArtifacts(report, rootDir, chromeDistDir) {
  const sourceManifest = await checkJsonFile(report, 'Chrome 源 Manifest', join(rootDir, 'public', 'manifest.json'));
  const packageJson = await checkJsonFile(report, 'Chrome package.json', join(rootDir, 'package.json'));
  const builtManifest = await checkJsonFile(report, 'Chrome Manifest', join(chromeDistDir, 'manifest.json'));

  if (!sourceManifest || !builtManifest) return;

  const sourceVersionValid = SEMVER_PATTERN.test(String(sourceManifest.version ?? ''));
  const builtVersionValid = SEMVER_PATTERN.test(String(builtManifest.version ?? ''));
  const packageVersionValid = SEMVER_PATTERN.test(String(packageJson?.version ?? ''));
  addCheck(report, 'Chrome 版本格式', sourceVersionValid && builtVersionValid && packageVersionValid,
    sourceVersionValid && builtVersionValid && packageVersionValid
      ? `Chrome=${sourceManifest.version}，项目=${packageJson?.version ?? '未知'}`
      : 'Chrome Manifest 或根 package.json 版本不是三段数字格式');
  addCheck(report, 'Chrome Manifest 同步', sourceManifest.version === builtManifest.version,
    sourceManifest.version === builtManifest.version
      ? `版本 ${builtManifest.version}`
      : `版本不一致：源 Manifest=${sourceManifest.version}，构建 Manifest=${builtManifest.version}`);

  const manifestPaths = collectManifestPaths(builtManifest);
  const missing = (await Promise.all(manifestPaths.map(async (path) => (
    !isSafeManifestPath(path) || !(await exists(join(chromeDistDir, path))) ? path : null
  )))).filter((path) => path !== null);
  addCheck(report, 'Chrome Manifest 资源', missing.length === 0,
    missing.length === 0 ? `已检查 ${manifestPaths.length} 个资源` : `缺少或路径不安全：${missing.join(', ')}`);

  const chromeEntryPaths = [
    builtManifest.background?.service_worker,
    ...(builtManifest.content_scripts ?? []).flatMap((script) => script?.js ?? []),
  ].filter((path) => typeof path === 'string');
  const polluted = [];
  for (const path of chromeEntryPaths) {
    try {
      const source = await readFile(join(chromeDistDir, path), 'utf8');
      if (/\bvscode(?:\.|\/|['"])/i.test(source)) polluted.push(path);
    } catch {
      // Missing files are reported by the resource check above.
    }
  }
  addCheck(report, 'Chrome 入口跨端 API', polluted.length === 0,
    polluted.length === 0 ? '未发现 VS Code API' : `发现 VS Code API：${polluted.join(', ')}`);
}

async function checkVsCodeArtifacts(report, rootDir, vscodeDir) {
  const packageJson = await checkJsonFile(report, 'VS Code package.json', join(vscodeDir, 'package.json'));
  const hostEntry = join(vscodeDir, 'out', 'extension.js');
  addCheck(report, 'VS Code 宿主入口', await exists(hostEntry), `路径：${hostEntry}`);

  const webviewRoot = join(vscodeDir, 'dist');
  const indexPath = join(webviewRoot, 'index.html');
  const indexExists = await exists(indexPath);
  addCheck(report, 'VS Code Webview 入口', indexExists, `路径：${indexPath}`);
  if (!indexExists) return;

  const html = await readFile(indexPath, 'utf8');
  const references = [...html.matchAll(/(?:src|href)=["'](\.[^"']+)["']/g)].map((match) => match[1]);
  const missing = (await Promise.all(references.map(async (reference) => (
    !reference.startsWith('./assets/') || !(await exists(join(webviewRoot, reference.slice(2)))) ? reference : null
  )))).filter((reference) => reference !== null);
  addCheck(report, 'VS Code Webview 资源引用', missing.length === 0,
    missing.length === 0 ? `已检查 ${references.length} 个引用` : `缺少或不安全引用：${missing.join(', ')}`);

  const webviewScripts = references
    .filter((reference) => reference.endsWith('.js'))
    .map((reference) => join(webviewRoot, reference.slice(2)));
  const polluted = [];
  for (const path of webviewScripts) {
    try {
      const source = await readFile(path, 'utf8');
      if (/\bchrome\.(?:runtime|storage|tabs)\b/.test(source)) polluted.push(relative(rootDir, path));
    } catch {
      // Missing files are reported by the resource check above.
    }
  }
  addCheck(report, 'VS Code Webview 跨端 API', polluted.length === 0,
    polluted.length === 0 ? '未发现 chrome.* 运行时依赖' : `发现 chrome.*：${polluted.join(', ')}`);

  const versionValid = SEMVER_PATTERN.test(String(packageJson?.version ?? ''));
  addCheck(report, 'VS Code 版本格式', versionValid, versionValid ? `版本 ${packageJson.version}` : 'VS Code package.json 版本不是三段数字格式');
}

async function checkVsix(report, vsixPath, expectedVersion) {
  if (!vsixPath) return;
  if (!(await exists(vsixPath))) {
    addCheck(report, 'VSIX 文件', false, `文件不存在：${vsixPath}`);
    return;
  }

  let entries;
  try {
    entries = listZipEntries(await readFile(vsixPath));
  } catch {
    entries = [];
  }
  const required = ['extension/package.json', 'extension/out/extension.js', 'extension/dist/index.html'];
  const missing = required.filter((entry) => !entries.includes(entry));
  addCheck(report, 'VSIX 内容', missing.length === 0,
    missing.length === 0 ? `已发现 ${entries.length} 个 ZIP 条目` : `缺少：${missing.join(', ')}`);

  const packageEntry = entries.includes('extension/package.json');
  if (packageEntry && expectedVersion) {
    const buffer = await readFile(vsixPath);
    const versionText = buffer.toString('utf8');
    addCheck(report, 'VSIX 版本', versionText.includes(`"version":"${expectedVersion}"`) || versionText.includes(`"version": "${expectedVersion}"`),
      `期望版本 ${expectedVersion}`);
  }
}

export async function inspectArtifacts({
  rootDir = process.cwd(),
  chromeDistDir = join(rootDir, 'dist'),
  vscodeDir = join(rootDir, 'vscode-extension'),
  vsixPath,
} = {}) {
  const report = createReport();
  await checkChromeArtifacts(report, rootDir, chromeDistDir);
  await checkVsCodeArtifacts(report, rootDir, vscodeDir);

  const vscodePackage = await readJson(join(vscodeDir, 'package.json'));
  await checkVsix(report, vsixPath, vscodePackage?.version);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectArtifacts({
    rootDir: process.cwd(),
    vsixPath: process.env.VSIX_PATH ? resolve(process.env.VSIX_PATH) : undefined,
  });
  for (const check of report.checks) {
    console.log(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`);
  }
  for (const warning of report.warnings) console.warn(`⚠ ${warning}`);
  if (!report.ok) {
    for (const error of report.errors) console.error(`错误：${error}`);
    process.exitCode = 1;
  }
}
