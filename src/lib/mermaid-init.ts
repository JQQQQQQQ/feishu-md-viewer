type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

let mermaidInstance: MermaidAPI | null = null;
let loadingPromise: Promise<MermaidAPI> | null = null;

async function loadMermaid(): Promise<MermaidAPI> {
  if (mermaidInstance) return mermaidInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = import('mermaid').then((mod) => {
    const mermaid = mod.default as MermaidAPI;
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
    mermaidInstance = mermaid;
    return mermaid;
  });

  return loadingPromise;
}

export async function renderMermaid(code: string, id: string): Promise<string> {
  const mermaid = await loadMermaid();
  const { svg } = await mermaid.render(id, code);
  return svg;
}
