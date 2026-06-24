import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { formatPlayerData } from "@/services/playerService";
import type { PlayerProfileType } from "@/types";

const MATCH_SELECT =
  "*, player1:players!player1_id(id, full_name, avatar_url), player2:players!player2_id(id, full_name, avatar_url), partner1:players!team1_partner_id(id, full_name, avatar_url), partner2:players!team2_partner_id(id, full_name, avatar_url)";

function matchParticipantIds(match: any): string[] {
  return [
    match.player1_id,
    match.player2_id,
    match.team1_partner_id,
    match.team2_partner_id,
  ].filter(Boolean);
}

function isMatchParticipant(match: any, playerId?: string | null): boolean {
  return !!playerId && matchParticipantIds(match).includes(playerId);
}

function visibleMatchesForViewer(
  matches: any[],
  viewerPlayerId?: string | null,
): any[] {
  return matches.filter(
    (match) =>
      match.status === "confirmed" || isMatchParticipant(match, viewerPlayerId),
  );
}

async function fetchProfileMatches(profileId: string, signal?: AbortSignal) {
  const runQuery = (participantFilter: string) => {
    const query = supabase
      .from("matches")
      .select(MATCH_SELECT)
      .in("status", ["confirmed", "pending"])
      .or(participantFilter)
      .order("created_at", { ascending: false })
      .limit(50);

    return signal ? query : query;
  };

  const fullParticipantFilter = `player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`;
  const legacyParticipantFilter = `player1_id.eq.${profileId},player2_id.eq.${profileId}`;

  const fullRes = await runQuery(fullParticipantFilter);
  if (!fullRes.error) return fullRes;

  if (signal?.aborted || fullRes.error?.message?.includes("aborted")) {
    return fullRes;
  }

  console.warn(
    "Falling back to legacy match participant query:",
    fullRes.error.message,
  );
  return runQuery(legacyParticipantFilter);
}

export function usePlayerProfileData(id: string | undefined, ownPlayerProfileId: string | undefined) {
  const [player, setPlayer] = useState<PlayerProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [eloRank, setEloRank] = useState<number | null>(null);
  const [rawMatches, setRawMatches] = useState<any[]>([]);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [eloLogs, setEloLogs] = useState<any[]>([]);
  const profileLoadRetried = useRef(false);

  // Initial load
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const { signal } = controller;

    const failsafe = setTimeout(() => {
      if (!signal.aborted) setLoading(false);
    }, 15000);

    (async () => {
      setLoading(true);
      try {
        const [playerRes, matchesRes, eloRes, eloLogsRes] = await Promise.all([
          supabase.from("players").select("*").eq("id", id).maybeSingle(),
          fetchProfileMatches(id, signal),
          supabase
            .from("players")
            .select("id, elo_rating")
            .is("deleted_at", null)
            .order("elo_rating", { ascending: false }),
          supabase
            .from("elo_calculation_logs")
            .select("*")
            .eq("player_id", id)
            .order("created_at", { ascending: true })
        ]);

        if (signal.aborted) return;

        if (playerRes.error || !playerRes.data) {
          setPlayer(null);
        } else {
          setPlayer(formatPlayerData(playerRes.data));
        }

        setRawMatches(matchesRes.data || []);
        if (eloLogsRes.data) setEloLogs(eloLogsRes.data);

        if (eloRes.data) {
          const rank = eloRes.data.findIndex((p: any) => p.id === id) + 1;
          setEloRank(rank > 0 ? rank : null);
        }
      } catch (err) {
        if (!signal.aborted) setPlayer(null);
      } finally {
        if (!signal.aborted) setLoading(false);
        clearTimeout(failsafe);
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(failsafe);
    };
  }, [id]);

  // Derive live matches
  useEffect(() => {
    setLiveMatches(visibleMatchesForViewer(rawMatches, ownPlayerProfileId));
  }, [rawMatches, ownPlayerProfileId]);

  // Retry logic for auth cold-starts
  useEffect(() => {
    if (!id || loading || player !== null || profileLoadRetried.current) return;
    profileLoadRetried.current = true;
    
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const [playerRes, matchesRes, eloRes, eloLogsRes] = await Promise.all([
          supabase.from("players").select("*").eq("id", id).maybeSingle(),
          fetchProfileMatches(id),
          supabase
            .from("players")
            .select("id, elo_rating")
            .is("deleted_at", null)
            .order("elo_rating", { ascending: false }),
          supabase
            .from("elo_calculation_logs")
            .select("*")
            .eq("player_id", id)
            .order("created_at", { ascending: true })
        ]);
        if (playerRes.data) setPlayer(formatPlayerData(playerRes.data));
        if (matchesRes.data) setRawMatches(matchesRes.data);
        if (eloLogsRes.data) setEloLogs(eloLogsRes.data);
        if (eloRes.data) {
          const rank = eloRes.data.findIndex((p: any) => p.id === id) + 1;
          setEloRank(rank > 0 ? rank : null);
        }
      } finally {
        setLoading(false);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [id, loading, player]);

  const silentRefresh = useCallback(async () => {
    if (!id) return;
    try {
      const [playerRes, matchesRes] = await Promise.all([
        supabase.from("players").select("*").eq("id", id).maybeSingle(),
        fetchProfileMatches(id),
      ]);
      if (playerRes.data) setPlayer(formatPlayerData(playerRes.data));
      if (matchesRes.data) setRawMatches(matchesRes.data);
    } catch {}
  }, [id]);

  return { player, loading, eloRank, liveMatches, eloLogs, silentRefresh, isMatchParticipant };
}
