---
name: feishu-style-mermaid
description: Use when creating or restyling Mermaid flowcharts or flowchart-based architecture and relationship diagrams that should resemble a light Feishu document, especially when the request mentions process diagrams, architecture diagrams, relationship diagrams, automatic semantic categories, 流程图, 架构图, 分类配色, 飞书风格, or 浅色流程图.
---

# Feishu Style Mermaid

## Core Principle

Model the content first, derive categories second, and style last. Preserve the user's terminology and relationships; never let the palette invent or distort the underlying flowchart.

## Required Workflow

1. Confirm that the request fits `flowchart TD` or `flowchart LR`, including architecture or relationship views modeled with flowchart nodes, edges, and subgraphs. If the user explicitly requests `sequenceDiagram`, `classDiagram`, `erDiagram`, `stateDiagram`, or another non-flowchart grammar, briefly explain that this skill is flowchart-only and ask whether to remodel the content as a flowchart; do not emit incompatible flowchart styling directives.
2. Infer three to seven semantic categories from the actual content. Merge weak or adjacent categories when needed, and use fewer than three only when the content genuinely does not support more.
3. Assign a coherent low-saturation palette to those categories. Meanings are diagram-specific rather than globally tied to fixed colors.
4. Emit complete `flowchart TD` or `flowchart LR` source with unique ASCII IDs, explicit class assignments, branch labels, and all style definitions.
5. Self-check syntax, semantic completeness, contrast, density, label length, category consistency, the main path, likely edge crossings, and legend accuracy.

## Output Contract

- Add at most one sentence of context when it helps the reader.
- For each in-scope diagram, return one complete `flowchart TD` or `flowchart LR` Mermaid code block. For a single requested diagram, return exactly one block.
- Follow each diagram with a concise legend mapping its generated semantic classes to their meanings and colors.

## Required References

- Read [references/visual-style.md](references/visual-style.md) for every generation.
- Read [references/example.md](references/example.md) when a concrete implementation pattern would help.

## Quality Gate

A valid in-scope flowchart result must satisfy all of the following:

- The Mermaid block is a complete, directly copyable `flowchart TD` or `flowchart LR` definition.
- Node IDs are unique.
- Every styled node is assigned to exactly one semantic color class.
- The same semantic category uses the same class throughout the diagram.
- Categories number between three and seven unless the content genuinely needs fewer.
- Each class has sufficient fill/text contrast and an explicit text color.
- Meaning remains understandable without relying on color alone.
- The main path is visually obvious.
- Long content is shortened without changing its meaning.
- Branch labels and terminal outcomes are unambiguous.
- The legend accurately describes the categories generated for this diagram.

## Common Mistakes

- Treating any pale fill as sufficient while using bright solid nodes or a rainbow of high-chroma borders. Use the approved soft fills, restrained same-family strokes, and consistent thin borders.
- Reusing generic roles such as `action`, `decision`, or `startEnd` instead of deriving categories from the diagram's domain.
- Omitting the legend or describing colors that do not match the actual class assignments.
- Leaving a multi-loop architecture without an obvious main path. Keep the primary route visually direct, label branches, and de-emphasize secondary or asynchronous edges.
- Encoding meaning only through color. Retain descriptive labels, shapes, branch text, and meaningful subgraphs.
- Producing incomplete `classDef` declarations. Every class must include `fill`, `stroke`, `stroke-width`, and `color`.
- Applying the flowchart styling contract to sequence, class, ER, state, or other non-flowchart syntax. Keep those grammars outside this skill and offer flowchart remodeling instead.
