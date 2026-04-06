import { useEffect } from 'react';

/**
 * Lightweight polling helper to keep data in sync without page refresh.
 * Automatically pauses when the tab is hidden to avoid unnecessary calls.
 *
 * @param refreshFn Function that fetches/refreshes data (can be async)
 * @param intervalMs Polling interval in milliseconds (default: 10s)
 * @param deps Dependency list to re-register the polling effect
 */
export function useLiveRefresh(refreshFn: () => void | Promise<void>, intervalMs = 10000, deps: any[] = []) {
  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        await refreshFn();
      } catch {
        // Swallow errors; UI components already toast errors inside refreshFn
      }
    };

    // Kick off immediately
    run();

    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (isMounted) run();
    }, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
