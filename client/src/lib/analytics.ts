import { supabase } from "@/lib/supabase";

// analytics_events is new; generated types regenerate after the migration is
// applied (npx supabase db push). Cast until then.
const sb = supabase as any;

/**
 * #27 Fire-and-forget product analytics. Never throws, never blocks the UI.
 * Only records events for signed-in users (RLS requires an authenticated
 * caller). Keep `props` small and free of PII.
 */
export function track(event: string, props: Record<string, unknown> = {}): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (!uid) return;
      await sb.from("analytics_events").insert({ event, props, player_id: uid });
    } catch {
      /* analytics is best-effort */
    }
  })();
}
