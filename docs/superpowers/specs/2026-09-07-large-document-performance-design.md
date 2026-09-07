# 大文档增量解析与渲染设计

## 1. 背景与目标

Feishu Markdown Viewer 当前在 `MarkdownReadView` 中通过 `useMemo` 调用同步的
`parseMarkdown()`，当文档内容变化时会重新执行完整的 Markdown → HAST → React
转换，并由 `root.render()` 替换整个阅读树。Mermaid 已经使用 IntersectionObserver
进行懒渲染并按源码缓存 SVG，因此 1～5 MB 文档的主要风险集中在 Markdown 解析、
React 树构建和文件刷新后的整页重建。

本设计的目标是：在不破坏目录定位、标题折叠、表格选择 / 列宽、图片预览、Mermaid
懒加载和 VS Code WebView 兼容性的前提下，降低 1～5 MB 文档的首次重复解析成本，
并让局部文件修改只更新受影响的正文块。

## 2. 范围与非目标

### 2.1 本次范围

- 增加可关闭的性能采样，记录解析、块构建、React 提交和 Mermaid 首次渲染耗时。
- 建立 Markdown 顶层块索引，识别标题、段落、列表、引用、表格、代码块、Mermaid、
  图片、HTML 块和分隔线。
- 为每个块生成内容指纹、起止行号、块类型和稳定渲染键。
- 让未变化的块复用已解析结果和 React 子树；新增、删除或内容变化的块重新解析。
- 统一预计算标题 ID、标题层级路径和表格身份元数据，避免分块解析产生重复锚点或表格 ID。
- 文件自动刷新时优先执行块级差异更新；无法安全拆分的内容回退为整篇解析。
- 保留现有 Mermaid 按可视区域渲染和 SVG 缓存，不在本阶段引入新的图表语法。

### 2.2 非目标

- 不在本阶段引入 Web Worker、虚拟列表或第三方虚拟滚动库。
- 不改变 Markdown 语义、HTML 安全白名单、资源解析规则或 Mermaid 语法。
- 不改变表格的选择、复制、列宽持久化、横向滚动和目录联动行为。
- 不改变图片预览、目录折叠、锚点跳转、主题和正文对齐设置。
- 不为了性能删除正文内容、降低图片质量或跳过可见区域内的块。

## 3. 方案选择

### 3.1 解析缓存

模块级缓存以 `contentHash + sourceContextKey` 为键，至少保留当前文档和最近一次
文档结果。缓存值不包含主题、字号或目录展开状态，避免设置变化触发重复解析，也避免
把视图状态错误地写入内容缓存。缓存命中时直接复用解析块；缓存未命中时建立索引并解析。

### 3.2 顶层块索引

新增纯函数 `indexMarkdownBlocks(content: string): MarkdownBlock[]`，使用逐行扫描而不是
简单的空行切分。扫描器必须识别并保持以下边界：

- fenced code block（包括 Mermaid 和带语言标记的代码块）；
- 缩进代码块；
- 连续列表及其嵌套列表；
- 连续 blockquote；
- 表格表头、分隔行和数据行；
- HTML 展示块和成对标签；
- 标题、段落、图片、分隔线等普通块。

每个块使用如下元数据：

```ts
type MarkdownBlockKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'blockquote'
  | 'table'
  | 'code'
  | 'mermaid'
  | 'image'
  | 'html'
  | 'thematic-break'
  | 'unknown';

interface MarkdownBlock {
  kind: MarkdownBlockKind;
  source: string;
  startLine: number;
  endLine: number;
  contentHash: string;
  renderKey: string;
}
```

`renderKey` 由稳定的块序号、标题路径和内容指纹组成。单纯修改块内容会替换该块；
在同一标题下新增块会影响后续 ordinal，但不会覆盖表格持久化 ID，表格身份仍由现有
`FeishuTableIdentity` 的匹配逻辑维护。

### 3.3 标题与表格元数据

在解析块之前完成一次全局元数据扫描：

- 使用与 `useTOC` 相同的标题识别规则生成全局唯一标题 ID；
- 记录每个标题的 level、文本、父级路径和文档主标题标记；
- 为每张表记录标题路径和标题下 ordinal；
- 解析块时把这些元数据注入 HAST，`FeishuHeading` 优先使用传入的稳定 `id`，不再为
  每个独立块重新创建 slug 计数器。

