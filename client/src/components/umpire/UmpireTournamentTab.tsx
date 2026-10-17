import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Swords, MapPin, Clock, Settings2, ChevronRight,
  ChevronLeft, ChevronDown, Trophy, Users, Play, CalendarDays, Bell, Flag, Eye, X, ClipboardEdit, Megaphone
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getCourtColor, cn } from "@/lib/utils";
import { toLocalDateTimeInput, localDateTimeInputToIso } from "@/lib/umpire/schedule";
import { TieUmpireConsole } from "./TieUmpireConsole";

export interface TournamentMatchForUmpire {
  id: string;
  tournament_id: string;
  tournament_name: string;
  category: string;
  match_code: string;
  round_name: string;
  round?: number;
  match_number?: number;
  player1_id: string | null;
  player3_id: string | null;
  team1_label: string | null;
  player2_id: string | null;
  player4_id: string | null;
  team2_label: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  locked: boolean;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
  tie_id?: string | null;
}

interface Props {
  onStartMatch: (match: TournamentMatchForUmpire) => void;
  tournamentId?: string;
  tournament?: any;
}

const CAT_LABELS: Record<string, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

const CAT_COLORS: Record<string, { bg: string; active: string; dot: string }> = {
  MS: { bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300", active: "bg-blue-600 text-foreground border-blue-600", dot: "bg-blue-500" },
  WS: { bg: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300", active: "bg-pink-600 text-foreground border-pink-600", dot: "bg-pink-500" },
  MD: { bg: "bg-primary/10 dark:bg-primary/30 border-primary/40 dark:border-primary/80 text-primary dark:text-primary/70", active: "bg-primary text-primary-foreground border-primary", dot: "bg-primary" },
  WD: { bg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300", active: "bg-purple-600 text-foreground border-purple-600", dot: "bg-purple-500" },
  XD: { bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300", active: "bg-orange-600 text-foreground border-orange-600", dot: "bg-orange-500" },
};

const DEFAULT_COLORS = { bg: "bg-slate-700 border-slate-600 text-slate-300", active: "bg-slate-600 text-foreground border-slate-600", dot: "bg-slate-400" };

const CAT_BOX_COLORS_DARK: Record<string, string> = {
  MS: "bg-blue-900/20 border-blue-900/40 hover:border-blue-500/50 hover:shadow-blue-500/20",
  WS: "bg-pink-900/20 border-pink-900/40 hover:border-pink-500/50 hover:shadow-pink-500/20",
  MD: "bg-primary/10 border-primary/20 hover:border-primary/50 hover:shadow-primary/20",
  WD: "bg-purple-900/20 border-purple-900/40 hover:border-purple-500/50 hover:shadow-purple-500/20",
  XD: "bg-orange-900/20 border-orange-900/40 hover:border-orange-500/50 hover:shadow-orange-500/20",
  BS: "bg-teal-900/20 border-teal-900/40 hover:border-teal-500/50 hover:shadow-teal-500/20",
  GS: "bg-rose-900/20 border-rose-900/40 hover:border-rose-500/50 hover:shadow-rose-500/20",
  BD: "bg-cyan-900/20 border-cyan-900/40 hover:border-cyan-500/50 hover:shadow-cyan-500/20",
  GD: "bg-fuchsia-900/20 border-fuchsia-900/40 hover:border-fuchsia-500/50 hover:shadow-fuchsia-500/20",
};

export function UmpireTournamentTab({ onStartMatch, tournamentId, tournament }: Props) {
  const [allMatches, setAllMatches] = useState<TournamentMatchForUmpire[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"format" | "match" | "confirm">("format");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatchForUmpire | null>(null);

  // Filters for upcoming scheduled matches
  const [upcomingSearch, setUpcomingSearch] = useState("");
  const [upcomingFormat, setUpcomingFormat] = useState("ALL");
  const [upcomingDate, setUpcomingDate] = useState("ALL");
  const [upcomingCourt, setUpcomingCourt] = useState("ALL");
  const [upcomingStatus, setUpcomingStatus] = useState<"ALL" | "upcoming" | "live" | "completed">("ALL");
  const [collapsedRounds, setCollapsedRounds] = useState<Record<string, boolean>>({});
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [walkoverFor, setWalkoverFor] = useState<TournamentMatchForUmpire | null>(null);
  const [savingWalkover, setSavingWalkover] = useState(false);
  const [rescheduleFor, setRescheduleFor] = useState<TournamentMatchForUmpire | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleCourt, setRescheduleCourt] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [activeTieForConsole, setActiveTieForConsole] = useState<{ tie: any; tournament: any } | null>(null);
  const [pendingTies, setPendingTies] = useState<any[]>([]);
  const [availableTournaments, setAvailableTournaments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(() => {
    if (tournamentId) return tournamentId;
    try { return localStorage.getItem("umpire_selected_tournament") || null; } catch { return null; }
  });
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);

  const switchTournament = (id: string) => {
    setSelectedTournamentId(id);
    setShowTournamentPicker(false);
    try { localStorage.setItem("umpire_selected_tournament", id); } catch {}
  };
  const [directScoreFor, setDirectScoreFor] = useState<TournamentMatchForUmpire | null>(null);
  const [directSets, setDirectSets] = useState<{ t1: string; t2: string }[]>([{ t1: "", t2: "" }, { t1: "", t2: "" }]);
  const [savingDirectScore, setSavingDirectScore] = useState(false);

  const { session } = useAuth();

  const openDirectScore = (m: TournamentMatchForUmpire) => {
    const numSets = m.best_of_sets || 3;
    const initial = Array.from({ length: numSets }, () => ({ t1: "", t2: "" }));
    setDirectSets(initial);
    setDirectScoreFor(m);
  };

  const submitDirectScore = async () => {
    if (!directScoreFor || !session?.user?.id) return;

    const filledSets = directSets.filter(s => s.t1.trim() !== "" || s.t2.trim() !== "");
    const minSets = (directScoreFor.best_of_sets ?? 3) === 1 ? 1 : 2;
    if (filledSets.length < minSets) {
      toast.error(`Enter at least ${minSets} set${minSets > 1 ? "s" : ""}`);
      return;
    }

    const parsed = filledSets.map(s => ({
      t1: parseInt(s.t1, 10),
      t2: parseInt(s.t2, 10),
    }));

    if (parsed.some(s => isNaN(s.t1) || isNaN(s.t2) || s.t1 < 0 || s.t2 < 0)) {
      toast.error("All scores must be valid non-negative numbers");
      return;
    }

    const t1Wins = parsed.filter(s => s.t1 > s.t2).length;
    const t2Wins = parsed.filter(s => s.t2 > s.t1).length;
    if (t1Wins === t2Wins) {
      toast.error("Scores must produce a winner — tied set count");
      return;
    }
    if (parsed.some(s => s.t1 === s.t2)) {
      toast.error("A set cannot be tied");
      return;
    }

    const winnerSide: 1 | 2 = t1Wins > t2Wins ? 1 : 2;
    const setsArr = parsed.map(s => `${s.t1}-${s.t2}`);
    const scoreStr = setsArr.join(", ");

    setSavingDirectScore(true);
    try {
      const { error } = await (supabase.rpc as any)("submit_tournament_match", {
        p_match_id: directScoreFor.id,
        p_winner_side: winnerSide,
        p_score: scoreStr,
        p_sets: setsArr,
        p_umpire_id: session.user.id,
      });
      if (error) throw error;

      toast.success("Score submitted", {
        description: `${directScoreFor.team1_label ?? "Team 1"} vs ${directScoreFor.team2_label ?? "Team 2"}: ${scoreStr}`,
      });
      setDirectScoreFor(null);
      setSelectedMatch(null);
      setStep("format");
      load({ silent: true });
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit score");
    } finally {
      setSavingDirectScore(false);
    }
  };

  const openReschedule = (m: TournamentMatchForUmpire) => {
    setRescheduleAt(toLocalDateTimeInput(m.scheduled_at));
    setRescheduleCourt(m.court_number ?? "");
    setRescheduleFor(m);
  };

  /**
   * Move a match to a new slot. Court and time travel together because in
   * practice they change together — a match slips because its court is still
   * busy. Unlike the walkover this is a plain row update: nothing about the
   * bracket changes, and RLS already lets umpires write these columns.
   */
  const saveReschedule = async () => {
    if (!rescheduleFor) return;
    const iso = localDateTimeInputToIso(rescheduleAt);
    if (!iso) {
      toast.error("Pick a date and time for the match");
      return;
    }
    setSavingReschedule(true);
    try {
      const { error } = await supabase
        .from("tournament_matches")
        .update({
          scheduled_at: iso,
          court_number: rescheduleCourt.trim() || null,
          status: "scheduled",
          // Let the reminder fire again for the new slot — players were told
          // about the old one.
          reminder_sent: false,
        })
        .eq("id", rescheduleFor.id);
      if (error) throw error;

      toast.success("Match rescheduled", {
        description: `${new Date(iso).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}` +
          `${rescheduleCourt.trim() ? ` · Court ${rescheduleCourt.trim()}` : ""} — players will be reminded again.`,
      });
      setRescheduleFor(null);
      load({ silent: true });
    } catch (e: any) {
      toast.error(e?.message || "Failed to reschedule match");
    } finally {
      setSavingReschedule(false);
    }
  };

  /**
   * Record a no-show. side 1|2 = that team advances; 0 = double walkover, where
   * nobody advances and the next-round slot becomes a BYE.
   *
   * Goes through the record_tournament_walkover RPC rather than updating the row
   * directly: the update needs to set winner_side/score AND advance the bracket
   * atomically, and RLS blocks direct writes to tournament_matches.
   */
  const recordWalkover = async (m: TournamentMatchForUmpire, winnerSide: 0 | 1 | 2) => {
    setSavingWalkover(true);
    try {
      // Cast: supabase-types-auto.ts is generated and doesn't yet list this RPC.
      const { error } = await (supabase.rpc as any)("record_tournament_walkover", {
        p_match_id: m.id,
        p_winner_side: winnerSide,
      });
      if (error) throw error;
      toast.success(
        winnerSide === 0
          ? "Double walkover recorded — next round gets a bye"
          : `Walkover recorded — ${(winnerSide === 1 ? m.team1_label : m.team2_label) ?? "winner"} advances`,
      );
      setWalkoverFor(null);
      setSelectedMatch(null);
      setStep("format");
      load({ silent: true });
    } catch (e: any) {
      toast.error(e?.message || "Failed to record walkover");
    } finally {
      setSavingWalkover(false);
    }
  };

  const handleNotify = async (e: React.MouseEvent, matchId: string) => {
    e.stopPropagation();
    try {
      setNotifyingId(matchId);
      const { error } = await supabase.functions.invoke("match-notifier", {
        body: { type: "manual", match_id: matchId }
      });
      if (error) throw error;
      toast.success("Notification Sent", {
        description: "Players have been notified via email and push.",
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to send notification",
      });
    } finally {
      setNotifyingId(null);
    }
  };

  // `silent` is used by the realtime/focus refresh so the list updates in place
  // without flashing the spinner or surfacing a toast for a transient blip.
  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    // Fetch all active tournaments for the picker
    let allTournamentsQuery = supabase
      .from("tournaments")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (tournamentId) {
      allTournamentsQuery = allTournamentsQuery.eq("id", tournamentId);
    } else {
      allTournamentsQuery = allTournamentsQuery.eq("status", "active");
    }

    const { data: allTournaments } = await allTournamentsQuery;

    if (!allTournaments?.length) { setLoading(false); return; }

    setAvailableTournaments(allTournaments);

    // Auto-select first tournament if none selected
    const activeTId = selectedTournamentId && allTournaments.some(t => t.id === selectedTournamentId)
      ? selectedTournamentId
      : allTournaments[0].id;
    if (!selectedTournamentId) {
      setSelectedTournamentId(activeTId);
      try { localStorage.setItem("umpire_selected_tournament", activeTId); } catch {}
    }

    const tournamentIds = [activeTId];

    const [{ data: activeMatchData, error }, { data: doneMatchData }] = await Promise.all([
      supabase
        .from("tournament_matches")
        .select("*")
        .in("tournament_id", tournamentIds)
        .in("status", ["scheduled", "in_progress"])
        .order("round")
        .order("match_number"),
      supabase
        .from("tournament_matches")
        .select("*")
        .in("tournament_id", tournamentIds)
        .in("status", ["completed", "walkover"])
        .order("scored_at", { ascending: false })
        .limit(50),
    ]);
    const matchData = [...(activeMatchData ?? []), ...(doneMatchData ?? [])];

    if (error) { if (!silent) toast.error(error.message); setLoading(false); return; }

    const { data: rules } = await supabase
      .from("tournament_round_rules")
      .select("*")
      .in("tournament_id", tournamentIds);

    const enriched: TournamentMatchForUmpire[] = (matchData ?? []).map((m: any) => {
      const tournament = allTournaments.find((t) => t.id === m.tournament_id);
      const rule = rules?.find(
        (r) => r.tournament_id === m.tournament_id && r.category === m.category && r.round === m.round
      );
      return {
        ...m,
        tournament_name: tournament?.name ?? "Tournament",
        points_to_win: rule?.points_to_win ?? m.points_to_win ?? 21,
        best_of_sets: rule?.best_of_sets ?? m.best_of_sets ?? 3,
        golden_point: rule?.golden_point ?? m.golden_point ?? 30,
      };
    });

    enriched.sort((a, b) => {
      const priority = (s: string) => {
        if (s === "in_progress") return 0;
        if (s === "completed" || s === "walkover") return 2;
        return 1;
      };
      const pA = priority(a.status);
      const pB = priority(b.status);
      if (pA !== pB) return pA - pB;
      return (a.round || 1) - (b.round || 1) || (a.match_number || 1) - (b.match_number || 1);
    });

    setAllMatches(enriched);
    setSelectedMatch((prev) => (prev ? enriched.find((m) => m.id === prev.id) ?? prev : prev));

    // Fetch team ties needing official attention (unrevealed or pending lineups)
    try {
      const { data: tiesData } = await supabase
        .from("tournament_ties" as any)
        .select(`
          *,
          tournament:tournaments(name),
          team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name),
          team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)
        `)
        .in("tournament_id", tournamentIds)
        .neq("state", "COMPLETED")
        .order("created_at", { ascending: true });

      setPendingTies(tiesData || []);
    } catch (tieErr) {
      console.warn("Could not load pending ties for umpire tab", tieErr);
    }

    setLoading(false);
  }, [tournamentId, selectedTournamentId]);

  useEffect(() => { load(); }, [load]);

  // The match list used to be fetched exactly once on mount, so a bracket edit
  // (participant renamed, partner added late, Sync Names run) never reached an
  // umpire with the panel already open — they had to restart the app. Refresh
  // on realtime bracket changes and whenever the tab regains focus.
  //
  // This only refreshes the *selection* list. `selectedMatch` is separate state
  // and an in-progress scoring session lives in UmpireEngine, so neither is
  // disturbed by a refetch.
  useEffect(() => {
    const channel = supabase
      .channel("umpire_tournament_matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches" },
        () => { load({ silent: true }); },
      )
      .subscribe();

    const onFocus = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const categories = [...new Set(allMatches.map((m) => m.category))];
  const matchesForCategory = allMatches.filter((m) => m.category === selectedCategory);

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );

  if (!allMatches.length) return (
    <div className="flex items-center justify-center gap-3 py-6 px-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center sm:text-left">
      <Swords className="w-5 h-5 text-slate-500 shrink-0" />
      <div>
        <p className="text-xs font-bold text-slate-300">No tournament matches need umpiring right now.</p>
        <p className="text-[11px] text-slate-500">Matches appear here when scheduled or in-progress matches exist in the active tournament.</p>
      </div>
    </div>
  );

  // ── Step 1: Format selection ─────────────────────────────────────────────────
  if (step === "format") {
    const isBye = (m: TournamentMatchForUmpire) => {
      const t1 = m.team1_label;
      const t2 = m.team2_label;
      return t1 === "BYE" || t2 === "BYE" || t1?.toUpperCase().includes("BYE") || t2?.toUpperCase().includes("BYE");
    };

    const availableCourts = [...new Set(allMatches.filter(m => m.court_number && !isBye(m)).map(m => m.court_number!))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    let upcomingScheduled = allMatches
      .filter(m => !isBye(m))
      .filter(m => {
        if (upcomingStatus === "upcoming") return m.status === "scheduled";
        if (upcomingStatus === "live") return m.status === "in_progress";
        if (upcomingStatus === "completed") return m.status === "completed" || m.status === "walkover";
        return true;
      })
      .sort((a, b) => {
        const priority = (s: string) => s === "scheduled" ? 0 : s === "in_progress" ? 1 : 2;
        const pDiff = priority(a.status) - priority(b.status);
        if (pDiff !== 0) return pDiff;
        if (a.scheduled_at && b.scheduled_at) return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        return (a.round || 0) - (b.round || 0) || (a.match_number || 0) - (b.match_number || 0);
      });

    if (upcomingSearch.trim()) {
      const lowerQ = upcomingSearch.toLowerCase();
      upcomingScheduled = upcomingScheduled.filter(m =>
        (m.team1_label?.toLowerCase() || "").includes(lowerQ) ||
        (m.team2_label?.toLowerCase() || "").includes(lowerQ) ||
        (m.match_code?.toLowerCase() || "").includes(lowerQ) ||
        (m.court_number?.toLowerCase() || "").includes(lowerQ)
      );
    }
    if (upcomingFormat !== "ALL") {
      upcomingScheduled = upcomingScheduled.filter(m => m.category === upcomingFormat);
    }
    if (upcomingCourt !== "ALL") {
      upcomingScheduled = upcomingScheduled.filter(m => m.court_number === upcomingCourt);
    }

    const currentTournament = availableTournaments.find(t => t.id === selectedTournamentId) ?? availableTournaments[0];

    return (
      <div className="space-y-4">
        {/* Tournament selector */}
        {currentTournament && (
          <div className="relative">
            <button
              onClick={() => availableTournaments.length > 1 && setShowTournamentPicker(!showTournamentPicker)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-left",
                availableTournaments.length > 1 && "hover:border-primary/50 cursor-pointer"
              )}
            >
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-black text-foreground truncate flex-1">{currentTournament.name}</span>
              {availableTournaments.length > 1 && (
                <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform", showTournamentPicker && "rotate-180")} />
              )}
            </button>
            {showTournamentPicker && availableTournaments.length > 1 && (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTournamentPicker(false)} />
              <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                {availableTournaments.map(t => (
                  <button
                    key={t.id}
                    onClick={() => switchTournament(t.id)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-xs font-bold transition hover:bg-slate-800 flex items-center gap-2",
                      t.id === selectedTournamentId ? "text-primary bg-primary/10" : "text-slate-300"
                    )}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {t.name}
                  </button>
                ))}
              </div>
              </>
            )}
          </div>
        )}

        {/* Team Ties Requiring Attention */}
        {pendingTies.length > 0 && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-800 to-slate-800/80 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-amber-200 uppercase tracking-wider">
                  Team Ties Requiring Umpire Attention ({pendingTies.length})
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pendingTies.map((tie) => {
                const bothLocked = tie.lineup_locked_a && tie.lineup_locked_b;
                const revealed = tie.lineup_revealed;

                return (
                  <div 
                    key={tie.id} 
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <span className="font-mono text-primary">{tie.tie_code}</span>
                        <span>{tie.team_a?.short_name || 'Team A'} vs {tie.team_b?.short_name || 'Team B'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          bothLocked ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {bothLocked ? 'Lineups Ready' : 'Lineups Incomplete'}
                        </span>
                        {bothLocked && !revealed && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                            Awaiting Reveal
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTieForConsole({ tie, tournament: tie.tournament })}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Arbiter Desk
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {allMatches.length > 0 && (
          <div className="mb-6 space-y-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search player, match #..."
              value={upcomingSearch}
              onChange={e => setUpcomingSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-xs text-on-accent rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
            />

            {/* Status pills */}
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {(["ALL", "upcoming", "live", "completed"] as const).map(s => {
                const label = s === "ALL" ? "All" : s === "upcoming" ? "Upcoming" : s === "live" ? "Live" : "Done";
                const count = s === "ALL" ? upcomingScheduled.length
                  : s === "upcoming" ? allMatches.filter(m => m.status === "scheduled").length
                  : s === "live" ? allMatches.filter(m => m.status === "in_progress").length
                  : allMatches.filter(m => m.status === "completed" || m.status === "walkover").length;
                return (
                  <button
                    key={s}
                    onClick={() => setUpcomingStatus(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-all border",
                      upcomingStatus === s
                        ? s === "live" ? "bg-amber-500 text-black border-amber-500" : "bg-primary text-primary-foreground border-primary"
                        : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                    )}
                  >
                    {label} {count > 0 && <span className="opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Format pills */}
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {["ALL", ...categories].map(f => (
                <button
                  key={f}
                  onClick={() => setUpcomingFormat(f)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-all border",
                    upcomingFormat === f
                      ? `${(CAT_COLORS[f] ?? {}).active || "bg-primary text-primary-foreground border-primary"}`
                      : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                  )}
                >
                  {f === "ALL" ? "All" : f}
                </button>
              ))}
            </div>

            {/* Court pills */}
            {availableCourts.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                <button
                  onClick={() => setUpcomingCourt("ALL")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-all border",
                    upcomingCourt === "ALL"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                  )}
                >
                  All Courts
                </button>
                {availableCourts.map(c => (
                  <button
                    key={c}
                    onClick={() => setUpcomingCourt(c)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-all border",
                      upcomingCourt === c
                        ? "bg-blue-500 text-black border-blue-500"
                        : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                    )}
                  >
                    C{c}
                  </button>
                ))}
              </div>
            )}

            {/* Match count */}
            <div className="flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-bold text-slate-400">{upcomingScheduled.length} match{upcomingScheduled.length !== 1 ? "es" : ""}</span>
            </div>
            
            {upcomingScheduled.length === 0 ? (
              <div className="p-4 rounded-2xl border border-slate-700 bg-slate-800/50 text-center text-muted-foreground text-sm">
                No scheduled matches match your filters.
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingScheduled.map((m) => {
                  const noPlayers = !m.team1_label || !m.team2_label;
                  const isLive = m.status === "in_progress";
                  const isDone = m.status === "completed" || m.status === "walkover";

                  return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (!noPlayers && !isDone) { setSelectedMatch(m); setStep("confirm"); } }}
                    className={cn(
                      "relative w-full p-3 rounded-xl border text-left transition-all duration-200 group",
                      isDone
                        ? "bg-slate-800/30 border-slate-800/40 opacity-60"
                        : noPlayers
                          ? "bg-slate-800/40 border-slate-800/50 opacity-50 cursor-not-allowed"
                          : isLive
                            ? "bg-amber-950/30 border-amber-500/40 hover:border-amber-400 cursor-pointer"
                            : "bg-slate-800/60 border-slate-700/60 hover:border-primary/50 cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Left: category + match code */}
                      <span className="text-[9px] font-black text-muted-foreground uppercase bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                        {m.category} {m.match_code}
                      </span>

                      {isLive && (
                        <span className="text-[9px] font-black text-amber-400 flex items-center gap-1 shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />LIVE
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[9px] font-black text-emerald-500 shrink-0">DONE</span>
                      )}

                      {/* Right: court + time + notify */}
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        {m.court_number && (
                          <span className={cn("text-[9px] font-bold", getCourtColor(m.court_number))}>C{m.court_number}</span>
                        )}
                        {m.scheduled_at && (
                          <span className="text-[9px] text-slate-400">
                            {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {!noPlayers && !isDone && m.scheduled_at && (
                          <button
                            onClick={(e) => handleNotify(e, m.id)}
                            disabled={notifyingId === m.id}
                            className="text-primary p-0.5 z-10"
                            title="Send Reminder"
                          >
                            {notifyingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Players row */}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-slate-100 font-bold text-xs truncate flex-1">{m.team1_label ?? "TBD"}</span>
                      <span className="text-[9px] font-black text-rose-400 shrink-0">vs</span>
                      <span className="text-slate-100 font-bold text-xs truncate flex-1 text-right">{m.team2_label ?? "TBD"}</span>
                    </div>

                    {noPlayers && (
                      <p className="text-[9px] text-muted-foreground text-center mt-1 italic">Waiting for previous round</p>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-black text-foreground">Select Format</h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {categories.map((cat) => {
            const colors = CAT_COLORS[cat] ?? DEFAULT_COLORS;
            const catMatches = allMatches.filter((m) => m.category === cat);
            const inProgress = catMatches.filter((m) => m.status === "in_progress").length;

            return (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setStep("match"); }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800 border border-slate-700 hover:border-primary hover:bg-slate-750 transition-all group text-left"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${colors.active} shrink-0`}>
                  {cat}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground">{CAT_LABELS[cat] ?? cat}</p>
                  <p className="text-sm text-muted-foreground">
                    {catMatches.length} match{catMatches.length !== 1 ? "es" : ""} pending
                    {inProgress > 0 && <span className="ml-2 text-amber-400 font-bold">· {inProgress} live</span>}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 2: Match selection ──────────────────────────────────────────────────
  if (step === "match" && selectedCategory) {
    const colors = CAT_COLORS[selectedCategory] ?? DEFAULT_COLORS;

    // Group by round
    const rounds = [...new Set(matchesForCategory.map((m) => m.round_name))];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStep("format"); setSelectedCategory(null); }}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition text-muted-foreground hover:text-on-accent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className={`px-3 py-1.5 rounded-xl font-black text-sm border ${colors.active}`}>{selectedCategory}</div>
          <span className="text-muted-foreground text-sm">{CAT_LABELS[selectedCategory] ?? selectedCategory}</span>
        </div>

        <div className="space-y-4">
          {rounds.map((roundName) => {
            const roundMatches = matchesForCategory.filter((m) => m.round_name === roundName);
            // Default to true (collapsed) if not explicitly set in state
            const isCollapsed = collapsedRounds[roundName] ?? true;
            return (
              <div key={roundName}>
                <button 
                  onClick={() => setCollapsedRounds(prev => ({ ...prev, [roundName]: !(prev[roundName] ?? true) }))}
                  className={cn(
                    "flex items-center justify-between w-full text-left mb-3 px-4 py-2.5 rounded-xl transition-all duration-300 group shadow-sm",
                    !isCollapsed ? "bg-slate-800/80 border border-slate-700 hover:border-slate-600" : "bg-slate-800/40 border border-transparent hover:bg-slate-800/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-md transition-colors",
                      !isCollapsed ? "bg-primary/20 text-primary" : "bg-slate-700 text-slate-400 group-hover:text-slate-300 group-hover:bg-slate-600"
                    )}>
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <p className={cn(
                      "text-xs font-black uppercase tracking-widest transition-colors",
                      !isCollapsed ? "text-slate-200" : "text-slate-400 group-hover:text-slate-300"
                    )}>{roundName}</p>
                  </div>
                  {!isCollapsed && <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full">{roundMatches.length}</span>}
                </button>
                
                {!isCollapsed && (
                  <div className="space-y-2">
                    {roundMatches.map((m) => {
                      const isLive = m.status === "in_progress";
                      const isDoubles = m.category.includes('D') || m.category.includes('Doubles');
                      const noPlayers = !m.team1_label || !m.team2_label || m.team1_label === "TBD" || m.team2_label === "TBD" || !m.player1_id || (isDoubles && !m.player3_id);

                      return (
                        <button
                          key={m.id}
                          disabled={noPlayers}
                          onClick={() => { setSelectedMatch(m); setStep("confirm"); }}
                          className={cn(
                            "relative w-full p-4 sm:p-5 rounded-2xl border text-left transition-all duration-300 group overflow-hidden shadow-sm",
                            isLive
                              ? "bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-500/50 hover:border-amber-400 hover:shadow-amber-500/20 hover:-translate-y-1"
                              : noPlayers
                                ? "bg-slate-800/40 border-slate-800/50 opacity-60 cursor-not-allowed"
                                : `${CAT_BOX_COLORS_DARK[m.category] || "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-primary/50 hover:shadow-primary/20"} hover:shadow-lg hover:-translate-y-1`
                          )}
                        >
                          {!noPlayers && !isLive && (
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          )}
                          {isLive && (
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 opacity-50 group-hover:opacity-100 transition-opacity duration-500 animate-pulse pointer-events-none" />
                          )}

                          <div className="relative flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider bg-slate-950/50 px-2 py-1 rounded-md border border-slate-800">
                                  {m.match_code}
                                </span>
                                {isLive && (
                                  <span className="text-[10px] font-black text-amber-400 flex items-center gap-1.5 bg-amber-950/50 px-2 py-1 rounded-md border border-amber-900/50">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>LIVE
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {m.court_number && (
                                  <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-slate-950/50 border border-slate-800", getCourtColor(m.court_number))}>
                                    <MapPin className="w-3 h-3" /> C{m.court_number}
                                  </span>
                                )}
                                {m.scheduled_at && (
                                  <span className="flex items-center gap-1 text-[10px] font-medium text-slate-300 px-2 py-1 rounded-md bg-slate-950/50 border border-slate-800">
                                    <Clock className="w-3 h-3 text-primary" />
                                    {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 sm:gap-4 mt-1">
                              <div className="flex-1 min-w-0">
                                <span className="text-slate-100 font-bold text-sm sm:text-base block truncate group-hover:text-primary transition-colors">
                                  {m.team1_label ?? "TBD"}
                                </span>
                              </div>
                              <div className="shrink-0 flex flex-col items-center justify-center px-2 sm:px-3">
                                <div className={cn(
                                  "border text-[10px] font-black px-2 sm:px-3 py-1 rounded-full shadow-inner ring-1 ring-white/5",
                                  isLive ? "bg-amber-950/80 border-amber-700/80 text-amber-500" : "bg-slate-950/80 border-slate-700/80 text-rose-400"
                                )}>
                                  VS
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 text-right">
                                <span className="text-slate-100 font-bold text-sm sm:text-base block truncate group-hover:text-primary transition-colors">
                                  {m.team2_label ?? "TBD"}
                                </span>
                              </div>
                            </div>

                            {noPlayers && (
                              <p className="text-[11px] text-muted-foreground text-center mt-2 italic border-t border-slate-800/50 pt-2">
                                Waiting for previous round results
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 3: Confirm & start ──────────────────────────────────────────────────
  if (step === "confirm" && selectedMatch) {
    const colors = CAT_COLORS[selectedMatch.category] ?? DEFAULT_COLORS;

    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setStep(selectedCategory ? "match" : "format"); setSelectedMatch(null); }}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-500 transition text-muted-foreground hover:text-on-accent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-muted-foreground text-xs">Match Details</span>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {/* Category + round banner */}
          <div className={`px-3 py-2 flex items-center gap-2 text-xs ${colors.active}`}>
            <span className="font-black">{selectedMatch.category}</span>
            <span className="font-bold opacity-80">·</span>
            <span className="font-bold opacity-90">{selectedMatch.round_name}</span>
            <span className="ml-auto text-[9px] font-black opacity-70 tracking-wider">{selectedMatch.match_code}</span>
          </div>

          <div className="p-3 space-y-2.5">
            {/* Players — inline row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-muted-foreground font-bold uppercase">Team 1</p>
                <p className="text-foreground font-black text-xs truncate">{selectedMatch.team1_label ?? "TBD"}</p>
              </div>
              <span className="text-[9px] font-black text-rose-400 bg-slate-900 px-2 py-0.5 rounded-full shrink-0">VS</span>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[9px] text-muted-foreground font-bold uppercase">Team 2</p>
                <p className="text-foreground font-black text-xs truncate">{selectedMatch.team2_label ?? "TBD"}</p>
              </div>
            </div>

            {/* Scoring config + court/time — single compact row */}
            <div className="bg-slate-900 rounded-lg px-2.5 py-1.5 flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
              <Settings2 className="w-3 h-3 text-primary shrink-0" />
              <span><span className="font-bold text-primary">{selectedMatch.points_to_win}</span>pts</span>
              <span>·</span>
              <span>Bo<span className="font-bold text-foreground">{selectedMatch.best_of_sets}</span></span>
              <span>·</span>
              <span>GP@<span className="font-bold text-foreground">{selectedMatch.golden_point}</span></span>
              {selectedMatch.court_number && (
                <>
                  <span>·</span>
                  <span className={cn("font-bold", getCourtColor(selectedMatch.court_number))}>C{selectedMatch.court_number}</span>
                </>
              )}
              {selectedMatch.scheduled_at && (
                <>
                  <span>·</span>
                  <span>{new Date(selectedMatch.scheduled_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                </>
              )}
            </div>

            {/* Start button */}
            <button
              onClick={async () => {
                const sessionResponse = await supabase.auth.getSession();
                if (!sessionResponse.data.session?.user?.id) {
                  toast.error("Session expired. Please sign in again.");
                  return;
                }
                onStartMatch(selectedMatch);
              }}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-black text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
            >
              <Play className="w-4 h-4 fill-white" />
              {selectedMatch.status === "in_progress" ? "Resume Match" : "Start Umpiring"}
            </button>

            {/* Call players to the court (push to both sides) */}
            {selectedMatch.status !== "in_progress" && (
              <button
                onClick={async () => {
                  const { data, error } = await supabase.functions.invoke("call-to-court", {
                    body: { match_id: selectedMatch.id },
                  });
                  if (error) {
                    // Non-2xx: the function's JSON error is on error.context (a Response).
                    let detail = "";
                    try {
                      detail = (await (error as any).context?.json?.())?.error ?? "";
                    } catch { /* ignore */ }
                    toast.error(detail || "Couldn't call the players");
                    return;
                  }
                  toast.success(`Called ${(data as any)?.notified ?? 0} player(s) to court`);
                }}
                className="w-full py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 font-bold text-[10px] uppercase tracking-wider transition hover:bg-emerald-500/20 flex items-center justify-center gap-1.5"
              >
                <Megaphone className="w-3.5 h-3.5" /> Call players to court
              </button>
            )}

            {/* Team Tie Lineup & Reveal Console */}
            {selectedMatch.tie_id && (
              <button
                onClick={async () => {
                  const { data: tieData } = await supabase
                    .from('tournament_ties')
                    .select('*, team_a:tournament_teams!tournament_ties_team_a_id_fkey(name), team_b:tournament_teams!tournament_ties_team_b_id_fkey(name)')
                    .eq('id', selectedMatch.tie_id)
                    .single();
                  const { data: tourData } = await supabase
                    .from('tournaments')
                    .select('*')
                    .eq('id', selectedMatch.tournament_id)
                    .single();
                  if (tieData) {
                    setActiveTieForConsole({ tie: tieData, tournament: tourData });
                  }
                }}
                className="w-full py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary font-bold text-[10px] uppercase tracking-wider transition hover:bg-primary/20 flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> Lineup & Reveal Console
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setWalkoverFor(selectedMatch)}
                className="py-2 rounded-lg border border-[var(--warning)]/50 text-[var(--warning)] font-bold text-[10px] uppercase tracking-wider transition hover:bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] flex items-center justify-center gap-1.5">
                <Flag className="w-3.5 h-3.5" /> Walkover
              </button>

              {selectedMatch.status !== "in_progress" ? (
                <>
                  <button
                    onClick={() => openDirectScore(selectedMatch)}
                    className="py-2 rounded-lg border border-emerald-500/40 text-emerald-400 font-bold text-[10px] uppercase tracking-wider transition hover:bg-emerald-500/10 flex items-center justify-center gap-1.5">
                    <ClipboardEdit className="w-3.5 h-3.5" /> Enter Score
                  </button>
                  <button
                    onClick={() => openReschedule(selectedMatch)}
                    className="col-span-2 py-2 rounded-lg border border-slate-600 text-slate-300 font-bold text-[10px] uppercase tracking-wider transition hover:border-blue-400 hover:text-blue-300 flex items-center justify-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Reschedule
                  </button>
                </>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>

        {rescheduleFor && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <CalendarDays className="w-10 h-10 text-blue-400 mx-auto" />
                <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Reschedule</h2>
                <p className="text-xs text-muted-foreground">
                  {rescheduleFor.match_code} · {rescheduleFor.team1_label ?? "TBD"} vs {rescheduleFor.team2_label ?? "TBD"}
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reschedule-at" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Date &amp; time
                </label>
                <input
                  id="reschedule-at"
                  type="datetime-local"
                  value={rescheduleAt}
                  onChange={(e) => setRescheduleAt(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-blue-400 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reschedule-court" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Court <span className="normal-case tracking-normal font-bold text-slate-500">(leave blank to unassign)</span>
                </label>
                <input
                  id="reschedule-court"
                  list="umpire-court-options"
                  value={rescheduleCourt}
                  onChange={(e) => setRescheduleCourt(e.target.value)}
                  placeholder="e.g. C3"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-blue-400 transition"
                />
                <datalist id="umpire-court-options">
                  {[...new Set(allMatches.map((m) => m.court_number).filter(Boolean) as string[])]
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                    .map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Players are reminded again for the new slot.
              </p>

              <button
                disabled={savingReschedule}
                onClick={saveReschedule}
                className="w-full py-3 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-black text-sm uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2">
                {savingReschedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                {savingReschedule ? "Saving..." : "Save New Slot"}
              </button>

              <button
                disabled={savingReschedule}
                onClick={() => setRescheduleFor(null)}
                className="w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {walkoverFor && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <Flag className="w-10 h-10 text-[var(--warning)] mx-auto" />
                <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Record Walkover</h2>
                <p className="text-xs text-muted-foreground">Who turned up? The team you pick advances.</p>
              </div>

              {([1, 2] as const).map((side) => (
                <button key={side}
                  disabled={savingWalkover}
                  onClick={() => recordWalkover(walkoverFor, side)}
                  className="w-full py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-[var(--warning)] text-foreground font-bold text-sm transition disabled:opacity-50 text-left">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team {side} advances</span>
                  {(side === 1 ? walkoverFor.team1_label : walkoverFor.team2_label) ?? `Team ${side}`}
                </button>
              ))}

              <button
                disabled={savingWalkover}
                onClick={() => recordWalkover(walkoverFor, 0)}
                className="w-full py-3 px-4 rounded-xl bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] border border-[var(--danger)]/50 text-[var(--danger)] font-bold text-sm transition disabled:opacity-50">
                Neither turned up (double walkover)
              </button>

              <button
                disabled={savingWalkover}
                onClick={() => setWalkoverFor(null)}
                className="w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {directScoreFor && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <ClipboardEdit className="w-10 h-10 text-emerald-400 mx-auto" />
                <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Submit Score</h2>
                <p className="text-xs text-muted-foreground">
                  {directScoreFor.match_code} · {directScoreFor.team1_label ?? "TBD"} vs {directScoreFor.team2_label ?? "TBD"}
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                  <span className="truncate">{directScoreFor.team1_label ?? "Team 1"}</span>
                  <span />
                  <span className="truncate text-right">{directScoreFor.team2_label ?? "Team 2"}</span>
                </div>

                {directSets.map((set, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <input
                      type="number"
                      min={0}
                      value={set.t1}
                      onChange={(e) => {
                        const next = [...directSets];
                        next[i] = { ...next[i], t1: e.target.value };
                        setDirectSets(next);
                      }}
                      placeholder="0"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-sm text-foreground font-bold outline-none focus:border-emerald-400 transition"
                    />
                    <span className="text-[10px] font-black text-muted-foreground">Set {i + 1}</span>
                    <input
                      type="number"
                      min={0}
                      value={set.t2}
                      onChange={(e) => {
                        const next = [...directSets];
                        next[i] = { ...next[i], t2: e.target.value };
                        setDirectSets(next);
                      }}
                      placeholder="0"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-sm text-foreground font-bold outline-none focus:border-emerald-400 transition"
                    />
                  </div>
                ))}
              </div>

              {(() => {
                const filled = directSets.filter(s => s.t1.trim() !== "" && s.t2.trim() !== "");
                const parsed = filled.map(s => ({ t1: parseInt(s.t1, 10), t2: parseInt(s.t2, 10) }));
                const valid = parsed.filter(s => !isNaN(s.t1) && !isNaN(s.t2) && s.t1 !== s.t2);
                const t1Wins = valid.filter(s => s.t1 > s.t2).length;
                const t2Wins = valid.filter(s => s.t2 > s.t1).length;
                const winner = t1Wins > t2Wins ? directScoreFor.team1_label : t2Wins > t1Wins ? directScoreFor.team2_label : null;
                if (!winner || valid.length < 2) return null;
                return (
                  <div className="text-center text-xs text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-900/50 rounded-xl py-2">
                    Winner: {winner} ({t1Wins}-{t2Wins} sets)
                  </div>
                );
              })()}

              <button
                disabled={savingDirectScore}
                onClick={submitDirectScore}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingDirectScore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardEdit className="w-4 h-4" />}
                {savingDirectScore ? "Submitting..." : "Submit Score"}
              </button>

              <button
                disabled={savingDirectScore}
                onClick={() => setDirectScoreFor(null)}
                className="w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Team Tie Lineup & Reveal Console Modal */}
        {activeTieForConsole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
              <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Match Official Desk · Tie Arbiter</span>
                <button
                  type="button"
                  onClick={() => setActiveTieForConsole(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <TieUmpireConsole
                  tie={activeTieForConsole.tie}
                  tournament={activeTieForConsole.tournament}
                  onClose={() => setActiveTieForConsole(null)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
