# DOT（Graphviz）预览支持设计

## 1. 背景与目标

当前 Feishu MD Viewer 已支持 Mermaid 代码块的阅读态渲染、全屏预览、缩放拖拽和导出，但 `dot` / Graphviz 代码块仍会按普通代码显示。本次新增 DOT 支持，目标是在不改变现有 Mermaid、表格、目录和普通代码行为的前提下，让 Markdown 中的 DOT 图直接以图表形式预览，并在浏览器扩展和 VS Code Webview 中保持一致。

第一版明确为“预览优先”：支持 DOT 源码渲染和图表交互，不加入 DOT 源码编辑器或 Graphviz 引擎配置面板。

## 2. 范围与非目标

### 2.1 第一版范围

- 识别围栏代码块语言 `dot`、`graphviz`、`gv`。
- 支持 Graphviz 的 `graph`、`digraph`、`strict graph`、`strict digraph` 等标准 DOT 输入。
- 使用本地 WASM Graphviz 将源码渲染为 SVG，不依赖外部服务。
- 正文中默认显示图表，提供全屏预览、缩放、适应画布、拖拽平移、源码复制、SVG 导出和 PNG 导出。
- 复用现有图表预览的交互约定：滚轮滚动画布，不用滚轮缩放；左上角提供圆角矩形“× 退出”按钮。
- 适配亮色、暗色主题以及浏览器扩展和 VS Code Webview。
- DOT 语法错误、WASM 加载失败或 SVG 清洗失败时，降级为源码块并展示可读错误提示。
- 为合法 DOT、复杂 DOT、错误 DOT、混合 Mermaid/DOT 页面补充单元测试和 E2E 测试样例。

### 2.2 非目标

- 第一版不提供 DOT 源码编辑器、语法高亮编辑和实时保存。
- 不提供 Graphviz 引擎选择（`dot`、`neato`、`fdp` 等）或布局参数面板；默认使用 `dot` 引擎。
- 不把 DOT 发送到远程渲染服务。
- 不支持由 DOT 生成任意 HTML/脚本并注入页面。
- 不改变 Mermaid 已有的曲线、主题和预览行为。

## 3. 技术路线与决策

### 3.1 候选方案

1. **`@viz-js/viz`（采用）**：提供 Graphviz WASM 实例和 SVG 渲染 API，适合浏览器扩展和 VS Code Webview 的离线场景。代价是增加异步 WASM 资源，需要懒加载、缓存和产物验证。
2. `@hpcc-js/wasm`：同样可本地渲染，但依赖范围和包体更重，当前预览需求不需要额外能力。
3. 外部 Graphviz 服务：可减少本地包体，但依赖网络并带来文件隐私、`file://`、Webview CSP 和服务可用性问题。

### 3.2 采用理由

采用 `@viz-js/viz`，因为渲染发生在本地、结果可复现，且输出 SVG 能直接接入现有图表预览、导出和主题适配链路。官方项目和 API 文档：

