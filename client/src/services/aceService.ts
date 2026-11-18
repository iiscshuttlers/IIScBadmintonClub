import { supabase } from "@/lib/supabase";

/**
 * ACE training data, fetched through the `ace-training` edge function so the
 * ACE secret never reaches the browser. The function looks up the caller's own
 * verified email; there is no way to ask for someone else's data.
 */
// `reason` is null on success. (tsconfig has strict off, so a boolean `ok`
// discriminant wouldn't narrow.)
export interface AceTrainingResult {
  data: unknown;
  reason: null | "not_configured" | "not_signed_in" | "no_account";
}

export async function fetchAceTraining(): Promise<AceTrainingResult> {
  const { data, error } = await supabase.functions.invoke("ace-training", { method: "GET" });
  if (!error) return { data, reason: null };

  // FunctionsHttpError carries the Response as `context`.
  const status = (error as { context?: { status?: number } }).context?.status;
  if (status === 503) return { data: null, reason: "not_configured" };
  if (status === 401) return { data: null, reason: "not_signed_in" };
  return { data: null, reason: "no_account" };
}
