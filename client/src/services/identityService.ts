import { supabase } from "@/lib/supabase";

/**
 * WP8 identity RPCs (newer than the generated types, so untyped calls).
 * Requesting a claim never changes ownership; only an administrator's
 * previewed merge does.
 */
const db = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { code?: string; message: string } | null }>;
  from: (t: string) => any;
};

export interface MergePreview {
  guest: { id: string; name: string | null };
  target: { id: string; name: string | null };
  references: { table: string; column: string; rows: number }[];
  conflicts: { table: string; rows: number; kind: "same_row" | "same_event_entry" | string }[];
  blockers: string[];
  aliasRedirects: number;
}

export interface ClaimRequest {
  id: number;
  guest_id: string;
  requester_id: string;
  evidence: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  decision_note: string | null;
  created_at: string;
}

export async function requestPlayerClaim(guestId: string, evidence: string): Promise<{ requestId: number; created: boolean }> {
  const { data, error } = await db.rpc("request_player_claim", { p_guest_id: guestId, p_evidence: evidence });
  if (error) throw error;
  return { requestId: Number(data?.request_id), created: !!data?.created };
}

export async function fetchMyClaimRequest(guestId: string, requesterId: string): Promise<ClaimRequest | null> {
  const { data, error } = await db
    .from("player_claim_requests")
    .select("id, guest_id, requester_id, evidence, status, decision_note, created_at")
    .eq("guest_id", guestId)
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as ClaimRequest) ?? null;
}

export async function fetchPendingClaimRequests(): Promise<ClaimRequest[]> {
  const { data, error } = await db
    .from("player_claim_requests")
    .select("id, guest_id, requester_id, evidence, status, decision_note, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClaimRequest[];
}

export async function previewPlayerMerge(guestId: string, realId: string): Promise<MergePreview> {
  const { data, error } = await db.rpc("preview_player_merge", { p_guest_id: guestId, p_real_id: realId });
  if (error) throw error;
  return {
    guest: data?.guest ?? { id: guestId, name: null },
    target: data?.target ?? { id: realId, name: null },
    references: Array.isArray(data?.references) ? data.references : [],
    conflicts: Array.isArray(data?.conflicts) ? data.conflicts : [],
    blockers: Array.isArray(data?.blockers) ? data.blockers.map(String) : [],
    aliasRedirects: Number(data?.alias_redirects ?? 0),
  };
}

export async function mergePlayerIdentity(params: { guestId: string; realId: string; reason: string; operationId: string }) {
  const { data, error } = await db.rpc("merge_player_identity", {
    p_guest_id: params.guestId,
    p_real_id: params.realId,
    p_reason: params.reason,
    p_operation_id: params.operationId,
  });
  if (error) throw error;
  return data as { applied: boolean };
}

export interface ReversiblePlayerMerge {
  operation_id: string;
  guest_id: string;
  target_id: string;
  guest_name: string | null;
  target_name: string | null;
  merged_at: string;
  summary: { moved?: Array<{ table: string; column: string; rows: number }> } | null;
}

export async function fetchReversiblePlayerMerges(): Promise<ReversiblePlayerMerge[]> {
  const { data, error } = await db.rpc("list_reversible_player_merges", {});
  if (error) throw error;
  return (data ?? []) as ReversiblePlayerMerge[];
}

export async function reversePlayerIdentityMerge(operationId: string, reason: string) {
  const { data, error } = await db.rpc("reverse_player_identity_merge", {
    p_operation_id: operationId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as { applied: boolean; restored_references?: number; guest_id?: string };
}

export async function decidePlayerClaim(params: { requestId: number; approve: boolean; note: string; operationId: string }) {
  const { data, error } = await db.rpc("decide_player_claim", {
    p_request_id: params.requestId,
    p_approve: params.approve,
    p_note: params.note,
    p_operation_id: params.operationId,
  });
  if (error) throw error;
  return data as { status: string; applied: boolean };
}

/** Surviving player ID for a merged (old) ID, or null. */
export async function resolvePlayerAlias(oldId: string): Promise<string | null> {
  const { data, error } = await db.from("player_aliases").select("player_id").eq("old_player_id", oldId).maybeSingle();
  if (error) return null; // alias table not deployed yet → behave as before
  return (data?.player_id as string) ?? null;
}

export function mergeBlockerText(code: string): string {
  switch (code) {
    case "same_player":
      return "Both records are the same player.";
    case "source_not_guest":
      return "Only guest records can be merged into a member.";
    case "target_is_guest":
      return "The target must be a registered member, not another guest.";
    case "target_deleted":
      return "The target member profile is deleted.";
    case "history_conflict":
      return "These two records appear in the same match or the same event entry. Merging would make a player play themself, so fix those matches first.";
    default:
      return `Blocked (${code}).`;
  }
}

const TABLE_LABELS: Record<string, string> = {
  matches: "Friendly matches",
  tournament_matches: "Tournament matches",
  tournament_participants: "Tournament entries",
  tournament_team_members: "Team memberships",
  tournament_teams: "Team captaincies",
  tie_lineups: "Team lineups",
  elo_calculation_logs: "Rating history entries",
};

export function referenceTableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table.replace(/_/g, " ");
}
