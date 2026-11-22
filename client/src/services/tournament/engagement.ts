/**
 * Viewer engagement: bracket predictions and leaderboard, and post-tournament
 * feedback.
 */
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/supabase-types-auto";

export async function fetchBracketPredictions(tournamentId: string, category: string, userId: string) {
  const { data, error } = await supabase
    .from("bracket_predictions")
    .select("picks")
    .eq("tournament_id", tournamentId)
    .eq("category", category)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.picks ?? {}) as Record<string, string>;
}

export async function saveBracketPredictions(payload: {
  tournament_id: string;
  category: string;
  user_id: string;
  picks: Json;
}): Promise<void> {
  const { error } = await supabase.from("bracket_predictions").upsert({
    ...payload,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchBracketLeaderboard(tournamentId: string, category: string) {
  const { data, error } = await supabase.rpc("bracket_leaderboard", {
    p_tournament: tournamentId,
    p_category: category,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTournamentFeedback(tournamentId: string, userId: string) {
  const [{ data: played }, { data: mine, error }] = await Promise.all([
    supabase.rpc("played_in_tournament", { p_tournament: tournamentId, p_uid: userId }),
    supabase
      .from("tournament_feedback")
      .select("rating, tags, comment")
      .eq("tournament_id", tournamentId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (error) throw error;
  return { played: !!played, mine };
}

export async function submitTournamentFeedback(payload: {
  tournament_id: string;
  user_id: string;
  rating: number;
  tags?: string[];
  comment?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("tournament_feedback").upsert({
    ...payload,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
