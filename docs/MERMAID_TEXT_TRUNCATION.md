# Mermaid 文字截断问题 - 上下文交接文档

## 问题描述

Mermaid 流程图在 Chrome Extension 的 ShadowDOM 中渲染时，节点标签的最后 1-2 个字符被截断：
- "Start" → "Star"
- "Is it working?" → "Is it workinc"
- "Great!" → "Grea"
- "Debug" → "Debu"
- "Yes" → "Ye", "No" → "N"

## 根因分析

Mermaid 在渲染 SVG 时，需要先测量文本宽度来计算节点尺寸。它通过在 `document.body` 上创建临时元素来测量。但我们的扩展运行在 **ShadowDOM** 中：

1. Mermaid 的文本测量发生在 **ShadowDOM 外部**（document.body）
2. ShadowDOM 内部的字体渲染环境可能与外部不同（字体加载时序、继承的 CSS 不同）
3. 导致 Mermaid 计算出的节点宽度比实际渲染的文字窄 ~5-10px
4. SVG 的 `viewBox` 恰好刚好包裹计算出的尺寸，没有余量
5. 文字溢出 viewBox 后被裁剪

## 已尝试的方案（均未完全解决）

| # | 方案 | 效果 |
|---|------|------|
| 1 | 移除 DOMPurify 净化 | 部分改善（边标签 Yes/No 可见），节点标签仍截断 |
| 2 | `useMaxWidth: false` | SVG 太大溢出容器 |
| 3 | `max-width: none` on SVG | 同上 |
| 4 | `htmlLabels: false` (用 SVG text 替代 foreignObject) | 边标签修复，节点标签仍截断 |
| 5 | `padding: 40` (Mermaid flowchart 配置) | 节点变大但文字仍裁 |
| 6 | 移除 `clip-path` 属性 | 无效 |
| 7 | SVG + 容器 `overflow: visible` | 无效 |
| 8 | 扩展 viewBox 宽度 +60px | 待验证（最新提交） |

## 当前代码状态

### `src/lib/mermaid-init.ts`
```typescript
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  themeVariables: { /* 飞书风格暖色调 */ },
  flowchart: {
    useMaxWidth: true,   // SVG 缩放到容器宽度
    htmlLabels: false,   // 用 SVG <text> 而非 foreignObject
    curve: 'basis',
    padding: 40,         // 节点内边距（已增大）
    nodeSpacing: 50,
    rankSpacing: 60,
  },
});
```

### `src/viewer/components/Markdown/MermaidBlock.tsx`
```typescript
const cleaned = result
  .replace(/clip-path="[^"]*"/g, '')  // 移除裁剪路径
  .replace(/viewBox="([^"]*)"/, (_, vb) => {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      return `viewBox="${parts[0]} ${parts[1]} ${parts[2] + 60} ${parts[3]}"`;
    }
    return `viewBox="${vb}"`;
  });
setSvg(cleaned);
```

### `src/viewer/styles/markdown.css`
```css
.feishu-mermaid {
  overflow: visible;  /* 允许内容溢出 */
}
.feishu-mermaid svg {
  max-width: 100%;
  height: auto;
  overflow: visible;
}
```

## 可能的正确方案

1. **在 ShadowDOM 内部测量文本**：创建自定义 Mermaid 渲染器，在 ShadowRoot 内做文本测量而非 document.body

2. **强制扩展 SVG width 属性**：除了 viewBox，还要修改 SVG 元素的 `width` 属性
   ```typescript
   .replace(/width="(\d+(?:\.\d+)?)"/, (_, w) => `width="${parseFloat(w) * 1.1}"`)
   ```

3. **用 canvas 预测量文本**：在渲染前用 canvas measureText 计算实际文本宽度，与 Mermaid 的估计做对比，动态调整 viewBox

4. **iframe 隔离渲染**：在一个独立 iframe 中渲染 Mermaid（非 ShadowDOM），获取 SVG 后注入到 ShadowDOM

5. **CSS 文本溢出允许**：在 SVG 内部找到 `<text>` 元素的父 `<g>` 并设置 `overflow: visible`（已试过 clip-path 移除但可能还有其他裁剪机制）

## 如何测试

### 本地测试流程

```bash
# 1. 构建扩展
pnpm build

# 2. 部署到 Windows (WSL 环境)
cp -r dist/* /mnt/c/Users/Q/feishu-md-viewer-dist/

# 3. 在 Chrome 中刷新扩展
#    打开 chrome://extensions → 找到 Feishu MD Viewer → 点刷新按钮

# 4. 打开测试页面
#    https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md
#    或本地 file:///C:/Users/Q/test-e2e.md
```

### Playwright 自动化测试

```bash
# 连接到用户的 Chrome (需要 Chrome Playwright Extension 已激活)
cmd.exe /c "cd C:\Users\Q && set PLAYWRIGHT_MCP_EXTENSION_TOKEN=Z48mNtYRFwerZeVJbInoK82Rm43rDEA2N0-fv1Q_zyQ&& playwright-cli.cmd attach --extension=chrome"

# 导航到测试页
cmd.exe /c "cd C:\Users\Q && playwright-cli.cmd -s=chrome goto https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md"

# 等待扩展注入 (约5秒)
sleep 5

# 获取快照确认扩展加载
cmd.exe /c "cd C:\Users\Q && playwright-cli.cmd -s=chrome snapshot" | grep "飞书"

# 点击 TOC 导航到 Mermaid 区域
cmd.exe /c "cd C:\Users\Q && playwright-cli.cmd -s=chrome snapshot" | grep "Section 5.*ref=e"
# 得到 ref 后点击
cmd.exe /c "cd C:\Users\Q && playwright-cli.cmd -s=chrome click e{REF}"

# 截图验证
cmd.exe /c "cd C:\Users\Q && playwright-cli.cmd -s=chrome screenshot"
# 截图保存在 C:\Users\Q\.playwright-cli\page-*.png
```

### 验证标准
- "Start" 完整显示（不是 "Star"）
- "Is it working?" 完整显示
- "Great!" 完整显示
- "Debug" 完整显示
- "Yes" / "No" 边标签完整

### 自动化测试命令
```bash
pnpm test          # 142 个单元测试
npx tsc --noEmit   # TypeScript 类型检查
pnpm build         # 构建扩展
```

## 项目架构关键点

- **Chrome Extension (Manifest V3)** — 内容脚本注入 ShadowDOM
- **ShadowDOM 隔离** — 所有渲染在 ShadowRoot 内，CSS 通过 `?inline` 导入注入
- **Mermaid 渲染流程**: `FeishuComponents.tsx` 检测 mermaid 代码块 → `MermaidBlock.tsx` 调用 `renderMermaid()` → `mermaid-init.ts` 中 `mermaid.render()` 在 document.body 的临时容器中渲染 → SVG 结果注入到 ShadowDOM 中的 `dangerouslySetInnerHTML`

## Git 仓库
- GitHub: https://github.com/JQQQQQQQ/feishu-md-viewer
- 最新 commit: `7484475` (expand viewBox width +60)
