import { useEffect, useState } from "react";

/** Tiny effect-hooked loader: { data, error, loading }, refreshed on deps change. */
export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const controller = new AbortController();
    let alive = true;

    // Reset state after a microtask boundary so the effect body itself never
    // triggers a cascading synchronous render (react-hooks/set-state-in-effect).
    void (async () => {
      await Promise.resolve();
      if (alive) {
        setState({ data: null, error: null, loading: true });
      }
      try {
        const data = await loader(controller.signal);
        if (alive) {
          setState({ data, error: null, loading: false });
        }
      } catch (error: unknown) {
        if (alive && !(error instanceof DOMException && error.name === "AbortError")) {
          setState({ data: null, error: error instanceof Error ? error.message : "Request failed", loading: false });
        }
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
