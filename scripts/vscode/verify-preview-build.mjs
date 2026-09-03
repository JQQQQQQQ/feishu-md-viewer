import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(scriptDirectory, '../..');
const projectRoot = resolve(process.env.VERIFY_PREVIEW_BUILD_ROOT ?? defaultProjectRoot);
const chromeDistDirectory = resolve(projectRoot, 'dist');
const vscodeExtensionDirectory = resolve(projectRoot, 'vscode-extension');
const vscodeDistDirectory = resolve(vscodeExtensionDirectory, 'dist');
const vscodePackagePath = resolve(vscodeExtensionDirectory, 'package.json');
const vscodeHostConfigPath = resolve(vscodeExtensionDirectory, 'tsconfig.host.json');
const javaScriptExtensions = new Set(['.js', '.mjs', '.cjs']);
const vscodeApiImportPattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]vscode['"]/;

function fail(message) {
  throw new Error(message);
}

function assertDirectory(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    fail(`${label}不存在或不是目录：${path}`);
  }
}

function assertFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    fail(`${label}不存在或不是文件：${path}`);
  }
}

function isInside(parentDirectory, childPath) {
  const relativePath = relative(parentDirectory, childPath);
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }
    return entry.isFile() ? [entryPath] : [];
  });
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`${label}无法解析：${path}（${reason}）`);
  }
}

function verifyBuildOutputs() {
  assertDirectory(chromeDistDirectory, 'Chrome 构建目录 dist');
  assertDirectory(vscodeDistDirectory, 'VS Code Webview 构建目录 vscode-extension/dist');

  const vscodeWebviewIndexPath = resolve(vscodeDistDirectory, 'index.html');
  assertFile(vscodeWebviewIndexPath, 'VS Code Webview index.html');
  const vscodeWebviewFiles = listFiles(vscodeDistDirectory);
  const webviewJavaScriptFiles = vscodeWebviewFiles.filter((path) => extname(path) === '.js');
  const webviewStyleFiles = vscodeWebviewFiles.filter((path) => extname(path) === '.css');
  if (webviewJavaScriptFiles.length === 0) {
    fail(`VS Code Webview 构建目录未找到 JavaScript 入口：${vscodeDistDirectory}`);
  }
  if (webviewStyleFiles.length === 0) {
    fail(`VS Code Webview 构建目录未找到 CSS 产物：${vscodeDistDirectory}`);
  }
  const webviewJavaScript = webviewJavaScriptFiles
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  const webviewStyles = webviewStyleFiles
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  if (!webviewJavaScript.includes('feishu-dot')) {
    fail(`VS Code Webview JavaScript 未包含 DOT 预览分支：${vscodeDistDirectory}`);
  }
  if (!webviewStyles.includes('feishu-dot')) {
    fail(`VS Code Webview CSS 未包含 DOT 图表样式：${vscodeDistDirectory}`);
  }
  const webviewIndex = readFileSync(vscodeWebviewIndexPath, 'utf8');
  const referencedAssetUrls = [...webviewIndex.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1]);
  const absoluteAsset = referencedAssetUrls.find((asset) => asset.startsWith('/'));
  if (absoluteAsset) {
    fail(`VS Code Webview 资源必须使用相对路径，不能使用绝对路径：${absoluteAsset}`);
  }
  const referencedAssets = referencedAssetUrls
    .filter((asset) => asset.startsWith('./'))
    .map((asset) => resolve(vscodeDistDirectory, asset.slice(2)));
  for (const assetPath of referencedAssets) {
    assertFile(assetPath, 'VS Code Webview index 引用的资源');
  }

  if (chromeDistDirectory === vscodeDistDirectory) {
    fail(`Chrome 与 VS Code 构建目录必须隔离，当前均为：${chromeDistDirectory}`);
  }

  assertFile(vscodePackagePath, 'VS Code 扩展 package.json');
  assertFile(vscodeHostConfigPath, 'VS Code 宿主 tsconfig.host.json');

  const vscodePackage = readJson(vscodePackagePath, 'VS Code 扩展 package.json');
  const hostConfig = readJson(vscodeHostConfigPath, 'VS Code 宿主 tsconfig.host.json');
  const main = vscodePackage.main;
  const hostOutDir = hostConfig.compilerOptions?.outDir;

  if (typeof main !== 'string' || main.trim() === '') {
    fail('VS Code 扩展 package.json 必须声明非空 main 字段。');
  }
  if (typeof hostOutDir !== 'string' || hostOutDir.trim() === '') {
    fail('VS Code 宿主 tsconfig.host.json 必须声明 compilerOptions.outDir。');
  }

  const hostOutputDirectory = resolve(vscodeExtensionDirectory, hostOutDir);
  const hostMainPath = resolve(vscodeExtensionDirectory, main);
  if (!isInside(vscodeExtensionDirectory, hostMainPath)) {
    fail(`VS Code 扩展 package.main 不能指向扩展目录之外：${main}`);
  }
  if (!isInside(hostOutputDirectory, hostMainPath)) {
    fail(`VS Code 扩展 package.main 必须指向宿主输出目录 ${hostOutDir}：${main}`);
  }
  assertFile(hostMainPath, 'package.main 指向的 VS Code 宿主输出');

  const chromeJavaScriptFiles = listFiles(chromeDistDirectory).filter((path) => javaScriptExtensions.has(extname(path)));
  if (chromeJavaScriptFiles.length === 0) {
    fail(`Chrome 构建目录未找到 JavaScript 产物：${chromeDistDirectory}`);
  }

  const vscodeImports = chromeJavaScriptFiles.filter((path) => vscodeApiImportPattern.test(readFileSync(path, 'utf8')));
  if (vscodeImports.length > 0) {
    const relativeImports = vscodeImports.map((path) => relative(projectRoot, path)).join('、');
    fail(`Chrome 构建产物不应包含 VS Code API 导入：${relativeImports}`);
  }

  console.log('构建隔离验证通过');
  console.log(`- Chrome 产物：${chromeDistDirectory}`);
  console.log(`- VS Code Webview 产物：${vscodeDistDirectory}`);
  console.log(`- VS Code 宿主入口：${hostMainPath}`);
  console.log(`- 已扫描 Chrome JavaScript 文件：${chromeJavaScriptFiles.length} 个`);
}

try {
  verifyBuildOutputs();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`构建隔离验证失败：${message}`);
  process.exitCode = 1;
}
