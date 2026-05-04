import { useEffect, useState, useRef } from 'react';
import { renderMermaid } from '../../../lib/mermaid-init';

interface MermaidBlockProps {
  code: string;
  index: number;
}

export function MermaidBlock({ code, index }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const id = `mermaid-diagram-${index}-${Date.now()}`;
        const result = await renderMermaid(code, id);
        if (!cancelled) {
          // Fix text truncation in ShadowDOM:
          // 1. Remove clip-path (node shapes clip text)
          // 2. Set SVG overflow:visible (viewBox boundary clips text)
          const cleaned = result
            .replace(/clip-path="[^"]*"/g, '')
            .replace('<svg ', '<svg style="overflow:visible" ');
          setSvg(cleaned);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render Mermaid diagram');
          setSvg(null);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code, index]);

  if (error) {
    return (
      <div className="feishu-mermaid feishu-mermaid--error" role="alert">
        <div className="feishu-mermaid__error-header">Mermaid 图表错误</div>
        <div className="feishu-mermaid__error-message">{error}</div>
        <pre className="feishu-mermaid__source">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="feishu-mermaid feishu-mermaid--loading" aria-busy="true">
        <span>渲染中...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="feishu-mermaid"
      role="img"
      aria-label="Mermaid diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
