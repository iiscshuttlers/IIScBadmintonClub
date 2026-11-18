import { supabase } from "@/lib/supabase";
import { parseCorrectionPreview, type AuditEventRow, type CorrectionPreview } from "@/lib/correctionPreview";

/**
 * WP7 correction RPCs. These functions/tables are newer than the generated
 * Supabase types, so calls go through an untyped handle.
 */
const db = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
  from: (table: string) => any;
};

export async function previewTournamentMatchCorrection(matchId: string, winnerSide: 1 | 2 | null): Promise<CorrectionPreview> {
  const { data, error } = await db.rpc("preview_tournament_match_correction", {
    p_match_id: matchId,
    p_winner_side: winnerSide,
  });
  if (error) throw error;
  return parseCorrectionPreview(data);
}

export async function undoTournamentMatchCorrection(params: {
  eventId: number;
  expectedRevision: number;
  reason: string;
  operationId: string;
}): Promise<{ applied: boolean; revision: number }> {
  const { data, error } = await db.rpc("undo_tournament_match_correction", {
    p_event_id: params.eventId,
    p_expected_revision: params.expectedRevision,
    p_reason: params.reason,
    p_operation_id: params.operationId,
  });
  if (error) throw error;
  const r = (data ?? {}) as { applied?: boolean; revision?: number };
  return { applied: !!r.applied, revision: Number(r.revision ?? 0) };
}

/** Immutable audit history for one entity (match or participant), newest first. */
export async function fetchAuditEvents(entityId: string, limit = 20): Promise<AuditEventRow[]> {
  const { data, error } = await db
    .from("tournament_audit_events")
    .select("id, action, actor_email, reason, before, after, undoes_event_id, source, created_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditEventRow[];
}
