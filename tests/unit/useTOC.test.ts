import { describe, it, expect } from 'vitest';
import { extractHeadings } from '@/viewer/hooks/useTOC';

describe('extractHeadings', () => {
  it('extracts H1-H6 headings correctly', () => {
    const md = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;
    const result = extractHeadings(md);
    // Root should have 1 H1
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('H1');
    expect(result[0].level).toBe(1);

    // H2 nested under H1
    const h2 = result[0].children[0];
    expect(h2.text).toBe('H2');
    expect(h2.level).toBe(2);

    // H3 nested under H2
    const h3 = h2.children[0];
    expect(h3.text).toBe('H3');
    expect(h3.level).toBe(3);

    // H4 nested under H3
    const h4 = h3.children[0];
    expect(h4.text).toBe('H4');
    expect(h4.level).toBe(4);

    // H5 nested under H4
    const h5 = h4.children[0];
    expect(h5.text).toBe('H5');
    expect(h5.level).toBe(5);

    // H6 nested under H5
    const h6 = h5.children[0];
    expect(h6.text).toBe('H6');
    expect(h6.level).toBe(6);
  });

  it('builds tree structure (H2 under H1, H3 under H2)', () => {
    const md = `# Introduction
## Background
## Methods
### Approach A
### Approach B
## Results`;
    const result = extractHeadings(md);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Introduction');
    expect(result[0].children).toHaveLength(3); // Background, Methods, Results

    const methods = result[0].children[1];
    expect(methods.text).toBe('Methods');
    expect(methods.children).toHaveLength(2); // Approach A, Approach B
    expect(methods.children[0].text).toBe('Approach A');
    expect(methods.children[1].text).toBe('Approach B');
  });

  it('generates correct IDs (lowercase, hyphened, no special chars)', () => {
    const md = `# Hello World!
## This is a Test?
### Multiple   Spaces
#### Special @#$ Characters`;
    const result = extractHeadings(md);

    expect(result[0].id).toBe('hello-world');
    expect(result[0].children[0].id).toBe('this-is-a-test');
    expect(result[0].children[0].children[0].id).toBe('multiple-spaces');
    expect(result[0].children[0].children[0].children[0].id).toBe('special-characters');
  });

  it('handles CJK characters in IDs', () => {
    const md = `# 飞书文档
## 中文标题 Test`;
    const result = extractHeadings(md);

    expect(result[0].id).toBe('飞书文档');
    expect(result[0].children[0].id).toBe('中文标题-test');
  });

  it('returns empty array for content with no headings', () => {
    const md = `This is a paragraph.

Another paragraph with **bold** text.

- list item 1
- list item 2`;
    const result = extractHeadings(md);
    expect(result).toHaveLength(0);
  });

  it('handles multiple H1s at root level', () => {
    const md = `# First Section
## Sub 1
# Second Section
## Sub 2
# Third Section`;
    const result = extractHeadings(md);

    expect(result).toHaveLength(3);
    expect(result[0].text).toBe('First Section');
    expect(result[0].children).toHaveLength(1);
    expect(result[1].text).toBe('Second Section');
    expect(result[1].children).toHaveLength(1);
    expect(result[2].text).toBe('Third Section');
    expect(result[2].children).toHaveLength(0);
  });

  it('handles skipped levels (H1 then H3 without H2)', () => {
    const md = `# Title
### Skipped to H3
#### H4 under H3
## Back to H2`;
    const result = extractHeadings(md);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Title');
    // H3 is nested directly under H1 (since H2 is skipped)
    expect(result[0].children).toHaveLength(2); // H3 and H2
    expect(result[0].children[0].text).toBe('Skipped to H3');
    expect(result[0].children[0].level).toBe(3);
    expect(result[0].children[0].children[0].text).toBe('H4 under H3');
    expect(result[0].children[1].text).toBe('Back to H2');
    expect(result[0].children[1].level).toBe(2);
  });
});
