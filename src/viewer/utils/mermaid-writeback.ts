/**
 * Replaces the nth mermaid code block in the document content with new code.
 */
export function replaceMermaidBlock(
  docContent: string,
  blockIndex: number,
  newCode: string,
): string {
  const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  let matchCount = 0;
  return docContent.replace(mermaidBlockRegex, (fullMatch, _groupContent: string) => {
    if (matchCount === blockIndex) {
      matchCount++;
      return `\`\`\`mermaid\n${newCode}\n\`\`\``;
    }
    matchCount++;
    return fullMatch;
  });
}
