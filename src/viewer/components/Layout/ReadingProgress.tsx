import { useEffect, useState } from 'react';

function getScrollProgress(): number {
  const root = document.documentElement;
  const scrollable = Math.max(1, root.scrollHeight - root.clientHeight);
  return Math.min(1, Math.max(0, root.scrollTop / scrollable));
}

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setProgress(getScrollProgress());
      });
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className="feishu-reading-progress" aria-hidden="true">
      <div
        className="feishu-reading-progress__bar"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
