"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Poll an async loader on an interval, pausing when the tab is hidden. */
export function usePoll<T>(
  loader: () => Promise<T>,
  ms: number,
  deps: unknown[] = [],
  enabled = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const saved = useRef(loader);
  saved.current = loader;

  const refresh = useCallback(async () => {
    try {
      const next = await saved.current();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    }, ms);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, enabled, refresh, ...deps]);

  return { data, error, loading, refresh };
}

/** Ticking clock for countdowns. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
