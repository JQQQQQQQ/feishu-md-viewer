type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void;
  parse: (code: string) => Promise<unknown>;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

let mermaidInstance: MermaidAPI | null = null;
let loadingPromise: Promise<MermaidAPI> | null = null;
let renderQueue: Promise<void> = Promise.resolve();

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
        htmlLabels: false,
        curve: 'basis',
        padding: 40,
        nodeSpacing: 50,
        rankSpacing: 60,
      },
      sequence: {
        useMaxWidth: true,
      },
      block: {
        padding: 24,
      },
    });
    mermaidInstance = mermaid;
    return mermaid;
  });

  return loadingPromise;
}

export async function renderMermaid(code: string, id: string): Promise<string> {
  const renderTask = renderQueue.then(
    () => renderMermaidNow(code, id),
    () => renderMermaidNow(code, id)
  );

  renderQueue = renderTask.then(
    () => undefined,
    () => undefined
  );

  return renderTask;
}

async function renderMermaidNow(code: string, id: string): Promise<string> {
  const mermaid = await loadMermaid();

  // Validate syntax first — parse() gives clean error messages
  try {
    await mermaid.parse(code);
  } catch (parseError) {
    const msg = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(msg || '语法错误：无法解析 Mermaid 代码');
  }

  const container = document.createElement('div');
  container.id = `${id}-container`;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '100%';
  document.body.appendChild(container);

  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch (renderError) {
    const msg = renderError instanceof Error ? renderError.message : String(renderError);
    console.error('Mermaid render failed', renderError);
    throw new Error(msg || 'Mermaid 渲染失败');
  } finally {
    container.remove();
    const cleanup = document.getElementById(id);
    if (cleanup) cleanup.remove();
    document.querySelectorAll('[id^="dmermaid-"]').forEach((el) => el.remove());
  }
}
