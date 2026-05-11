import { useEffect, useLayoutEffect, useRef } from 'react';

const MODE_CHANGE_EVENT = 'feishu:viewer-mode-change-start';

export function notifyModeChangeStart() {
  window.dispatchEvent(new Event(MODE_CHANGE_EVENT));
}

export function useModeScrollRestore(mode: string) {
  const previousModeRef = useRef(mode);
  const pendingScrollYRef = useRef<number | null>(null);

  useEffect(() => {
    const rememberScroll = () => {
      pendingScrollYRef.current = window.scrollY;
    };

    window.addEventListener(MODE_CHANGE_EVENT, rememberScroll);
    return () => {
      window.removeEventListener(MODE_CHANGE_EVENT, rememberScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (previousModeRef.current === mode) return;

    previousModeRef.current = mode;
    const scrollY = pendingScrollYRef.current;
    if (scrollY === null) return;

    pendingScrollYRef.current = null;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, left: window.scrollX, behavior: 'auto' });
      });
    });
  }, [mode]);
}
