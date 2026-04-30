type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string, container?: HTMLElement) => Promise<{ svg: string }>;
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

  const containerId = `${id}-container`;
  const container = document.createElement('div');
  container.id = containerId;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    const { svg } = await mermaid.render(id, code, container);
    return svg;
  } catch (error) {
    container.innerHTML = '';
    throw error;
  } finally {
    container.remove();
    // Clean up any stale mermaid elements
    const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/([^\w-])/g, '\\$1');
    const staleElements = document.querySelectorAll(`#${escapedId}, [id^="dmermaid-"]`);
    staleElements.forEach((el) => el.remove());
  }
}
