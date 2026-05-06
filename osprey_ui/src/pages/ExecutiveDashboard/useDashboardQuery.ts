import * as React from 'react';

import useDashboardStore from '../../stores/dashboardStore';

interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

/**
 * Runs ``fetcher`` whenever any value in ``deps`` changes, plus on a polling
 * interval when auto-refresh is enabled. Cancels stale results so a slow
 * response from a previous window cannot overwrite the latest one.
 */
export function useDashboardQuery<T>(fetcher: () => Promise<T>, deps: ReadonlyArray<unknown>): AsyncState<T> {
  const [state, setState] = React.useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const autoRefresh = useDashboardStore((s) => s.autoRefresh);
  const refreshIntervalMs = useDashboardStore((s) => s.refreshIntervalMs);

  // Use a ref to capture the latest fetcher without re-triggering effect on each render.
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const run = () => {
      setState((prev) => ({ ...prev, loading: true }));
      fetcherRef
        .current()
        .then((data) => {
          if (cancelled) return;
          setState({ data, error: null, loading: false });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setState((prev) => ({ data: prev.data, error, loading: false }));
        });
    };

    run();
    if (autoRefresh && refreshIntervalMs > 0) {
      timer = setInterval(run, refreshIntervalMs);
    }
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshIntervalMs, ...deps]);

  return state;
}
