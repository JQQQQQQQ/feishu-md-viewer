# GitHub README 兼容性与来源资源解析设计

## 1. 背景与目标

Feishu Markdown Viewer 已经支持常用 Markdown、GFM 表格、任务列表、图片、Mermaid、Callout 和部分展示性 HTML。GitHub README 通常还会使用一组超出基础 Markdown 的结构：`details` 折叠块、`picture` 响应式图片、`kbd` 快捷键、视频、徽章、贡献者墙、HTML 表格和内嵌 `div` 布局。

当前管线使用 `rehype-raw` 解析 HTML，再使用 `rehype-sanitize` 过滤不安全内容。这个安全边界需要保留，但必须用一份可重复执行的兼容性矩阵明确哪些元素保留、哪些元素安全转换、哪些元素降级，以及哪些元素明确不支持。

本设计同时统一相对资源和链接的解析规则，解决本地文件、GitHub blob、GitHub raw 和 GitLab 页面之间相对路径含义不同的问题。

## 2. 范围与非目标

### 2.1 本次范围

- 新增 `test-markdown-compatibility.md` 综合测试文档，覆盖 GitHub README 常见内容。
- 新增 `docs/markdown-compatibility.md` 兼容性矩阵，逐项记录当前行为和验收结果。
- 扩展现有安全 HTML 白名单，允许必要的展示性标签和属性。
- 引入来源上下文，使 Markdown 管线可以解析当前文档 URL、内容 URL 和资源基准 URL。
- 统一解析图片、`srcset`、视频资源、普通链接、Markdown 相对链接和锚点链接。
- 相对图片、徽章、贡献者头像和视频资源使用资源基准；相对 Markdown 链接使用文档链接基准。
- 当前文档内的 `#锚点` 使用预览内滚动定位，不打开新标签页。
- 为 Chrome 本地文件、GitHub 和 GitLab 增加单元测试及必要的浏览器 E2E 覆盖。

### 2.2 非目标

- 不复刻 GitHub 的完整 CSS 或页面 DOM。
- 不允许任意脚本、事件处理器、内联 CSS 表达式、`iframe`、`object` 或 `embed`。
- 不实现视频自动播放、跨域下载代理或远程资源缓存服务。
- 不改变现有表格选择、列宽、目录、主题、Mermaid 和本地自动刷新逻辑。
- 不为不安全或无法解析的 HTML 编写特殊例外；这类内容必须走统一安全降级。

## 3. 兼容性处理原则

每种 README 内容只允许落入四种结果之一：

1. **保留**：保留原生语义和必要属性，例如 `details`、`summary`、`picture`。
2. **安全转换**：转换为现有 Feishu 组件，例如 HTML 表格接入现有表格样式。
3. **显示降级**：保留可读文本或 `alt`，去除无法安全展示的结构。
4. **明确不支持**：展示统一的占位或说明，不执行原始内容。

P0 内容的默认决策如下：

| 内容 | 决策 | 说明 |
| --- | --- | --- |
| `<details>` / `<summary>` | 保留 | 使用浏览器原生折叠语义，保留 `open` 属性 |
| `<picture>` / `<source>` | 保留 | 解析 `srcset`、`media`、`sizes`，按安全规则重写资源 |
| `<kbd>` | 保留并样式化 | 显示快捷键标签，不允许事件属性 |
| `<video>` | 保留并限制 | 保留 `controls`、尺寸和安全资源，禁止自动播放 |
| 徽章、贡献者头像 | 安全转换 | 作为懒加载图片显示，保留链接行为 |
| HTML `<table>` | 安全转换 | 复用现有表格包装、选择和复制逻辑 |
| 内嵌 `<div>` | 保留安全布局 | 允许 `align`、`id`、安全 class，不允许任意 style/script |
| 图片懒加载属性 | 保留 | 允许 `loading`、`decoding`、尺寸属性 |
| GitHub 任务列表 | 保留 | 复用只读任务复选框样式和 checked 状态 |
| 标题锚点 | 安全转换 | 统一使用当前预览生成的标题 ID |
| script / iframe / object / embed | 明确不支持 | 去除标签并保留安全文本 |

## 4. 来源上下文与资源解析

### 4.1 统一上下文

新增只读的来源上下文，至少包含：

```ts
interface MarkdownSourceContext {
  source: 'file' | 'github' | 'gitlab';
  documentUrl: string;
  contentUrl?: string;
  assetBaseUrl: string;
  linkBaseUrl: string;
}
```

`parseMarkdown` 和 `MarkdownReadView` 接受可选上下文。未提供上下文时保持当前行为，以兼容已有单元测试和纯 Markdown 调用方。

### 4.2 各来源基准

| 来源 | 图片、徽章、头像、视频 | Markdown / 普通链接 |
| --- | --- | --- |
| 本地 `file://` | 当前 Markdown 所在目录 | 当前 Markdown 所在目录 |
| GitHub blob | 对应 `raw.githubusercontent.com` 文件目录 | 对应 GitHub blob 文件目录 |
| GitHub raw | 当前 raw 文件所在目录 | 当前 raw 文件所在目录 |
| GitLab blob | 对应 GitLab raw 文件目录 | 对应 GitLab blob 文件目录 |
| 绝对 `http(s)` 外链 | 原样保留 | 原样保留 |
| `#fragment` | 不解析为外部 URL | 当前预览内定位 |

解析规则：

