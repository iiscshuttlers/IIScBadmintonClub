import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Fetch dynamic site data from Supabase `site_data` table.
 * Falls back to a static JSON file in `public/data/` if Supabase is
 * unavailable or the key doesn't exist yet.
 *
 * Usage:
 *   const holidays = await fetchSiteData<Holiday[]>("holidays", "holidays.json");
 */
export async function fetchSiteData<T>(
  key: string,
  fallbackFile: string,
  /** Timeout in ms before falling back to static file */
  timeoutMs = 8_000
): Promise<T> {
  // Try Supabase first
  if (isSupabaseConfigured) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const query = supabase
        .from("site_data")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      const { data, error } = await (query as any).abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (!error && data?.value != null) {
        return data.value as T;
      }

      // Key doesn't exist in DB yet — fall through to static file
      if (!error) {
        console.info(`[site_data] Key "${key}" not found in DB, using static fallback`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      // Don't log abort errors as warnings — they're expected on timeout
      if (!controller.signal.aborted) {
        console.warn(`[site_data] Supabase fetch failed for "${key}":`, err?.message);
      }
    }
  }

  // Fallback: fetch from static JSON in public/data/
  const res = await fetch(
    `${import.meta.env.BASE_URL}data/${fallbackFile}?v=${Date.now()}`,
    { cache: "no-store" }
  );
  return res.json() as Promise<T>;
}
