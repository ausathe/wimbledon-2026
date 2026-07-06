/* ============================================================================
   Network fetch with a per-request timeout (URS-80, URS-98). Every rejection
   is caught by the caller (live-store.ts) via Promise.allSettled -- this
   module never lets a rejection escape unhandled.
============================================================================ */

export interface FetchResult {
  ok: boolean;
  json?: unknown;
  error?: string;
}

/** Fetch one scoreboard endpoint with an AbortController timeout. Never
 * throws -- always resolves to a FetchResult so callers can allSettled and
 * degrade per-endpoint without one hung/failing draw stalling the other. */
export async function fetchScoreboard(url: string, timeoutMs: number): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, error: "unparseable JSON" };
    }
    return { ok: true, json };
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return { ok: false, error: isAbort ? "timeout" : "network error" };
  } finally {
    clearTimeout(timer);
  }
}
