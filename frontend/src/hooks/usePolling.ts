import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
  intervalMs: number;
  enabled?: boolean;
  pauseWhenHidden?: boolean;
}

/**
 * Polls a callback at a fixed interval.
 * Automatically pauses when the browser tab is hidden and resumes on focus.
 * Skips tick if the previous fetch is still running.
 */
export function usePolling(
  callback: () => Promise<void> | void,
  { intervalMs, enabled = true, pauseWhenHidden = true }: UsePollingOptions,
) {
  const savedCallback = useRef(callback);
  const runningRef = useRef(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const tick = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await savedCallback.current();
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(tick, intervalMs);

    function onVisibilityChange() {
      if (!pauseWhenHidden) return;
      if (document.visibilityState === 'visible') {
        tick();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [tick, intervalMs, enabled, pauseWhenHidden]);
}
