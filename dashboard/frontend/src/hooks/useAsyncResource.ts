import { useEffect, useRef, useState } from "react";
import type { AsyncState } from "../components/AsyncState";

const DEFAULT_REFRESH_MS = Number(
  import.meta.env.VITE_DASHBOARD_REFRESH_MS ?? 30_000,
);

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: { refreshMs?: number } = {},
): AsyncState<T> & { refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => void>(() => undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      setLoading(true);
      try {
        const result = await loader();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    refreshRef.current = fetchOnce;
    fetchOnce();
    const interval = options.refreshMs ?? DEFAULT_REFRESH_MS;
    const timer = interval > 0 ? window.setInterval(fetchOnce, interval) : null;
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, deps);

  return { data, loading, error, refresh: () => refreshRef.current() };
}
