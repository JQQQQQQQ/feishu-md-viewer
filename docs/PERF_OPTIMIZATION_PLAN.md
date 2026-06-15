# 扩展体积与内存优化计划

## 1. 目标与范围

### 目标

1. 构建产物体积下降，降低下载与解析成本。
2. 打开大型 Markdown 文档时降低峰值内存占用。
3. 在不牺牲核心体验（阅读、编辑、Mermaid、TOC）的前提下持续优化。

### 范围

1. 包体积优化：构建分包、按需加载、依赖裁剪、预算门禁。
2. 运行内存优化：读写分离、缓存上限、历史快照压缩、重型节点懒渲染。

## 2. 基线指标（待每次构建更新）

执行命令：

```bash
npm run build
npm run perf:bundle
npm run perf:budget
```

关键指标：

1. `dist` 总体积（bytes / KB / MB）
2. `App-*.js` 体积
3. `content-*.js` 体积
4. Mermaid 相关资产 Top N

### 2026-05-20 基线（Windows 构建目录实测）

构建目录：`C:\Users\Q\feishu-md-viewer-build`  
分发目录：`C:\Users\Q\feishu-md-viewer-dist`（复制前先清空，避免历史 hash 文件残留导致体积虚高）

1. `dist` 总体积：`3,930,504 bytes`（约 `3.75 MB`）
2. `App-*.js`：`253,479 bytes`（约 `247.5 KB`）
3. `content-*.js`：`89,434 bytes`（约 `87.3 KB`）
4. `WysiwygEditor-*.js`：`377,112 bytes`（约 `368 KB`，已从主 `App` chunk 分离）
5. `mermaid.core-*.js`：`585,146 bytes`（约 `571 KB`）
6. 预算检查结果（`npm run perf:budget`）：
   - `dist` 总体积：`WARN`（3838.4KB / 预算 2734.4KB）
   - `App` 主 chunk：`PASS`（247.5KB / 预算 410.2KB）
   - `content` chunk：`WARN`（87.3KB / 预算 78.1KB）

结论：

1. 主应用首屏 chunk 已显著降低（编辑器拆分生效）。
2. 总包体积仍主要受 Mermaid 生态相关 chunk 影响，后续重点应放在 Phase 2 的 Mermaid 分包与可选化策略。

### 2026-05-20 Phase 2 手动分包实测

策略：在 `vite.config.ts` 增加 `manualChunks`，按 `mermaid / react / markdown` 分组。

对比（相同构建目录）：

1. `dist` 总体积：`3,930,504 -> 3,930,032 bytes`（基本持平）
2. viewer 入口 chunk：`App-*.js 253,479 bytes -> viewer-*.js 4,600 bytes`
3. `content-*.js`：`89,434 -> 89,528 bytes`（基本持平，略增）
4. Mermaid 主相关 chunk：由多文件分散，收敛为 `mermaid-vendor-*.js` 单块约 `2.87 MB`

阶段结论：

1. 首屏入口 JS 负载进一步下降，读模式入口解析成本显著降低。
2. 总包体积未明显下降，Mermaid 相关体积仍是绝对主因。
3. 下一步重点不是继续粗粒度手动分包，而是 Mermaid 图类型按需加载或能力开关化（Phase 2 第 2 项）。

### 2026-05-20 Phase 2 调优（二次实测）

问题：将 Mermaid 生态依赖整体收敛到 `mermaid-vendor` 后，会弱化 Mermaid 的图类型懒加载优势，形成超大单 chunk。

调整：`manualChunks` 仅保留 `react` 与 `markdown` 分组，不再强行合并 Mermaid 相关依赖（交回 Mermaid/rollup 默认拆分）。

对比（与 2026-05-20 基线）：

1. `dist` 总体积：`3,930,504 -> 3,933,177 bytes`（+0.07%，基本持平）
2. viewer 入口 chunk：`247.5 KB -> 190.1 KB`（下降约 `23.2%`）
3. `content-*.js`：`87.3 KB -> 87.4 KB`（基本持平）
4. Mermaid 形态：恢复为多图类型分块（保留按需懒加载能力）

结论：

1. 在不牺牲 Mermaid 懒加载特性的前提下，入口负载继续下降。
2. 总包体积仍未进入预算，后续要从“能力裁剪（例如可选图类型）”而不是“再做粗分包”入手。

## 3. 分阶段实施

### Phase 0（可观测性与门禁）

1. 提供体积报告脚本：`scripts/perf/report-bundle-size.mjs`
2. 提供预算检查脚本：`scripts/perf/check-budgets.mjs`
3. 在 CI 中先以 `WARN` 模式运行，稳定后切 `--strict`。

### Phase 1（高收益低风险）

1. 读写分离：读模式不加载 Milkdown（编辑器组件按需懒加载）。
2. 编辑历史压缩：减少快照数量并合并短时间连续输入。
3. Mermaid 缓存按字节上限淘汰，避免长期会话内存持续上涨。

### Phase 2（深度体积治理）

1. 手动分包（`manualChunks`）拆分 `viewer-shell` / `editor` / `mermaid`。
2. Mermaid 重型图类型按需加载或配置化开关。
3. 排查并移除非必要运行时代码路径。

### Phase 3（长文档内存治理）

1. 按 section 懒渲染重型区块（大表格 / Mermaid）。
2. 对超长文档引入分段渲染策略。
3. 优化内容脚本注入后与宿主页并存时的内存占用。

## 4. 验收标准

1. `dist` 总体积持续下降并稳定在预算内。
2. 读模式加载大文档峰值内存下降（建议目标 >= 35%）。
3. 编辑模式可用性不回退（模式切换、表格编辑、Mermaid 编辑、目录导航）。

## 5. 回归检查清单

1. 标题折叠/展开行为正确。
2. TOC 点击可滚动到正确位置。
3. 表格选区、复制、双击编辑行为正确。
4. Mermaid 预览/导出可用。
5. source/edit/read 模式切换后滚动位置恢复正常。
