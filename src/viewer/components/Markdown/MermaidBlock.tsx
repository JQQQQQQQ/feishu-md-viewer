import { useEffect, useState, useRef } from 'react';
import { renderMermaid } from '../../../lib/mermaid-init';
import { sanitizeMermaidSvg } from '../../utils/sanitize-svg';

interface MermaidBlockProps {
  code: string;
  index: number;
}

let mermaidRenderSequence = 0;

export function MermaidBlock({ code, index }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState<boolean>(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldRender) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '320px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    let cancelled = false;
    setSvg(null);
    setError(null);

    async function render() {
      try {
        mermaidRenderSequence += 1;
        const id = `mermaid-diagram-${index}-${mermaidRenderSequence}`;
        const result = await renderMermaid(code, id);
        if (!cancelled) {
          setSvg(sanitizeMermaidSvg(result));
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
    return () => {
      cancelled = true;
    };
  }, [code, index, shouldRender]);

  return (
    <div
      ref={containerRef}
      className={`feishu-mermaid${error ? ' feishu-mermaid--error' : svg ? '' : ' feishu-mermaid--loading'}`}
      role={error ? 'alert' : 'img'}
      aria-label={error ? undefined : 'Mermaid diagram'}
      aria-busy={!error && !svg ? 'true' : undefined}
    >
      {error ? (
        <>
          <div className="feishu-mermaid__error-header">Mermaid 图表错误</div>
          <div className="feishu-mermaid__error-message">{error}</div>
          <pre className="feishu-mermaid__source">
            <code>{code}</code>
          </pre>
        </>
      ) : svg ? (
        <div
          className="feishu-mermaid__diagram"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <span>{shouldRender ? '渲染中...' : '即将渲染...'}</span>
      )}
    </div>
  );
}
