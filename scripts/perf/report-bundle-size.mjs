import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const assetsDir = join(distDir, 'assets');

function walkFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[idx]}`;
}

function safeWalk(dir) {
  try {
    return walkFiles(dir);
  } catch {
    return [];
  }
}

const distFiles = safeWalk(distDir);
const assetFiles = safeWalk(assetsDir);
const assetStats = assetFiles.map((filePath) => ({
  filePath,
  rel: relative(root, filePath),
  bytes: statSync(filePath).size,
}));

const distBytes = distFiles.reduce((sum, filePath) => sum + statSync(filePath).size, 0);
const jsAssets = assetStats.filter((item) => item.filePath.endsWith('.js'));
const cssAssets = assetStats.filter((item) => item.filePath.endsWith('.css'));

const topAssets = [...assetStats]
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 20);

const mermaidAssets = assetStats
  .filter((item) => /mermaid|Diagram|diagram|cytoscape|wardley|katex/i.test(item.rel))
  .sort((a, b) => b.bytes - a.bytes);

console.log('== Bundle Size Report ==');
console.log(`dist 总体积: ${formatSize(distBytes)} (${distBytes} bytes)`);
console.log(`assets 总文件数: ${assetStats.length}`);
console.log(`JS 体积: ${formatSize(jsAssets.reduce((sum, item) => sum + item.bytes, 0))}`);
console.log(`CSS 体积: ${formatSize(cssAssets.reduce((sum, item) => sum + item.bytes, 0))}`);
console.log('');

console.log('Top 20 assets:');
for (const item of topAssets) {
  console.log(`- ${item.rel}: ${formatSize(item.bytes)} (${item.bytes})`);
}
console.log('');

console.log('Heavy Mermaid-related assets:');
for (const item of mermaidAssets.slice(0, 20)) {
  console.log(`- ${item.rel}: ${formatSize(item.bytes)} (${item.bytes})`);
}