这样可以在增量更新后保持目录链接、浏览器 hash、标题复制链接和表格宽度恢复行为一致。

### 3.4 块级解析与安全回退

`MarkdownReadView` 改为渲染 `MarkdownBlockView` 列表。每个块只接收自己的源码、来源
上下文和全局元数据，并复用现有 rehype-sanitize / rehype-react 组件映射。遇到以下情况
时不做局部解析，直接回退整篇解析：

- fenced code、HTML 或列表边界无法确定；
- 标题层级变化导致后续块的标题路径全部变化；
- 解析器返回错误或安全清洗结果异常；
- 旧版本缓存格式无法识别。

回退必须保持当前内容可见，并在开发性能日志中记录原因，不向终端用户显示内部错误。

### 3.5 文件刷新流程

现有 `createLocalFileChangeMonitor` 继续负责检测变化。刷新时执行：

1. 计算新旧内容指纹；相同则直接更新基线，不触发 React 渲染。
2. 构建新旧块索引，按 `renderKey` 和相邻块关系计算新增、删除、修改集合。
3. 复用未变化块的 React 子树，只重新解析修改集合。
4. 完成 DOM 提交后恢复现有预览视口、目录状态、表格横向滚动和图片预览焦点。
5. Mermaid 块只有源码变化或首次进入可视区域时才重新渲染。

手动刷新和自动刷新使用同一套差异流程，`contentUpdateAvailable` 的提示逻辑保持不变。

## 4. 性能采样与验收指标

增加开发环境可读的 `performance.mark/measure`，至少包含：

- `markdown-index`：块索引耗时；
- `markdown-parse`：实际 Markdown 解析耗时；
- `markdown-react-commit`：React 提交耗时；
- `markdown-refresh-diff`：刷新差异计算耗时；
- `mermaid-first-render`：首个 Mermaid SVG 渲染耗时。

验收使用固定 fixture：

- 1 MB：普通段落、列表、表格和少量 Mermaid；
- 3 MB：混合 Markdown、HTML、图片、代码块和多个 Mermaid；
- 5 MB：长列表、宽表格、代码块、图片和多级标题。

必须满足：

- 同一内容重新挂载命中缓存，不执行完整 Markdown 解析；
- 只修改一个块时，未修改块的 DOM 节点保持不替换；
- 自动刷新期间滚动位置、目录展开状态和表格宽度保持；
- 无法安全拆分时整篇回退，内容和安全行为与当前实现一致；
- 现有单元测试、浏览器 E2E 和 VS Code 构建验证全部通过。

## 5. 测试策略

新增单元测试：

1. 块索引能正确识别连续列表、表格、Mermaid、代码块和 HTML 块边界；
2. 内容指纹只在块内容变化时变化；
3. 标题 ID 在分块解析前后保持唯一且稳定；
4. 未变化块复用缓存，变化块重新解析；
5. 不安全或无法确定边界的内容触发整篇回退；
6. Mermaid 只对变化源码失效缓存；
7. 表格身份、目录定位和视口恢复回归测试保持通过。

新增浏览器 E2E：

- 打开 1 MB、3 MB、5 MB fixture，记录首次可见时间；
- 修改中间一个段落，确认只有对应块更新；
- 修改标题、表格和 Mermaid，确认相应块更新且锚点、表格宽度和图表状态正常；
- 自动刷新期间滚动到文档中部，确认刷新完成后仍在相同阅读位置。

## 6. 分阶段交付

### 阶段一：可观测性与缓存

先增加性能采样、内容指纹和模块级解析缓存，不改变 DOM 结构。该阶段可以独立验证
选项卡切换和同内容重新挂载的收益。

### 阶段二：块索引与稳定元数据

实现逐行块扫描、标题 ID 预计算和表格元数据注入，保留整篇解析作为默认回退路径。
通过 fixture 和边界单测后再启用块级渲染。

### 阶段三：增量刷新

将本地自动刷新和手动刷新接入块级差异更新，补充滚动、目录、表格、图片和 Mermaid 的
跨环境 E2E。只有阶段三验证稳定后，才把块级刷新作为默认路径。

