import { useEffect, useRef, useState } from 'react';
import { renderDot } from '../../../lib/dot-init';
import { DiagramToolbar } from '../Diagram/DiagramToolbar';
import { sanitizeDotSvg } from '../../utils/sanitize-dot-svg';

interface DotBlockProps {
  code: string;
  index: number;
}

export function DotBlock({ code, index }: DotBlockProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldRender) return;

    const container = containerRef.current;
    if (!container || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
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
      { root: null, rootMargin: '320px 0px', threshold: 0.01 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    let cancelled = false;
    setSvg(null);
    setError(null);

    void renderDot(code)
      .then((rawSvg) => {
        if (cancelled) return;
        const safeSvg = sanitizeDotSvg(rawSvg);
        if (!safeSvg) throw new Error('DOT SVG 安全处理失败');
        setSvg(safeSvg);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [code, shouldRender]);

  if (error) {
    return (
      <div className="feishu-dot feishu-dot--error" ref={containerRef} role="alert">
        <div className="feishu-dot__error-header">DOT 渲染失败</div>
        <div className="feishu-dot__error-message">{error}</div>
        <pre className="feishu-dot__source"><code>{code}</code></pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className="feishu-dot feishu-dot--loading"
        ref={containerRef}
        role="img"
        aria-label="DOT 图表"
        aria-busy="true"
      >
        <span>{shouldRender ? '正在生成 DOT 图表…' : '即将生成 DOT 图表…'}</span>
      </div>
    );
  }

  return (
    <DiagramToolbar
      code={code}
      blockIndex={index}
      kind="DOT"
      svgSelector=".feishu-dot svg"
      sanitizeSvg={sanitizeDotSvg}
    >
      <div className="feishu-dot" ref={containerRef} role="img" aria-label="DOT 图表">
        <div className="feishu-dot__diagram" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </DiagramToolbar>
  );
}
