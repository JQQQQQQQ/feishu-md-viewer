import { describe, expect, it } from 'vitest';
import { createMarkdownRefreshPlan } from '@/content/markdown-refresh-plan';

describe('markdown-refresh-plan', () => {
  it('returns noop when the observed file content is unchanged', () => {
    const plan = createMarkdownRefreshPlan('# A', '# A');

    expect(plan.mode).toBe('noop');
    expect(plan.diff).toBeUndefined();
  });

  it('returns incremental for a normal paragraph edit', () => {
    const plan = createMarkdownRefreshPlan('# A\n\nBefore', '# A\n\nAfter');

    expect(plan.mode).toBe('incremental');
    expect(plan.diff?.changed).toHaveLength(1);
    expect(plan.reason).toBeUndefined();
  });

  it('returns full when a heading changes and invalidates downstream paths', () => {
    const plan = createMarkdownRefreshPlan('# Old\n\n## Child', '# New\n\n## Child');

    expect(plan.mode).toBe('full');
    expect(plan.reason).toContain('标题');
  });

  it('returns full when a fenced block has no closing boundary', () => {
    const plan = createMarkdownRefreshPlan('```js\nconst a = 1;\n```', '```js\nconst a = 2;');

    expect(plan.mode).toBe('full');
    expect(plan.reason).toContain('边界');
  });
});
