import { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
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
          const sanitizedSvg = DOMPurify.sanitize(result, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ['foreignObject', 'style'],
            ADD_ATTR: ['xmlns', 'viewBox', 'style', 'width', 'height', 'transform', 'x', 'y', 'dx', 'dy'],
          });
          setSvg(sanitizedSvg);
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
