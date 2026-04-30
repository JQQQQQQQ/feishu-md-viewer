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

  // Create a temporary detached container for mermaid to render into.
  // This prevents mermaid from polluting the real DOM with error SVGs.
  const container = document.createElement('div');
  container.id = id;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } finally {
    // Clean up the temporary container
    container.remove();
    // Remove any stale elements mermaid may have created in the outer DOM
    const staleElements = document.querySelectorAll(`[id^="d${id}"], [id^="dmermaid-"]`);
    staleElements.forEach((el) => el.remove());
  }
}
