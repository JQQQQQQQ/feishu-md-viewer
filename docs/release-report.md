# 发布质量与 E2E 验收报告

## 报告信息

| 字段             | 值                                         |
| ---------------- | ------------------------------------------ |
| 验收日期         | 2026-08-26                                 |
| 基线提交         | `55f61d6e192c3d7a8f3bd428271b11eb7022b894` |
| Chrome 项目版本  | `0.1.0`（Manifest `1.0.0`）                |
| VS Code 扩展版本 | `0.1.6`                                    |
| Node 验证环境    | Node.js 22.22.2，Playwright 1.62.1         |
| 浏览器运行方式   | headed Chromium，临时文件 Fixture          |

## 自动化测试结果

最终命令：

```bash
TMPDIR=/tmp RUN_E2E=1 E2E_HEADLESS=0 npm run verify:release
```

结果：PASS。

| 阶段             | 结果 |     耗时 | 说明                                                     |
| ---------------- | ---- | -------: | -------------------------------------------------------- |
| 单元测试         | PASS |  7858 ms | 51 个测试文件，386 个测试通过                            |
| 类型检查         | PASS |  3039 ms | `tsc --noEmit`                                           |
| Chrome 构建      | PASS | 15890 ms | 输出根目录 `dist/`                                       |
| VS Code 构建     | PASS | 14302 ms | 输出 `vscode-extension/out/` 和 `vscode-extension/dist/` |
| VS Code 产物验证 | PASS |   210 ms | 构建目录隔离、资源路径和入口检查通过                     |
| 发布产物检查     | PASS |   224 ms | Manifest、版本、资源引用和跨端 API 检查通过              |
| 浏览器 E2E       | PASS | 24616 ms | 8/8 场景通过                                             |

额外执行的 `npm run lint` 当前为 BLOCKED：仓库已有表格选择轨道和 Mermaid 弹窗上的 `jsx-a11y` 交互元素规则错误（`FeishuTable.tsx`、`MermaidPreviewModal.tsx`），本次未为发布验收掩盖或扩大修复范围；该命令未纳入本次 `verify:release` 固定门禁。

已知警告：Mermaid 在 JSDOM 测试环境中会输出 `getBBox is not a function` 警告；真实浏览器 E2E 中 Mermaid 正常图和错误图均通过，因此该警告不影响门禁退出码。

## 浏览器 E2E 结果

Fixture：`tests/e2e/fixtures/all-markdown-features.md`，每个场景使用临时副本并在结束后清理。

- 本地 Markdown 文件进入 Feishu 只读预览。
- 目录定位准确，折叠目录不改变正文布局。
- 有效 Mermaid 显示图表，无效 Mermaid 显示错误降级且不阻塞正文。
- 主题切换后正文与 Mermaid 保持可见。
- Mermaid 预览弹窗滚轮事件保留在图表视口。
- 自动刷新局部替换正文并保留滚动位置，不显示手动刷新按钮。
- 手动刷新提示只出现一次，点击后正文更新且提示消失。
- 单元格、整列选择和多列 TSV 复制通过。

失败时 Playwright 会保留 `test-results/` 中的截图、HTML 上下文和 trace；这些目录已加入 `.gitignore`。

## VS Code 自动检查结果

现有 Provider/Webview 测试与构建检查纳入全量单元测试和发布门禁，覆盖：

- Custom Editor 默认优先级和只读行为。
- 文档版本更新、过期消息丢弃和 Webview 重建后的最新快照。
- 宿主全局主题、字号、目录滚动、正文对齐设置同步。
- 表格列宽持久化和文档外部更新消息。
- Webview 不依赖 `chrome.*`，Chrome 入口不导入 VS Code API。
- VS Code Webview HTML 的 JavaScript/CSS 相对资源引用可解析。

## VS Code 手工验收结果

状态：BLOCKED（当前会话无法启动 Windows 原生 VS Code 并使用干净 Profile 安装 VSIX）。

请在 Windows 上按 [发布前验收清单](./release-acceptance.md) 逐项记录实际结果，尤其复核默认只读预览、主题持久化、外部文件更新、表格复制、Mermaid 动态资源和 `Reopen Editor With…` 回退路径。自动化通过不能替代该项人工验收。

## 产物路径

- Chrome 扩展：`dist/`
- VS Code Webview：`vscode-extension/dist/`
- VS Code 宿主：`vscode-extension/out/extension.js`
- VSIX（如执行打包）：`vscode-extension/feishu-md-viewer-vscode-<version>.vsix`

## 未解决阻塞项

1. Windows 原生 VS Code GUI 验收尚未执行，发布前必须补齐并把结果写回 `docs/release-acceptance.md`。

## 自动发布工作流验证（2026-08-27）

本次新增的标签发布工作流和打包链路已完成本地验证：

| 项目                | 结果 | 说明                                                                                                          |
| ------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| 发布元数据聚焦测试  | PASS | 8 项，覆盖标签格式、Chrome 版本一致性、双端资产命名和 Release 说明                                            |
| 发布打包聚焦测试    | PASS | 5 项，覆盖 Chrome ZIP、VSIX、无 `zip` 命令的 Python 回退、无 `pnpm` 命令的 Corepack 回退和 VS Code 仓库元数据 |
| 发布工作流静态测试  | PASS | 2 项，确认标签触发、最小权限、E2E 和最终资产检查顺序                                                          |
| 发布文档测试        | PASS | 1 项，确认发布命令和失败边界文档完整                                                                          |
| 全量单元测试        | PASS | 55 个测试文件，403 项通过                                                                                     |
| 本地打包演练        | PASS | 生成 Chrome ZIP（约 1.0 MB）和 VSIX（约 1.0 MB）                                                              |
| VSIX 内容与版本检查 | PASS | 27 个 ZIP 条目，版本 `0.1.6` 与 VS Code package.json 一致                                                     |

本地演练使用 `v0.1.0` 作为已存在版本，只生成 `/tmp/feishu-release-smoke/` 下的临时文件，没有调用 `gh release create`，也没有修改已有 GitHub Release。GitHub Actions 发布时使用 Ubuntu Runner 自带的 `zip` 和 `pnpm/action-setup`，缺少命令的本地回退不会影响 CI 主路径。