- 先使用 `new URL(value, baseUrl)` 解析相对路径，再按资源类型校验协议。
- 图片、`srcset`、视频和 poster 只允许 `http:`、`https:`、受支持的 `file:` 或原本的相对资源。
- 普通链接允许 `http:`、`https:`、`mailto:`、`file:` 和相对 Markdown 链接。
- `javascript:`、`vbscript:`、危险 `data:` 和其他未知协议保持被 sanitizer 移除或降级。
- `srcset` 的每个候选项独立解析，保留宽度或像素密度描述符。
- 空值、非法 URL 或跨协议解析失败时，不抛出渲染异常；资源保持安全空值或回退到 `alt` 文本。

### 4.3 内部锚点

`FeishuLink` 根据链接类型处理行为：

- `href` 以 `#` 开头时，阻止默认导航，查找当前预览根内对应 ID，使用 `scrollIntoView` 定位，并更新当前 URL hash（不可更新时仍完成滚动）。
- 指向当前文档的相对 Markdown 链接，解析后作为普通文档链接展示；暂不在当前页面加载另一份 Markdown。
- 外部网页、GitHub/GitLab 页面和下载链接继续新标签页打开，并保留 `noopener noreferrer`。

这样可以让 README 的“跳到安装”“跳到贡献”或“跳到表格”链接在当前预览内工作，同时不改变外部链接的安全行为。

## 5. 安全 HTML 白名单

在现有 `defaultSchema` 上做最小扩展：

- 标签：`details`、`summary`、`picture`、`source`、`kbd`、`video`。
- 通用属性：保留 `id`、安全 `className` 和现有允许的 `align`。
- 图片属性：`src`、`srcSet`、`sizes`、`alt`、`width`、`height`、`loading`、`decoding`。
- source 属性：`src`、`srcSet`、`media`、`sizes`、`type`。
- video 属性：`src`、`poster`、`controls`、`width`、`height`、`preload`、`playsInline`。
- details 属性：`open`。

不允许 `on*` 事件、`style` 中的脚本表达式、`autoplay`、`allow`、`sandbox` 变体、`srcdoc` 和可执行嵌入标签。VS Code Webview 的 CSP 同步增加 `media-src` 的最小安全来源，否则 `<video>` 会在 VS Code 与浏览器行为不一致。

## 6. 测试文档与自动化验证

### 6.1 综合测试文档

新增根目录 `test-markdown-compatibility.md`，包含：

- 普通标题、目录和 GitHub 风格锚点
- 段落、列表、任务列表、引用、行内代码和代码块
- GFM 表格和 HTML 表格
- 普通图片、相对图片、raw 图片、徽章和贡献者头像
- `<details>` / `<summary>`、`<picture>` / `<source>`、`<kbd>`、`<video>`
- 内嵌 `<div>` 布局
- Mermaid 正常图和错误图
- 相对 Markdown 链接、当前文档锚点、内部链接和外部链接
- 图片懒加载属性和超长内容

文档只用于验收，不在运行时被特殊处理。

### 6.2 兼容性矩阵

新增 `docs/markdown-compatibility.md`，每项包含：语法示例、Chrome 结果、VS Code 结果、安全策略、降级行为和自动化测试位置。矩阵状态只允许 `PASS`、`DEGRADED`、`UNSUPPORTED` 或 `BLOCKED`，避免把未验证内容误记为已支持。

### 6.3 自动化测试

- 资源解析纯函数：覆盖四种来源、目录层级、URL 编码、query/hash、`srcset` 和危险协议。
- Pipeline 单元测试：覆盖所有 P0 HTML 标签、属性保留、危险属性清理、HTML 表格和任务列表。
- 链接组件测试：覆盖锚点当前滚动、外部链接新标签和相对 Markdown 链接解析。
- GitHub/GitLab 适配器测试：覆盖 blob/raw URL 派生和文档标题。
- 浏览器 E2E：至少验证本地兼容性文档、GitHub 远程 raw 内容和 VS Code Webview 静态资源/CSP。

## 7. 分阶段实施

### Phase 1：兼容性基线

- 编写测试文档和兼容性矩阵。
- 先补 pipeline 和 sanitizer 的失败测试。
- 记录当前默认白名单实际保留或过滤的内容。

### Phase 2：来源资源解析

- 实现来源上下文和纯解析函数。
- 将 Chrome 内容入口、独立 viewer 和 VS Code Webview 传入正确的文档 URL。
- 接入 `img`、`source`、`video` 和链接属性。

### Phase 3：交互和样式

- 实现当前预览锚点定位。
- 为 details、kbd、video 和降级状态补 Feishu 风格样式。
- 补齐 VS Code CSP 和 Webview 资源检查。

### Phase 4：验收与发布

- 运行单元测试、构建、E2E 和发布门禁。
- 在 Chrome 和 VS Code 中分别打开兼容性测试文档。
- 更新兼容性矩阵状态和 README 支持范围。
- 所有 P0 验收通过后，再合并到下一版本。

## 8. 验收标准

- `test-markdown-compatibility.md` 在 Chrome 本地预览中可完整打开，P0 元素没有阻塞正文。
- 同一文档在 VS Code 预览中保持结构和资源行为一致；视频因 CSP 或资源限制时必须显示可解释的降级结果。
- GitHub blob、GitHub raw、GitLab blob 和本地 file 的相对图片路径符合矩阵规则。
- README 内部 `#锚点` 在当前预览中滚动定位，不新开页面。
- HTML 表格继续使用现有表格选择、复制、表头和列宽逻辑。
- 所有危险 HTML、事件属性和危险 URL 仍被拦截。
- 现有全部测试通过，新增兼容性测试覆盖每个 P0 决策。
