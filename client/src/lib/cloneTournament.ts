import { supabase } from "@/lib/supabase";

/**
 * Start a new tournament from a past one: copies format/settings, per-round
 * scoring rules and officials. Never copies participants, matches, dates,
 * registration form links or status — the clone is a fresh draft.
 */

/** Columns that describe *how* the event runs, safe to reuse. */
export const CLONED_COLUMNS = [
  "description",
  "format_family",
  "tournament_type",
  "bracket_format",
  "categories",
  "counts_for_elo",
  "eligibility",
  "venue",
  "ignore_gender_rules",
  "max_rubbers_per_player",
  "play_dead_rubbers",
  "require_app_registration",
  "show_brackets",
  "show_participants",
  "team_roster_max",
  "team_roster_min",
  "team_self_registration",
  "tie_format_config",
  "tie_points_draw",
  "tie_points_win",
  "auto_reminders_enabled",
] as const;

export function cloneName(name: string, year = new Date().getFullYear()): string {
  const base = name.replace(/\s*\(copy\)\s*$/i, "").trim();
  // "Invicta 2025" → "Invicta 2026"; otherwise append "(copy)".
  const m = base.match(/^(.*?)(\b(?:19|20)\d{2}\b)(.*)$/);
  if (m && Number(m[2]) < year) return `${m[1]}${year}${m[3]}`.trim();
  return `${base} (copy)`;
}

export function buildClonePayload(src: Record<string, any>, createdBy: string | null | undefined) {
  const payload: Record<string, any> = {};
  for (const c of CLONED_COLUMNS) if (src[c] !== undefined) payload[c] = src[c];
  return {
    ...payload,
    name: cloneName(src.name ?? "Tournament"),
    year: new Date().getFullYear(),
    status: "draft",
    created_by: createdBy ?? null,
  };
}

export async function cloneTournament(src: Record<string, any>, createdBy: string | null | undefined) {
  const { data: created, error } = await supabase
    .from("tournaments")
    .insert(buildClonePayload(src, createdBy) as any)
    .select()
    .single();
  if (error) throw error;

  const warnings: string[] = [];
  const [{ data: rules }, { data: officials }] = await Promise.all([
    supabase.from("tournament_round_rules").select("category, round, round_name, best_of_sets, points_to_win, golden_point").eq("tournament_id", src.id),
    (supabase as any).from("tournament_officials").select("user_id, role").eq("tournament_id", src.id),
  ]);
  if (rules?.length) {
    const { error: e } = await supabase
      .from("tournament_round_rules")
      .insert(rules.map((r: any) => ({ ...r, tournament_id: created.id })));
    if (e) warnings.push("scoring rules");
  }
  // The creator is already the organiser via created_by; don't add a duplicate row.
  const toCopy = (officials ?? []).filter((o: any) => !(o.user_id === createdBy && o.role === "ORGANIZER"));
  if (toCopy.length) {
    const { error: e } = await (supabase as any)
      .from("tournament_officials")
      .upsert(
        toCopy.map((o: any) => ({ ...o, tournament_id: created.id, assigned_by: createdBy ?? null })),
        { onConflict: "tournament_id,user_id,role", ignoreDuplicates: true },
      );
    if (e) warnings.push("officials");
  }
  return { tournament: created, warnings };
}
