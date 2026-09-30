# 大文档渐进渲染验收记录

## 自动化结果

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| 单元测试 | `TMPDIR=/tmp npm test -- --run` | 71 个测试文件、539 个测试通过 |
| 类型检查 | `npm run typecheck` | 通过 |
| Chrome 构建 | `npm run build` | 通过 |
| VS Code 构建 | `npm run build:vscode` | 通过 |
| VS Code 产物隔离 | `npm run verify:vscode` | 通过，扫描 64 个 Chrome JavaScript 文件 |
| 变更文件 ESLint | `npx eslint ... --max-warnings 0` | 通过 |
| 空白检查 | `git diff --check` | 通过 |

## 新增回归覆盖

- 大文档阈值命中和普通文档同步路径保持不变。
- 正文首批块先提交，后续批次在调度器中补齐。
- 后续批次只在滚动接近占位区时按需提交，不再在后台连续排空整篇文档。
- 调度器取消后旧批次不能写回新文档。
- 深层目录跳转使用导航批处理，避免逐批等待到目标标题。
- 深层导航完成后使用目标附近的批次窗口和前后占位，避免一次性提交目标前的全部正文 DOM。
- 大目录默认不递归渲染全部子节点，只保留根级节点。
- 初始 URL 锚点在目标块尚未提交时，会在后续批次完成后重试定位。
- 目录点击未挂载标题时，会请求正文加载目标批次，目标标题挂载后再滚动和高亮。
- 原有表格身份、目录跳转、Mermaid、VS Code Webview 和刷新测试继续通过。

## 当前环境限制

浏览器 E2E 命令已执行：

```bash
TMPDIR=/tmp npm run test:e2e -- tests/e2e/browser/large-document-performance.spec.ts
```

当前容器中的 Chromium 在启动带扩展的持久化上下文时收到 `SIGTRAP`，同时输出 `crashpad setsockopt: Operation not permitted`。失败发生在浏览器启动阶段，未进入页面断言，不代表渐进渲染断言失败。需要在有图形环境的 Windows Chrome 或配置了 `xvfb-run` 的 CI 中复跑真实页面 E2E。

## 手工验收

构建产物位于：

- Chrome：`/root/workspace/feishu-md-viewer/dist`
- VS Code Webview：`/root/workspace/feishu-md-viewer/vscode-extension/dist`
- VS Code 宿主：`/root/workspace/feishu-md-viewer/vscode-extension/out/extension.js`

手工打开 1 MB、3 MB 和 5 MB 文档时，重点确认首屏先出现、后续内容补齐、目录大文档模式默认收起、锚点可定位、表格状态不因批次提交丢失。
