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
      theme: 'base',
      themeVariables: {
        primaryColor: '#f5f0e6',
        primaryBorderColor: '#333',
        primaryTextColor: '#333',
        secondaryColor: '#fdf6e3',
        tertiaryColor: '#fff8e6',
        lineColor: '#333',
        fontSize: '14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 15,
        nodeSpacing: 50,
        rankSpacing: 60,
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

  // Mermaid needs a container element in the DOM with the target id
  const container = document.createElement('div');
  container.id = `${id}-container`;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '100%';
  document.body.appendChild(container);

  try {
    // mermaid.render(id, code) — do NOT pass container as 3rd arg
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch (error) {
    container.innerHTML = '';
    throw error;
  } finally {
    container.remove();
    // Clean up any elements mermaid may have injected
    const cleanup = document.getElementById(id);
    if (cleanup) cleanup.remove();
    document.querySelectorAll('[id^="dmermaid-"]').forEach((el) => el.remove());
  }
}
