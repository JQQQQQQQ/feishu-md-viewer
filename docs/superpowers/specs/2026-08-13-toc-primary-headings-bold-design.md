# 目录主标题与大标题加粗设计

## 目标

在 Markdown 预览态的左侧目录中，让文档主标题和一级章节更容易被快速识别：

- `H1`：文档主标题，加粗；
- `H2`：一级章节标题，加粗；
- `H3-H6`：保持当前普通字重；
- 不改变目录展开/收起、滚动定位、当前项高亮和键盘操作。

## 当前实现

目录项由 `TOCItem` 递归渲染，目录项已有 `item.level` 字段，但渲染链接目前只使用统一的
`.feishu-toc__link` 类，没有根据层级添加视觉标记。目录样式集中在
`src/viewer/styles/layout.css`。

## 方案

在 `TOCItem` 的目录链接上，根据 `item.level` 增加层级类：

```text
feishu-toc__link--major  // level === 1 或 level === 2
```

随后在目录样式中将该类设置为 `font-weight: 600`。普通目录项继续使用现有字重；当前项激活样式仍可覆盖颜色和背景，但不覆盖加粗效果。

选择单一 `--major` 类而不是分别增加 H1/H2 两个类，是因为当前需求只需要“主标题/大标题”同一视觉等级，同时减少 CSS 分支和后续维护成本。`item.level` 仍保留真实标题层级，目录缩进逻辑不变。

## 交互与兼容性

- 目录点击定位逻辑不变；
- 折叠按钮逻辑不变；
- 当前项高亮逻辑不变；
- H3-H6 不增加字重；
- 没有 H1 的文档不会人为创建标题，现有根节点按真实 `level` 判断；
- 阅读态和编辑态共用目录组件，因此两种模式保持一致。

## 测试策略

新增 `TOCItem` 回归断言：

1. `level: 1` 的目录项具有 `feishu-toc__link--major`；
2. `level: 2` 的目录项具有 `feishu-toc__link--major`；
3. `level: 3` 的目录项不具有该类；
4. 点击、展开/收起和当前项激活测试保持通过。

验证命令：

```bash
TMPDIR=/tmp npm test -- --run tests/unit/TOCItem.test.tsx tests/unit/TableOfContents.test.tsx
npm run typecheck
npm run build
git diff --check
```