- [Viz.js GitHub](https://github.com/mdaines/viz-js)
- [Viz.js API](https://viz-js.com/api/)

## 4. 架构与组件边界

### 4.1 数据流

```text
Markdown 围栏代码块
        ↓
CodeBlock 语言识别（dot / graphviz / gv）
        ↓
DotBlock
        ↓
dot-init：懒加载并缓存 Graphviz WASM 实例
        ↓
Graphviz SVG 输出
        ↓
DOT 专用 SVG 清洗与主题处理
        ↓
正文图表 / 全屏图表预览
```

### 4.2 模块职责

- `src/viewer/components/Markdown/CodeBlock/CodeBlock.tsx`
  - 增加 DOT 语言别名识别。
  - Mermaid 分支保持现有行为。
  - DOT 分支只负责传递源码和索引，不在组件内直接调用 Graphviz。

- `src/lib/dot-init.ts`
  - 动态导入 `@viz-js/viz`。
  - 缓存 WASM Graphviz 实例和加载 Promise，保证同一页面只加载一次。
  - 以 `dot` 引擎调用 SVG 渲染。
  - 对相同“源码 + 引擎”使用有限容量缓存，避免切换选项卡或重复进入视口时重新计算。

- `src/viewer/components/Markdown/DotBlock.tsx`
  - 管理加载态、成功态、错误态和视口懒加载。
  - 成功后只保存清洗过的 SVG，不把原始 SVG 直接交给 `dangerouslySetInnerHTML`。
  - 错误时保留源码可读性，避免单个图表阻断整篇文档。

- 图表预览组件
  - 将 Mermaid 专用的全屏预览能力抽象为中性的图表预览组件，支持 `Mermaid` 和 `DOT` 两种来源。
  - 统一处理缩放、居中、拖拽、滚轮、退出和导出；文案使用“图表”而非固定的“Mermaid”。
  - Mermaid 仍使用现有 Mermaid 专用 SVG 边界扩展；DOT 不执行该扩展，防止 Graphviz 的 `viewBox` 和节点位置发生偏移。

- DOT SVG 安全处理
  - 新增 DOT 专用清洗入口，复用低层 DOMPurify 能力，但不套用 Mermaid 的文字主题和 foreignObject 边界逻辑。
  - 只允许必要的 SVG 元素、属性和安全协议，移除脚本、事件属性、危险链接和外部样式注入。

### 4.3 跨端复用

浏览器扩展入口和 VS Code Webview 都加载同一份 React 构建产物，因此 DOT 只实现一套渲染组件。VS Code 构建需要验证 WASM 资源能随 `dist` 正确产出，并符合现有 Webview CSP；不另写 Node 侧 Graphviz 渲染器。

## 5. 用户交互与视觉规范

### 5.1 正文图表

- 默认显示 DOT 图表，不显示源码。
- 工具栏提供：`预览`、`复制源码`、`导出 SVG`、`导出 PNG`。
- 加载中显示轻量占位和“正在生成 DOT 图表…”，不遮挡其他正文。
- 错误状态显示源码、错误标题和简短错误信息，并提供复制源码操作。

### 5.2 全屏预览

- 图表铺在全屏画布上，不额外套明显的卡片边框。
- 左上角显示圆角矩形“× 退出”按钮。
- 滚轮只改变画布滚动位置；缩放由 `− / 比例 / + / 适应画布` 控制。
- 图表可用鼠标抓手拖拽平移，键盘焦点也能操作工具栏。
- 切换和首次打开复用同一个蒙版和画布节点，避免蒙版闪烁。

### 5.3 主题

- 亮色主题：浅色节点背景、深色文字、清晰的灰蓝色边线。
- 暗色主题：深色节点背景、提亮文字和边线，确保节点文字与连接线达到可读对比度。
- 不依赖 Graphviz 输出中的默认黑色背景；主题通过 SVG 样式变量和安全的属性覆盖实现。
- 浏览器与 VS Code 的主题变量命名保持一致。

## 6. 安全与错误处理

安全边界：

- 删除 `<script>`、事件处理属性（如 `onclick`）和危险协议。
- 外部链接和资源仅保留 `http`、`https` 以及经过限制的 `data` 类型。
- 不允许 SVG 输出携带宿主页面可执行的外部 CSS。
- VS Code Webview 继续遵守现有 CSP，不新增任意脚本源。

错误降级：

| 错误 | 用户看到的结果 | 其他内容是否受影响 |
| --- | --- | --- |
| WASM 加载失败 | 源码块 + “DOT 引擎加载失败” | 不受影响 |
| DOT 语法错误 | 源码块 + 错误信息/行号（如可获得） | 不受影响 |
| SVG 解析或清洗失败 | 源码块 + “图表安全处理失败” | 不受影响 |
| 导出失败 | 保留图表，工具栏提示导出失败 | 不受影响 |

## 7. 性能策略

- 首次遇到 DOT 时才动态加载 WASM。
- 加载 Promise 和 Graphviz 实例全局复用。
- 图表进入视口附近才渲染。
- 对源码和引擎组合进行有限容量缓存，避免重复生成 SVG。
- 导出 PNG 复用已生成的 SVG，不再次调用 Graphviz。
- 解析和渲染在异步流程中执行，不阻塞正文首屏。

## 8. 测试与验收标准

### 8.1 单元测试

- `dot`、`graphviz`、`gv` 均进入 DOT 渲染分支。
- 普通代码语言和 Mermaid 分支行为不变。
- `graph`、`digraph`、`strict digraph` 可生成 SVG。
- 非法 DOT 能稳定进入错误降级，不产生未处理 Promise rejection。
- 脚本、事件属性和危险链接会从 SVG 中移除。
- 相同源码重复渲染命中缓存。
- 现有 Mermaid 测试全部保持通过。

### 8.2 浏览器 E2E

- DOT 正文默认显示图表，点击进入全屏预览。
- 全屏预览的拖拽、缩放、适应画布、退出、SVG/PNG 导出可用。
- 滚轮滚动画布而不是缩放。
- 亮色/暗色主题均可读，图表不出现黑块或错误外框。
- 同一页同时包含 Mermaid、DOT、表格和普通代码时互不影响。
- 错误 DOT 不影响目录、正文和其他图表。

### 8.3 VS Code Webview

- `npm run build:vscode` 后 Webview 能加载 DOT 图表。
- 不出现动态模块加载失败或 CSP 报错。
- 切换编辑器选项卡不重复闪烁、不丢失图表。
- VS Code 亮色/暗色主题与浏览器表现一致。

### 8.4 发布前命令

```bash
npm test -- --run
npm run build
npm run build:vscode
```

同时在 `test-e2e.md` 增加基础 DOT、复杂 DOT 和错误 DOT 示例，覆盖本地 `file://` 与 GitHub 页面中的预览路径。

## 9. 实施顺序

1. 添加依赖和 DOT 渲染核心，先用单元测试锁定语言识别、渲染、缓存和错误行为。
2. 接入 `DotBlock` 与 Markdown 代码块分支。
3. 抽象中性图表预览交互并接入 Mermaid/DOT，保持 Mermaid 回归通过。
4. 增加 DOT SVG 安全处理、主题样式和导出能力。
5. 更新浏览器/VS Code 构建配置与资源验证。
6. 补充 `test-e2e.md` 和浏览器、VS Code 验收脚本。
7. 执行完整测试和构建，完成发布包验证。

