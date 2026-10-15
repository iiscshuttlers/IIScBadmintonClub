import { supabase } from "./supabase";
import type { CertificateInput, Placement } from "./certificate";

export interface IssuedCertificate {
  id: string;
  code: string;
}

export async function issueCertificate(
  tournamentId: string,
  input: CertificateInput,
): Promise<IssuedCertificate> {
  const { data, error } = await (supabase.rpc as any)("issue_certificate", {
    p_tournament_id: tournamentId,
    p_recipient: input.recipient,
    p_placement: input.placement,
    p_category: input.category,
    p_achievement: input.achievement ?? null,
    p_tournament_name: input.tournamentName,
    p_event_date: input.date ?? null,
  });
  if (error) throw error;
  const row = data?.[0] ?? data;
  return { id: row.id, code: row.code };
}

export interface VerifiedCertificate {
  id: string;
  code: string;
  recipient: string;
  placement: Placement;
  category: string;
  achievement: string | null;
  tournament_name: string;
  event_date: string | null;
  issued_at: string;
}

export async function verifyCertificate(code: string): Promise<VerifiedCertificate | null> {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await (supabase.from as any)("certificates")
    .select("id, code, recipient, placement, category, achievement, tournament_name, event_date, issued_at")
    .eq("code", normalized)
    .maybeSingle();
  if (error) throw error;
  return (data as VerifiedCertificate | null);
}
