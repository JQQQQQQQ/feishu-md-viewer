import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const distDir = join(root, 'dist');
const assetsDir = join(distDir, 'assets');

const budgets = {
  distTotalBytes: 2_800_000,
  viewerEntryChunkBytes: 420_000,
  contentChunkBytes: 80_000,
};

function walkFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function collect() {
  const distFiles = walkFiles(distDir);
  const assetFiles = walkFiles(assetsDir);
  const distTotalBytes = distFiles.reduce((sum, file) => sum + statSync(file).size, 0);

  let viewerEntryChunkBytes = 0;
  let contentChunkBytes = 0;
  for (const file of assetFiles) {
    const size = statSync(file).size;
    const name = file.split(/[\\/]/).pop() ?? '';
    if (/^(?:App|viewer)-.*\.js$/i.test(name)) viewerEntryChunkBytes = Math.max(viewerEntryChunkBytes, size);
    if (/^content-.*\.js$/i.test(name)) contentChunkBytes = Math.max(contentChunkBytes, size);
  }

  return {
    distTotalBytes,
    viewerEntryChunkBytes,
    contentChunkBytes,
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

const current = collect();
const results = [
  {
    label: 'dist 总体积',
    current: current.distTotalBytes,
    budget: budgets.distTotalBytes,
  },
  {
    label: 'viewer 入口 chunk (App/viewer)',
    current: current.viewerEntryChunkBytes,
    budget: budgets.viewerEntryChunkBytes,
  },
  {
    label: 'content chunk',
    current: current.contentChunkBytes,
    budget: budgets.contentChunkBytes,
  },
];

let failed = 0;
console.log('== Bundle Budget Check ==');
for (const item of results) {
  const ok = item.current <= item.budget;
  if (!ok) failed += 1;
  const prefix = ok ? 'PASS' : (strict ? 'FAIL' : 'WARN');
  console.log(
    `[${prefix}] ${item.label}: ${formatBytes(item.current)} / 预算 ${formatBytes(item.budget)}`
  );
}

if (strict && failed > 0) {
  console.error(`\n预算检查失败，共 ${failed} 项超标。`);
  process.exit(1);
}
