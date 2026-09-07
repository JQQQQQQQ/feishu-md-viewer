# 大文档性能验收报告

## 验收范围

本次实现覆盖 1～5 MB Markdown 文档的：

- 内容哈希和最近两份解析结果缓存；
- 顶层 Markdown 块索引、稳定块键和安全差异匹配；
- 全局标题 ID、标题路径和表格序号元数据；
- 阅读视图中未变化块的 React / DOM 复用；
- 本地文件自动刷新和手动刷新共用的 `noop`、`incremental`、`full` 规划；
- 1 MB、3 MB、5 MB 性能 fixture 生成器和浏览器 E2E 用例；
- `markdown-index`、`markdown-parse`、`markdown-react-commit`、`markdown-refresh-diff` 性能采样点。

## 已通过验证

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | TypeScript 无错误 |
| `TMPDIR=/tmp npm test -- --run` | 通过 | 70 个测试文件、525 个测试通过 |
| `npm run build` | 通过 | Chrome `dist` 构建完成 |
| `npm run build:vscode` | 通过 | VS Code WebView 和宿主入口构建完成 |
| `npm run verify:vscode` | 通过 | 输出“构建隔离验证通过”，扫描 Chrome JavaScript 64 个 |
| 变更文件 ESLint | 通过 | `npx eslint` 针对本次新增 / 修改的性能文件无错误 |
| `npm run perf:fixtures -- --size=1 --output-dir=/tmp/feishu-md-fixtures-check` | 通过 | 生成 1,048,719 字节 fixture |
| `npm run perf:fixtures -- --size=3 --output-dir=/tmp/feishu-md-fixtures-check` | 通过 | 生成约 3.1 MB fixture |
| `npm run perf:fixtures -- --size=5 --output-dir=/tmp/feishu-md-fixtures-check` | 通过 | 生成 5,242,885 字节 fixture |

新增纯函数 / 组件回归覆盖：

- 8 个 Markdown 块索引和差异测试；
- 4 个刷新计划测试；
- 2 个阅读视图 DOM 复用测试；
- 现有表格身份、宽度恢复、目录定位、Mermaid、HTML 安全和 VS Code 测试全部保持通过。

## 浏览器 E2E 状态

执行命令：

```bash
TMPDIR=/tmp npm run test:e2e -- tests/e2e/browser/large-document-performance.spec.ts
```

Playwright 能够加载测试文件，但容器 Chromium 在带扩展启动阶段退出：

- 1 MB 用例：未进入页面断言，浏览器启动失败；
- 3 MB / 5 MB 用例：因串行测试前置失败，未执行；
- Chromium 进程退出信号：`SIGTRAP`；
- 日志包含：`crashpad ... setsockopt: Operation not permitted (1)`；
- 当前环境没有 `xvfb-run`，无法使用项目既定的 headed + Xvfb 路径重试。

因此本次没有取得浏览器端首次可见耗时、局部刷新耗时或真实 DOM 复用截图，不能据此宣称已经完成 1～5 MB 的实机性能基准。获得可用的 Windows Chrome / Xvfb 环境后，应重新执行该 E2E 文件，并记录五类 `performance.measure` 项。

## 非阻塞基线问题

- `npm run lint` 仍报告仓库既有的 `FeishuTable.tsx` 和 `MermaidPreviewModal.tsx` 可访问性规则错误，以及一个已有 Hook 依赖警告；本次性能文件的定向 ESLint 已通过。
- `npm run format:check` 仍报告仓库中多处历史文件未按 Prettier 格式化；本次新增文件已单独格式化，未对历史文件做大范围重排。
- Vitest 中 Mermaid 的 jsdom 环境仍会输出 `SVGTextElement.getBBox` 不存在的既有日志，但相关测试断言通过，Chrome / VS Code 构建正常。

## 范围检查

本次性能实现没有修改：

- rehype-sanitize 的安全白名单；
- Mermaid 语法和 SVG 清洗规则；
- 表格选择、复制、列宽持久化和横向滚动交互；
- 图片预览、主题、正文对齐和目录设置。

刷新遇到相同内容、未闭合代码围栏、无法确认 HTML / 列表边界或标题路径变化时，会分别走 `noop` 或整篇回退，避免用不完整的块树替换用户当前可见内容。

