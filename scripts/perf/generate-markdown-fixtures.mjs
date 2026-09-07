import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SIZE_BYTES = {
  1: 1 * 1024 * 1024,
  3: 3 * 1024 * 1024,
  5: 5 * 1024 * 1024,
};

function readOption(name, fallback) {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const sizeMb = Number(readOption('--size', '1'));
const outputDir = resolve(readOption('--output-dir', 'tests/fixtures/large-documents'));
const targetBytes = SIZE_BYTES[sizeMb];
if (!targetBytes) {
  throw new Error(`--size 必须是 1、3 或 5，收到：${sizeMb}`);
}

const sections = [
  '# 大文档性能测试 Fixture',
  '',
  '该文档用于验证 Markdown 顶层块索引、局部解析和刷新期间的视口稳定性。',
  '',
];
let currentBytes = Buffer.byteLength(sections.join('\n'), 'utf8');
let section = 0;
while (currentBytes < targetBytes) {
  const marker = `PERF_MARKER_${String(section).padStart(4, '0')}`;
  const block = [
    `## 性能区块 ${section}`,
    '',
    marker,
    '',
    '这是一段用于占位和测量的大文档文本，包含 **粗体**、`内联代码`、链接和列表。',
    '',
    `- 列表项 ${section}-1`,
    `- 列表项 ${section}-2`,
    '  - 嵌套列表项',
    '',
  ];
  if (section % 5 === 0) {
    block.push(
      '| 名称 | 状态 | 说明 |',
      '| --- | --- | --- |',
      `| table-${section} | ready | 局部刷新表格 |`,
      '',
      '```typescript',
      `export const block${section} = ${section};`,
      '```',
      '',
    );
  }
  if (section % 11 === 0) {
    block.push(
      '```mermaid',
      'flowchart TD',
      `  A${section}[开始] --> B${section}{检查}`,
      `  B${section} -->|通过| C${section}[完成]`,
      `  B${section} -->|失败| D${section}[修复]`,
      `  D${section} --> B${section}`,
      '```',
      '',
    );
  }
  sections.push(...block);
  currentBytes += Buffer.byteLength(`${block.join('\n')}\n`, 'utf8');
  section += 1;
}

await mkdir(outputDir, { recursive: true });
const outputPath = join(outputDir, `large-${sizeMb}mb.md`);
const content = sections.join('\n');
await writeFile(outputPath, content, 'utf8');
console.log(`${outputPath} ${Buffer.byteLength(content, 'utf8')} bytes`);
