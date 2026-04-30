import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultRatio?: number;
  minWidth?: number;
}

const STEP = 0.05;

export function SplitPane({
  left,
  right,
  defaultRatio = 0.5,
  minWidth = 200,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(defaultRatio);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.getBoundingClientRect().width;
      const minRatio = minWidth / containerWidth;
      const maxRatio = 1 - minRatio;

      setRatio((prev) => {
        const delta = e.key === 'ArrowLeft' ? -STEP : STEP;
        return Math.min(maxRatio, Math.max(minRatio, prev + delta));
      });
    },
    [minWidth],
  );

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;
      const offsetX = e.clientX - rect.left;

      const minRatio = minWidth / containerWidth;
      const maxRatio = 1 - minRatio;

      const newRatio = Math.min(maxRatio, Math.max(minRatio, offsetX / containerWidth));
      setRatio(newRatio);
    }

    function handleMouseUp() {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth]);

  const leftPercent = `${(ratio * 100).toFixed(2)}%`;
  const rightPercent = `${((1 - ratio) * 100).toFixed(2)}%`;

  return (
    <div ref={containerRef} className="split-pane">
      <div className="split-pane__left" style={{ width: leftPercent }}>
        {left}
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- role="separator" with aria-valuenow is an interactive widget per WAI-ARIA */}
      <div
        className="split-pane__divider"
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      />
      <div className="split-pane__right" style={{ width: rightPercent }}>
        {right}
      </div>
    </div>
  );
}
