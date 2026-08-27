# GitHub Markdown 兼容性矩阵

本文档是 `test-markdown-compatibility.md` 的验收记录。只有完成对应的自动化测试和 Chrome / VS Code 实际检查后，项目才可以将状态更新为 `PASS`。自动化覆盖包括 `tests/unit/markdown-html-compatibility.test.tsx`、`tests/unit/markdown-resource-resolver.test.ts` 和浏览器 E2E 的“GitHub README 常见 HTML 结构和相对链接可安全预览”用例。

状态定义：

- `PASS`：Chrome 和 VS Code 均通过自动化和人工检查。
- `DEGRADED`：安全保留可读内容，但与 GitHub 原生展示有明确差异。
- `UNSUPPORTED`：明确不支持，展示统一降级结果。
- `BLOCKED`：因为运行环境或外部资源暂时无法验证。

## P0 展示结构

| 场景 | Chrome | VS Code | 安全处理 | 降级行为 | 自动化测试 |
| --- | --- | --- | --- | --- | --- |
| details / summary | DEGRADED | DEGRADED | 原生折叠、仅保留 `open` | 过滤时保留 summary 和正文 | pipeline + E2E |
| picture / source | DEGRADED | DEGRADED | 解析 `srcset`、`media`、`sizes` | 回退到 img | pipeline + E2E |
| kbd | DEGRADED | DEGRADED | 保留文本和安全 class | 按普通内联文本显示 | pipeline |
| video | DEGRADED | BLOCKED | 只允许 controls、poster、preload | 显示 fallback 文本 | pipeline + CSP + E2E |
| 图片徽章 | PASS | PASS | 按普通懒加载图片处理 | 显示 alt | pipeline + E2E |
| 贡献者头像区域 | PASS | PASS | 图片和外链分开校验 | 显示 alt | pipeline + E2E |
| HTML table | PASS | PASS | 接入现有表格组件 | 降级为安全表格结构 | pipeline + table E2E |
| 内嵌 div 布局 | DEGRADED | DEGRADED | 仅保留安全布局属性 | 按块级内容显示 | pipeline + E2E |
| 图片懒加载属性 | PASS | PASS | 保留 `loading` / `decoding` | 使用默认加载策略 | pipeline |
| GitHub 任务列表 | PASS | PASS | 只读 checkbox，保留 checked | 显示任务文本 | pipeline + E2E |
| GitHub 标题锚点 | DEGRADED | DEGRADED | 使用当前预览生成的 ID | 无目标时不滚动 | link + E2E |

## P1 资源和链接

| 场景 | Chrome | VS Code | 解析基准 | 安全策略 | 自动化测试 |
| --- | --- | --- | --- | --- | --- |
| 本地 file 相对图片 | BLOCKED | BLOCKED | 当前 Markdown 所在目录 | 只接受 file / http(s) | resolver + E2E |
| GitHub blob 相对图片 | BLOCKED | BLOCKED | 对应 raw 目录 | 只接受 raw http(s) | resolver + E2E |
| GitHub raw 相对图片 | BLOCKED | BLOCKED | 当前 raw 文件目录 | 只接受 http(s) | resolver |
| GitLab blob 相对图片 | BLOCKED | BLOCKED | 对应 `/-/raw/` 目录 | 只接受 raw http(s) | resolver |
| 相对 Markdown 链接 | BLOCKED | BLOCKED | blob 或文件目录 | 允许安全文档链接 | resolver |
| GitHub raw 图片链接 | PASS | PASS | 绝对 URL 原样保留 | 通过协议校验 | pipeline |
| 当前文档 internal anchor | BLOCKED | BLOCKED | 当前预览根节点 | `scrollIntoView`，不新开页 | link + E2E |
| 外部链接 | PASS | PASS | 绝对 URL 原样保留 | `noopener noreferrer` | link |
| 下载链接 | DEGRADED | DEGRADED | 文档链接基准 | 新标签页打开，不代理下载 | resolver |
| 危险 URL | PASS | PASS | 不解析 | 移除或显示安全文本 | sanitization |

## HTML 安全边界

| 内容 | 处理方式 |
| --- | --- |
| `script`、事件属性 `on*` | 移除 |
| `iframe`、`object`、`embed` | 不支持并安全降级 |
| `javascript:`、`vbscript:` | 移除 |
| 任意内联 style | 不保留 |
| `video autoplay` | 不保留，必须由用户控制播放 |
| `srcdoc` 和可执行嵌入属性 | 移除 |

## 验收记录

| 验收日期 | 提交 | Chrome | VS Code | 备注 |
| --- | --- | --- | --- | --- |
| 待验收 | - | BLOCKED | BLOCKED | P0/P1 实现完成后填写 |

## 本地自动化命令

```bash
TMPDIR=/tmp npx vitest run tests/unit/markdown-compatibility-doc.test.ts tests/unit/markdown-resource-resolver.test.ts tests/unit/markdown-html-compatibility.test.tsx
npm run build
TMPDIR=/tmp npx playwright test tests/e2e/browser/preview.spec.ts -g "GitHub README 常见"
```

Linux 本地浏览器 E2E 需要 headed Chromium 和可用的 X Server；在 CI 中使用 `xvfb-run`。如果运行环境无法启动带扩展的浏览器，保持矩阵为 `BLOCKED`，不要将单元测试结果冒充 Chrome / VS Code 实机验收。
