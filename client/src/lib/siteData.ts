import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Fetch dynamic site data from Supabase `site_data` table.
 * Falls back to a static JSON file in `public/data/` if Supabase is
 * unavailable or the key doesn't exist yet. Pass `null` when no such file
 * ships: the call then rejects instead of downloading the SPA's index.html
 * (which Sentry flagged as a "Large HTTP payload").
 *
 * Usage:
 *   const holidays = await fetchSiteData<Holiday[]>("holidays", "holidays.json");
 */
const inFlightRequests = new Map<string, Promise<any>>();

/*
 * Reads made in the same tick share one `key=in.(…)` request. The Club page
 * alone used to fire half a dozen single-key reads at once, which Sentry
 * reported as an N+1 API call.
 */
type Waiter = (value: unknown) => void;
let pendingBatch: Map<string, Waiter[]> | null = null;
let pendingTimeoutMs = 0;

/** Resolves with the row's value, or null when the row is missing or Supabase can't be reached. */
function readSiteDataValue(key: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve) => {
    if (!pendingBatch) {
      const batch = new Map<string, Waiter[]>();
      pendingBatch = batch;
      pendingTimeoutMs = timeoutMs;
      setTimeout(() => {
        const ms = pendingTimeoutMs;
        pendingBatch = null;
        void flushBatch(batch, ms);
      }, 0);
    } else {
      pendingTimeoutMs = Math.max(pendingTimeoutMs, timeoutMs);
    }
    const waiters = pendingBatch.get(key);
    if (waiters) waiters.push(resolve);
    else pendingBatch.set(key, [resolve]);
  });
}

async function flushBatch(batch: Map<string, Waiter[]>, timeoutMs: number): Promise<void> {
  const keys = [...batch.keys()];
  const values = new Map<string, unknown>();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data, error } = await supabase
      .from("site_data")
      .select("key, value")
      .in("key", keys)
      .abortSignal(controller.signal);
    if (error) throw error;
    data?.forEach((row) => values.set(row.key, row.value));
  } catch (err: any) {
    // Abort errors are expected on timeout; the static files take over.
    if (!controller.signal.aborted) {
      console.warn(`[site_data] Supabase fetch failed for ${keys.join(", ")}:`, err?.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  batch.forEach((waiters, key) => {
    const value = values.get(key) ?? null;
    waiters.forEach((resolve) => resolve(value));
  });
}

export async function fetchSiteData<T>(
  key: string,
  fallbackFile: string | null,
  /** Timeout in ms before falling back to static file */
  timeoutMs = 8_000,
): Promise<T> {
  const cacheKey = `${key}:${fallbackFile}`;

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  const promise = (async () => {
    // Try Supabase first
    if (isSupabaseConfigured) {
      const value = await readSiteDataValue(key, timeoutMs);
      if (value != null) return value as T;
      // Key doesn't exist in DB yet (or Supabase is unreachable) — fall
      // through to the static file. (Intentionally silent fallback)
    }

    if (!fallbackFile) {
      throw new Error(`site_data "${key}" is unavailable and has no fallback file`);
    }

    const res = await fetch(
      `${import.meta.env.BASE_URL}data/${fallbackFile}?v=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(`Fallback file not found: ${fallbackFile}`);
    }
    const contentType = res.headers.get("content-type");
    if (contentType && !contentType.includes("application/json")) {
      throw new Error(`Fallback file is not JSON: ${fallbackFile}`);
    }
    return res.json();
  })();

  inFlightRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    // Remove from in-flight cache shortly after resolution to allow fresh refetches
    setTimeout(() => {
      if (inFlightRequests.get(cacheKey) === promise) {
        inFlightRequests.delete(cacheKey);
      }
    }, 100);
  }
}
