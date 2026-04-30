import mermaid from 'mermaid';

let initialized = false;

export function initMermaid(): void {
  if (initialized) return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
    sequence: {
      useMaxWidth: true,
    },
  });

  initialized = true;
}

export async function renderMermaid(code: string, id: string): Promise<string> {
  initMermaid();
  const { svg } = await mermaid.render(id, code);
  return svg;
}
