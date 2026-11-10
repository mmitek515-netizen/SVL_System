import { useCallback, useEffect, useRef, useState } from "react";

export function usePollingJSON<T>(url: string, intervalMs = 10000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json.success === false)
        throw new Error(json.error || `HTTP ${res.status}`);
      if (!controller.signal.aborted) {
        setData(json);
        setError(null);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Brak połączenia");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    setData(null);
    void refresh();
    const timer = window.setInterval(() => void refresh(), intervalMs);
    return () => {
      window.clearInterval(timer);
      request.current?.abort();
    };
  }, [refresh, intervalMs]);
  return { data, error, loading, refresh };
}
export async function postJSON<T = any>(
  url: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok || data.success === false)
    throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
