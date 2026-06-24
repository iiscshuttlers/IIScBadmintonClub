import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPlayerMatches } from "@/services/matchService";
import type { PlayerRow, MatchWithPlayers } from "@/types";
import { visibleMatchesForViewer, formatPlayerData } from "@/lib/playerUtils";
import { MATCH_SELECT_WITH_PLAYERS } from "@/types";


export function usePlayerProfile(targetPlayerId: string | undefined, isMatchesOnly: boolean = false) {
  const { session: authSession, profile: ownPlayerProfile } = useAuth();
  
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [liveMatches, setLiveMatches] = useState<MatchWithPlayers[]>([]);
  const [rawMatches, setRawMatches] = useState<MatchWithPlayers[]>([]);
  const [eloLogs, setEloLogs] = useState<any[]>([]);
  const [pendingMatches, setPendingMatches] = useState<MatchWithPlayers[]>([]);
  const [eloRank, setEloRank] = useState<number | null>(null);
  
  const [h2hRecord, setH2hRecord] = useState<{ wins: number; losses: number } | null>(null);
  const [allPlayers, setAllPlayers] = useState<{ id: string; full_name: string; avatar_url?: string; gender?: string }[]>([]);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBuddy, setIsBuddy] = useState(false);
  const [hasSentRequest, setHasSentRequest] = useState(false);
  const [hasReceivedRequest, setHasReceivedRequest] = useState(false);
  
  const profileLoadRetried = useRef(false);

  const fetchPendingMatches = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("matches")
        .select(MATCH_SELECT_WITH_PLAYERS)
        .eq("status", "pending")
        .neq("submitted_by", id)
        .or(`player1_id.eq.${id},player2_id.eq.${id},team1_partner_id.eq.${id},team2_partner_id.eq.${id}`);
      if (error) throw error;
      setPendingMatches(data || []);
    } catch (e) {
      console.error("fetchPendingMatches error:", e);
    }
  }, []);

  const loadPageData = useCallback(async (signal: AbortSignal) => {
    if (!targetPlayerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [playerRes, matchesRes, eloRes, eloLogsRes] = await Promise.all([
        supabase.from("players").select("*").eq("id", targetPlayerId).maybeSingle(),
        fetchPlayerMatches(targetPlayerId, 100),
        supabase.from("players").select("id, elo_rating").is("deleted_at", null).order("elo_rating", { ascending: false }),
        supabase.from("elo_calculation_logs").select("*").eq("player_id", targetPlayerId).order("created_at", { ascending: true })
      ]);

      if (signal.aborted) return;

      if (playerRes.error) {
        setPlayer(null);
      } else if (playerRes.data) {
        // Just set raw data for now, the UI formats it or we can map it
        setPlayer(formatPlayerData(playerRes.data));
      }

      setRawMatches(matchesRes || []);
      if (eloLogsRes.data) setEloLogs(eloLogsRes.data);
      
      if (eloRes.data) {
        const rank = eloRes.data.findIndex((p: any) => p.id === targetPlayerId) + 1;
        setEloRank(rank > 0 ? rank : null);
      }
    } catch (err) {
      if (!signal.aborted) setPlayer(null);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [targetPlayerId]);

  useEffect(() => {
    if (!targetPlayerId) return;
    const controller = new AbortController();
    loadPageData(controller.signal);
    return () => controller.abort();
  }, [targetPlayerId, loadPageData]);

  useEffect(() => {
    setLiveMatches(visibleMatchesForViewer(rawMatches, ownPlayerProfile?.id));
  }, [rawMatches, ownPlayerProfile?.id]);

  useEffect(() => {
    if (!authSession) {
      setPendingMatches([]);
      return;
    }
    const loadAuxData = async () => {
      const { data } = await supabase.from("players").select("id, full_name, avatar_url, gender").is("deleted_at", null);
      if (data) setAllPlayers(data);
    };
    loadAuxData();
    if (ownPlayerProfile?.id) {
      fetchPendingMatches(ownPlayerProfile.id);
    }
  }, [authSession, ownPlayerProfile?.id, fetchPendingMatches]);

  useEffect(() => {
    if (!targetPlayerId || loading || player !== null || profileLoadRetried.current) return;
    profileLoadRetried.current = true;
    const t = setTimeout(() => {
      const controller = new AbortController();
      loadPageData(controller.signal);
    }, 1500);
    return () => clearTimeout(t);
  }, [targetPlayerId, loading, player, loadPageData]);

  const checkBuddyStatus = useCallback(async () => {
    if (!ownPlayerProfile?.id || !targetPlayerId) return;
    try {
      const { data } = await supabase
        .from("buddy_requests")
        .select("id, status, sender_id")
        .or(`and(sender_id.eq.${ownPlayerProfile.id},receiver_id.eq.${targetPlayerId}),and(sender_id.eq.${targetPlayerId},receiver_id.eq.${ownPlayerProfile.id})`)
        .maybeSingle();

      if (data) {
        if (data.status === "accepted") {
          setIsBuddy(true);
          setHasSentRequest(false);
          setHasReceivedRequest(false);
        } else if (data.sender_id === ownPlayerProfile.id) {
          setIsBuddy(false);
          setHasSentRequest(true);
          setHasReceivedRequest(false);
        } else {
          setIsBuddy(false);
          setHasSentRequest(false);
          setHasReceivedRequest(true);
        }
      } else {
        setIsBuddy(false);
        setHasSentRequest(false);
        setHasReceivedRequest(false);
      }
    } catch (err) {
      console.error("Error checking buddy status:", err);
    }
  }, [ownPlayerProfile?.id, targetPlayerId]);

  useEffect(() => {
    if (ownPlayerProfile && player?.id) {
      checkBuddyStatus();
      setIsFollowing(ownPlayerProfile.following?.includes(player.id) || false);
    }
  }, [ownPlayerProfile, player, checkBuddyStatus]);

  const refreshPlayerProfile = async () => {
    const controller = new AbortController();
    await loadPageData(controller.signal);
  };

  return {
    player,
    setPlayer,
    loading,
    setLoading,
    liveMatches,
    rawMatches,
    setLiveMatches,
    setRawMatches,
    eloLogs,
    eloRank,
    pendingMatches,
    fetchPendingMatches,
    h2hRecord,
    setH2hRecord,
    allPlayers,
    isFollowing,
    setIsFollowing,
    isBuddy,
    setIsBuddy,
    hasSentRequest,
    setHasSentRequest,
    hasReceivedRequest,
    setHasReceivedRequest,
    checkBuddyStatus,
    refreshPlayerProfile,
  };
}
