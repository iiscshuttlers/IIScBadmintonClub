import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Swords, MapPin, Clock, Settings2, ChevronRight,
  ChevronLeft, ChevronDown, Trophy, Users, Play, CalendarDays, Bell, Flag, Eye, X, ClipboardEdit, Megaphone, Trash2, CheckCircle2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getCourtColor, cn } from "@/lib/utils";
import { toLocalDateTimeInput, localDateTimeInputToIso } from "@/lib/umpire/schedule";
import { TieUmpireConsole } from "./TieUmpireConsole";
import {
  submitTournamentMatch,
  adminUpdateTournamentMatch,
  recordTournamentWalkover as recordTournamentWalkoverService,
  notifyTournamentMatch,
  deleteTournamentMatch,
  deleteTournamentMatches,
  invokeCallToCourt,
  fetchRoundRulesForTournaments,
  fetchTournamentRowOrNull,
  fetchUmpireDoneMatches,
  fetchUmpireOpenMatches,
  fetchUmpirePickerTournaments,
  subscribeToUmpireTournamentMatches,
} from "@/services/tournamentService";
import { teamService } from "@/services/teamService";

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
  reminder_sent?: boolean | null;
  winner_side?: number | null;
  score?: string | null;
  umpired_by?: string | null;
  result_revision?: number;
  result_operation_id?: string | null;
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
  MS: { bg: "bg-cat-ms/10 border-cat-ms/40 text-cat-ms", active: "bg-cat-ms text-on-accent border-cat-ms", dot: "bg-cat-ms" },
  WS: { bg: "bg-cat-ws/10 border-cat-ws/40 text-cat-ws", active: "bg-cat-ws text-on-accent border-cat-ws", dot: "bg-cat-ws" },
  MD: { bg: "bg-cat-md/10 border-cat-md/40 text-cat-md", active: "bg-cat-md text-on-accent border-cat-md", dot: "bg-cat-md" },
  WD: { bg: "bg-cat-wd/10 border-cat-wd/40 text-cat-wd", active: "bg-cat-wd text-on-accent border-cat-wd", dot: "bg-cat-wd" },
  XD: { bg: "bg-cat-xd/10 border-cat-xd/40 text-cat-xd", active: "bg-cat-xd text-on-accent border-cat-xd", dot: "bg-cat-xd" },
};

const DEFAULT_COLORS = { bg: "bg-muted-strong border-border-strong text-soft", active: "bg-faint text-foreground border-border-strong", dot: "bg-muted-foreground" };

const CAT_BOX_COLORS_DARK: Record<string, string> = {
  MS: "bg-cat-ms/10 border-cat-ms/25 hover:border-cat-ms/50 hover:shadow-cat-ms/20",
  WS: "bg-cat-ws/10 border-cat-ws/25 hover:border-cat-ws/50 hover:shadow-cat-ws/20",
  MD: "bg-cat-md/10 border-cat-md/20 hover:border-cat-md/50 hover:shadow-cat-md/20",
  WD: "bg-cat-wd/10 border-cat-wd/25 hover:border-cat-wd/50 hover:shadow-cat-wd/20",
  XD: "bg-cat-xd/10 border-cat-xd/25 hover:border-cat-xd/50 hover:shadow-cat-xd/20",
  BS: "bg-team/10 border-team/25 hover:border-team/50 hover:shadow-team/20",
  GS: "bg-danger/10 border-danger/25 hover:border-danger/50 hover:shadow-danger/20",
  BD: "bg-accent/10 border-accent/25 hover:border-accent/50 hover:shadow-accent/20",
  GD: "bg-individual/10 border-individual/25 hover:border-individual/50 hover:shadow-individual/20",
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
  const [rescheduleReason, setRescheduleReason] = useState("");
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
    try { localStorage.setItem("umpire_selected_tournament", id); } catch { /* intentional — localStorage unavailable in private mode or quota exceeded */ }
  };
  const [directScoreFor, setDirectScoreFor] = useState<TournamentMatchForUmpire | null>(null);
  const [directSets, setDirectSets] = useState<{ t1: string; t2: string }[]>([{ t1: "", t2: "" }, { t1: "", t2: "" }]);
  const [savingDirectScore, setSavingDirectScore] = useState(false);

  const { session, profile } = useAuth();
  const isAdmin = profile?.role === 'master_admin' || profile?.role === 'admin';
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);

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
      await submitTournamentMatch({
        p_match_id: directScoreFor.id,
        p_winner_side: winnerSide,
        p_score: scoreStr,
        p_sets: setsArr,
        p_umpire_id: session.user.id,
        p_expected_revision: directScoreFor.result_revision ?? 0,
      });

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
    setRescheduleReason("");
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
    if (!rescheduleReason.trim()) {
      toast.error("Add a reason for the schedule change");
      return;
    }
    setSavingReschedule(true);
    try {
      await adminUpdateTournamentMatch(rescheduleFor.id, {
        scheduled_at: iso,
        court_number: rescheduleCourt.trim() || null,
        status: "scheduled",
        reminder_sent: false,
      }, rescheduleReason.trim());

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
   */
  const recordWalkover = async (m: TournamentMatchForUmpire, winnerSide: 0 | 1 | 2) => {
    setSavingWalkover(true);
    try {
      await recordTournamentWalkoverService({
        p_match_id: m.id,
        p_winner_side: winnerSide,
      });
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
      await notifyTournamentMatch(matchId, "manual");
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

  const deleteThirdPlaceMatch = async (m: TournamentMatchForUmpire) => {
    if (!confirm(`Remove 3rd place match ${m.match_code}? This cannot be undone.`)) return;
    setDeletingMatchId(m.id);
    try {
      await deleteTournamentMatch(m.id);
      setAllMatches(prev => prev.filter(x => x.id !== m.id));
      toast.success("3rd place match removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete match");
    } finally {
      setDeletingMatchId(null);
    }
  };

  // `silent` is used by the realtime/focus refresh so the list updates in place
  // without flashing the spinner or surfacing a toast for a transient blip.
  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    // Fetch all active tournaments for the picker
    const allTournaments = await fetchUmpirePickerTournaments(tournamentId);

    if (!allTournaments?.length) { setLoading(false); return; }

    setAvailableTournaments(allTournaments);

    // Auto-select first tournament if none selected
    const activeTId = selectedTournamentId && allTournaments.some(t => t.id === selectedTournamentId)
      ? selectedTournamentId
      : allTournaments[0].id;
    if (!selectedTournamentId) {
      setSelectedTournamentId(activeTId);
      try { localStorage.setItem("umpire_selected_tournament", activeTId); } catch { /* intentional — localStorage unavailable in private mode or quota exceeded */ }
    }

    const tournamentIds = [activeTId];

    const [{ data: activeMatchData, error }, { data: doneMatchData }] = await Promise.all([
      fetchUmpireOpenMatches(tournamentIds),
      fetchUmpireDoneMatches(tournamentIds),
    ]);
    const matchData = [...(activeMatchData ?? []), ...(doneMatchData ?? [])];

    if (error) { if (!silent) toast.error(error.message); setLoading(false); return; }

    const rules = await fetchRoundRulesForTournaments(tournamentIds);

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
      const tiesData = await teamService.getUmpirePendingTies(tournamentIds);

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
    const unsubscribe = subscribeToUmpireTournamentMatches(() => { load({ silent: true }); });

    const onFocus = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      unsubscribe();
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
    <div className="flex items-center justify-center gap-3 py-6 px-4 rounded-xl bg-background/40 border border-border/60 text-center sm:text-left">
      <Swords className="w-5 h-5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs font-bold text-soft">No tournament matches need umpiring right now.</p>
        <p className="text-[11px] text-muted-foreground">Matches appear here when scheduled or in-progress matches exist in the active tournament.</p>
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
        if (upcomingStatus === "upcoming") return m.status === "scheduled" || m.status === "pending";
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
                "flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-muted border border-border-strong text-left",
                availableTournaments.length > 1 && "hover:border-primary/50 cursor-pointer"
              )}
            >
              <Trophy className="w-4 h-4 text-gold shrink-0" />
              <span className="text-xs font-black text-foreground truncate flex-1">{currentTournament.name}</span>
              {availableTournaments.length > 1 && (
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", showTournamentPicker && "rotate-180")} />
              )}
            </button>
            {showTournamentPicker && availableTournaments.length > 1 && (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTournamentPicker(false)} />
              <div className="absolute z-50 mt-1 w-full bg-card border border-border-strong rounded-xl shadow-2xl overflow-hidden">
                {availableTournaments.map(t => (
                  <button
                    key={t.id}
                    onClick={() => switchTournament(t.id)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-xs font-bold transition hover:bg-muted flex items-center gap-2",
                      t.id === selectedTournamentId ? "text-primary bg-primary/10" : "text-soft"
                    )}
                  >
                    <Trophy className="w-3.5 h-3.5 text-gold shrink-0" />
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
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-warning/10 via-muted to-muted/80 border border-warning/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-black text-warning uppercase tracking-wider">
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
                    className="p-3 rounded-xl bg-card/90 border border-border-strong/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <span className="font-mono text-primary">{tie.tie_code}</span>
                        <span>{tie.team_a?.short_name || 'Team A'} vs {tie.team_b?.short_name || 'Team B'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          bothLocked ? 'bg-success/20 text-success border border-success/40' : 'bg-danger/20 text-danger border border-danger/40'
                        }`}>
                          {bothLocked ? 'Lineups Ready' : 'Lineups Incomplete'}
                        </span>
                        {bothLocked && !revealed && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-warning/20 text-warning border border-warning/40 animate-pulse">
                            Awaiting Reveal
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTieForConsole({ tie, tournament: tie.tournament })}
                      className="px-2.5 py-1.5 rounded-lg bg-warning/20 hover:bg-warning/30 text-warning border border-warning/30 font-bold text-xs flex items-center gap-1 transition"
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
              className="w-full bg-muted border border-border-strong text-xs text-on-accent rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
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
                        ? s === "live" ? "bg-warning text-warning-foreground border-warning" : "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/80 text-muted-foreground border-border-strong/60 hover:text-soft"
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
                      : "bg-muted/80 text-muted-foreground border-border-strong/60 hover:text-soft"
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
                      : "bg-muted/80 text-muted-foreground border-border-strong/60 hover:text-soft"
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
                        ? "bg-info text-info-foreground border-info"
                        : "bg-muted/80 text-muted-foreground border-border-strong/60 hover:text-soft"
                    )}
                  >
                    C{c}
                  </button>
                ))}
              </div>
            )}

            {/* Match count */}
            <div className="flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground">{upcomingScheduled.length} match{upcomingScheduled.length !== 1 ? "es" : ""}</span>
            </div>
            
            {upcomingScheduled.length === 0 ? (
              <div className="p-4 rounded-2xl border border-border-strong bg-muted/50 text-center text-muted-foreground text-sm">
                No scheduled matches match your filters.
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingScheduled.map((m) => {
                  const isBye = m.team1_label === "BYE" || m.team2_label === "BYE";
                  const noPlayers = !isBye && (!m.team1_label || !m.team2_label);
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
                        ? "bg-muted/30 border-border/40"
                        : noPlayers
                          ? "bg-muted/40 border-border/50 opacity-50 cursor-not-allowed"
                          : isLive
                            ? "bg-warning/10 border-warning/40 hover:border-warning cursor-pointer"
                            : "bg-muted/60 border-border-strong/60 hover:border-primary/50 cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Left: category + match code */}
                      <span className="text-[9px] font-black text-muted-foreground uppercase bg-background/50 px-1.5 py-0.5 rounded border border-border shrink-0">
                        {m.category} {m.match_code}
                      </span>

                      {isLive && (
                        <span className="text-[9px] font-black text-warning flex items-center gap-1 shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />LIVE
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[9px] font-black text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border-strong shrink-0">DONE</span>
                      )}

                      {/* Right: court + time + notify */}
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        {m.court_number && (
                          <span className={cn("text-[9px] font-bold", getCourtColor(m.court_number))}>C{m.court_number}</span>
                        )}
                        {m.scheduled_at && (
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {!noPlayers && !isDone && m.scheduled_at && (
                          <button
                            onClick={(e) => handleNotify(e, m.id)}
                            disabled={notifyingId === m.id}
                            className={cn("p-0.5 z-10", m.reminder_sent ? "text-success" : "text-primary")}
                            title={m.reminder_sent ? "Notified — tap to resend" : "Send Reminder"}
                          >
                            {notifyingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className={cn("w-3 h-3", m.reminder_sent && "fill-current")} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Players row */}
                    {(() => {
                      const t1Won = m.winner_side === 1 || m.team2_label === "BYE";
                      const t2Won = m.winner_side === 2 || m.team1_label === "BYE";
                      return (
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <span className={cn("font-bold text-xs truncate flex-1", t1Won ? "text-success" : t2Won ? "text-muted-foreground line-through decoration-soft" : "text-foreground")}>
                            {t1Won && <CheckCircle2 className="w-3 h-3 inline mr-0.5 -mt-0.5" />}{m.team1_label ?? "TBD"}
                          </span>
                          <span className="text-[9px] font-black text-danger shrink-0">vs</span>
                          <span className={cn("font-bold text-xs truncate flex-1 text-right", t2Won ? "text-success" : t1Won ? "text-muted-foreground line-through decoration-soft" : "text-foreground")}>
                            {m.team2_label ?? "TBD"}{t2Won && <CheckCircle2 className="w-3 h-3 inline ml-0.5 -mt-0.5" />}
                          </span>
                        </div>
                      );
                    })()}

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
          <Trophy className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-black text-foreground">Select Format</h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {categories.map((cat) => {
            const colors = CAT_COLORS[cat] ?? DEFAULT_COLORS;
            const catMatches = allMatches.filter((m) => m.category === cat);
            const upcoming = catMatches.filter((m) => m.status === "scheduled" || m.status === "pending").length;
            const inProgress = catMatches.filter((m) => m.status === "in_progress").length;
            const done = catMatches.filter((m) => m.status === "completed" || m.status === "walkover").length;

            return (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setStep("match"); }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-muted border border-border-strong hover:border-primary hover:bg-muted-strong transition-all group text-left"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${colors.active} shrink-0`}>
                  {cat}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground">{CAT_LABELS[cat] ?? cat}</p>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      if (catMatches.length > 0 && upcoming === 0 && inProgress === 0) {
                        return <span className="text-success font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 inline" /> All {done} matches completed</span>;
                      }
                      const parts: React.ReactNode[] = [];
                      if (upcoming > 0) parts.push(<span key="u">{upcoming} upcoming</span>);
                      if (inProgress > 0) parts.push(<span key="l" className="text-warning font-bold">{inProgress} live</span>);
                      if (done > 0) parts.push(<span key="d" className="text-muted-foreground">{done} done</span>);
                      if (parts.length === 0) return <span>No matches</span>;
                      return parts.reduce<React.ReactNode[]>((acc, part, i) => i === 0 ? [part] : [...acc, <span key={`s${i}`} className="mx-1 text-muted-foreground">·</span>, part], []);
                    })()}
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

    // Group by round, sorted descending (Final first, then SF, QF, etc.)
    const roundEntries = [...new Set(matchesForCategory.map((m) => m.round_name))].map(name => {
      const maxRound = Math.max(...matchesForCategory.filter(m => m.round_name === name).map(m => m.round ?? 0));
      const is3rd = name.toLowerCase().includes('3rd');
      return { name, maxRound, is3rd };
    });
    roundEntries.sort((a, b) => {
      // 3rd place goes right after Final (highest round)
      if (a.is3rd && !b.is3rd) return b.maxRound === Math.max(...roundEntries.map(r => r.maxRound)) ? 1 : -1;
      if (b.is3rd && !a.is3rd) return a.maxRound === Math.max(...roundEntries.map(r => r.maxRound)) ? -1 : 1;
      return b.maxRound - a.maxRound;
    });
    const rounds = roundEntries.map(r => r.name);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStep("format"); setSelectedCategory(null); }}
            className="p-2 rounded-xl bg-muted border border-border-strong hover:border-border-strong/90 transition text-muted-foreground hover:text-on-accent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className={`px-3 py-1.5 rounded-xl font-black text-sm border ${colors.active}`}>{selectedCategory}</div>
          <span className="text-muted-foreground text-sm">{CAT_LABELS[selectedCategory] ?? selectedCategory}</span>
          <button
            onClick={() => {
              const allCollapsed = rounds.every(r => collapsedRounds[r] ?? true);
              const next: Record<string, boolean> = {};
              rounds.forEach(r => { next[r] = !allCollapsed; });
              setCollapsedRounds(prev => ({ ...prev, ...next }));
            }}
            className="ml-auto p-1.5 rounded-lg bg-muted border border-border-strong hover:border-border-strong/90 transition text-muted-foreground hover:text-on-accent text-[10px] font-bold"
            title={rounds.every(r => collapsedRounds[r] ?? true) ? "Expand all" : "Collapse all"}
          >
            {rounds.every(r => collapsedRounds[r] ?? true) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
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
                    !isCollapsed ? "bg-muted/80 border border-border-strong hover:border-border-strong/90" : "bg-muted/40 border border-transparent hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-md transition-colors",
                      !isCollapsed ? "bg-primary/20 text-primary" : "bg-muted-strong text-muted-foreground group-hover:text-soft group-hover:bg-faint"
                    )}>
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <p className={cn(
                      "text-xs font-black uppercase tracking-widest transition-colors",
                      !isCollapsed ? "text-soft" : "text-muted-foreground group-hover:text-soft"
                    )}>{roundName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isCollapsed && <span className="text-[10px] font-bold text-muted-foreground bg-card border border-border-strong px-2 py-0.5 rounded-full">{roundMatches.length}</span>}
                    {isAdmin && roundName.toLowerCase().includes('3rd') && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm(`Remove all ${roundMatches.length} 3rd place match(es) for ${selectedCategory}?`)) return;
                          deleteTournamentMatches(roundMatches.map(m => m.id))
                            .then(() => {
                              setAllMatches(prev => prev.filter(m => !roundMatches.some(rm => rm.id === m.id)));
                              toast.success("3rd place match(es) removed");
                            })
                            .catch((err: any) => toast.error(err.message || "Failed to delete"));
                        }}
                        className="p-1 rounded-md bg-danger/20 border border-danger/30 text-danger hover:bg-danger/20 hover:text-danger/80 transition"
                        title="Remove 3rd place match"
                      >
                        <Trash2 className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </button>
                
                {!isCollapsed && (
                  <div className="space-y-2">
                    {roundMatches.map((m) => {
                      const isLive = m.status === "in_progress";
                      const isDoubles = m.category.includes('D') || m.category.includes('Doubles');
                      const isBye = m.team1_label === "BYE" || m.team2_label === "BYE";
                      const hasLabels = m.team1_label && m.team2_label && m.team1_label !== "TBD" && m.team2_label !== "TBD";
                      const noPlayers = !isBye && !hasLabels;

                      return (
                        <button
                          key={m.id}
                          disabled={noPlayers}
                          onClick={() => { setSelectedMatch(m); setStep("confirm"); }}
                          className={cn(
                            "relative w-full p-4 sm:p-5 rounded-2xl border text-left transition-all duration-300 group overflow-hidden shadow-sm",
                            isLive
                              ? "bg-gradient-to-br from-warning/15 to-card border-warning/50 hover:border-warning hover:shadow-warning/20 hover:-translate-y-1"
                              : noPlayers
                                ? "bg-muted/40 border-border/50 opacity-60 cursor-not-allowed"
                                : `${CAT_BOX_COLORS_DARK[m.category] || "bg-gradient-to-br from-muted to-card border-border-strong hover:border-primary/50 hover:shadow-primary/20"} hover:shadow-lg hover:-translate-y-1`
                          )}
                        >
                          {!noPlayers && !isLive && (
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          )}
                          {isLive && (
                            <div className="absolute inset-0 bg-gradient-to-r from-warning/0 via-warning/10 to-warning/0 opacity-50 group-hover:opacity-100 transition-opacity duration-500 animate-pulse pointer-events-none" />
                          )}

                          <div className="relative flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider bg-background/50 px-2 py-1 rounded-md border border-border">
                                  {m.match_code}
                                </span>
                                {isLive && (
                                  <span className="text-[10px] font-black text-warning flex items-center gap-1.5 bg-warning/20 px-2 py-1 rounded-md border border-warning/30">
                                    <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></div>LIVE
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isAdmin && m.match_code.includes("3RD") && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteThirdPlaceMatch(m); }}
                                    disabled={deletingMatchId === m.id}
                                    className="p-1 rounded-md bg-danger/20 border border-danger/30 text-danger hover:bg-danger/20 hover:text-danger/80 transition"
                                    title="Remove 3rd place match"
                                  >
                                    {deletingMatchId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  </button>
                                )}
                                {m.court_number && (
                                  <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-background/50 border border-border", getCourtColor(m.court_number))}>
                                    <MapPin className="w-3 h-3" /> C{m.court_number}
                                  </span>
                                )}
                                {m.scheduled_at && (
                                  <span className="flex items-center gap-1 text-[10px] font-medium text-soft px-2 py-1 rounded-md bg-background/50 border border-border">
                                    <Clock className="w-3 h-3 text-primary" />
                                    {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {(() => {
                              const w = m.winner_side;
                              const t1Won = w === 1 || m.team2_label === "BYE";
                              const t2Won = w === 2 || m.team1_label === "BYE";
                              return (
                                <>
                                  <div className="flex items-center justify-between gap-2 sm:gap-4 mt-1">
                                    <div className="flex-1 min-w-0">
                                      <span className={cn(
                                        "font-bold text-sm sm:text-base block truncate transition-colors",
                                        t1Won ? "text-success" : t2Won ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                                      )}>
                                        {t1Won && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                                        {m.team1_label ?? "TBD"}
                                      </span>
                                    </div>
                                    <div className="shrink-0 flex flex-col items-center justify-center px-2 sm:px-3">
                                      <div className={cn(
                                        "border text-[10px] font-black px-2 sm:px-3 py-1 rounded-full shadow-inner ring-1 ring-foreground/5",
                                        isLive ? "bg-warning/25 border-warning/80 text-warning" : "bg-background/80 border-border-strong/80 text-live"
                                      )}>
                                        VS
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0 text-right">
                                      <span className={cn(
                                        "font-bold text-sm sm:text-base block truncate transition-colors",
                                        t2Won ? "text-success" : t1Won ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                                      )}>
                                        {t2Won && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                                        {m.team2_label ?? "TBD"}
                                      </span>
                                    </div>
                                  </div>

                                  {isBye && (
                                    <p className="text-[11px] text-success/70 text-center mt-2 italic border-t border-border/50 pt-2">
                                      Advances automatically
                                    </p>
                                  )}
                                  {(t1Won || t2Won) && !isBye && m.score && (
                                    <p className="text-[11px] text-success/70 text-center mt-2 border-t border-border/50 pt-2">
                                      {m.score}
                                    </p>
                                  )}
                                  {noPlayers && (
                                    <p className="text-[11px] text-muted-foreground text-center mt-2 italic border-t border-border/50 pt-2">
                                      Waiting for previous round results
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="reschedule-reason" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Reason
                  </label>
                  <textarea
                    id="reschedule-reason"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="e.g. Court overrun moved this match to the next available slot"
                    className="w-full min-h-[72px] bg-muted border border-border-strong rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-info transition"
                  />
                </div>
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
            className="p-1.5 rounded-lg bg-muted border border-border-strong hover:border-border-strong/90 transition text-muted-foreground hover:text-on-accent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-muted-foreground text-xs">Match Details</span>
        </div>

        <div className="bg-muted rounded-xl border border-border-strong overflow-hidden">
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
              <span className="text-[9px] font-black text-danger bg-card px-2 py-0.5 rounded-full shrink-0">VS</span>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[9px] text-muted-foreground font-bold uppercase">Team 2</p>
                <p className="text-foreground font-black text-xs truncate">{selectedMatch.team2_label ?? "TBD"}</p>
              </div>
            </div>

            {/* Scoring config + court/time — single compact row */}
            <div className="bg-card rounded-lg px-2.5 py-1.5 flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
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
              <Play className="w-4 h-4 fill-foreground" />
              {selectedMatch.status === "in_progress" ? "Resume Match" : "Start Umpiring"}
            </button>

            {/* Call players to the court (push to both sides) */}
            {selectedMatch.status !== "in_progress" && (
              <button
                onClick={async () => {
                  try {
                    const data = await invokeCallToCourt({ match_id: selectedMatch.id });
                    toast.success(`Called ${(data as any)?.notified ?? 0} player(s) to court`);
                  } catch (error: any) {
                    let detail = "";
                    try {
                      detail = (await error?.context?.json?.())?.error ?? "";
                    } catch { /* ignore */ }
                    toast.error(detail || error?.message || "Couldn't call the players");
                  }
                }}
                className="w-full py-2 rounded-lg border border-success/40 bg-success/10 text-success font-bold text-[10px] uppercase tracking-wider transition hover:bg-success/20 flex items-center justify-center gap-1.5"
              >
                <Megaphone className="w-3.5 h-3.5" /> Call players to court
              </button>
            )}

            {/* Team Tie Lineup & Reveal Console */}
            {selectedMatch.tie_id && (
              <button
                onClick={async () => {
                  const tieData = await teamService.getTieWithTeamNames(selectedMatch.tie_id);
                  const tourData = await fetchTournamentRowOrNull(selectedMatch.tournament_id);
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
                className="py-2 rounded-lg border border-warning/50 text-warning font-bold text-[10px] uppercase tracking-wider transition hover:bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] flex items-center justify-center gap-1.5">
                <Flag className="w-3.5 h-3.5" /> Walkover
              </button>

              {selectedMatch.status !== "in_progress" ? (
                <>
                  <button
                    onClick={() => openDirectScore(selectedMatch)}
                    className="py-2 rounded-lg border border-success/40 text-success font-bold text-[10px] uppercase tracking-wider transition hover:bg-success/10 flex items-center justify-center gap-1.5">
                    <ClipboardEdit className="w-3.5 h-3.5" /> Enter Score
                  </button>
                  <button
                    onClick={() => openReschedule(selectedMatch)}
                    className="col-span-2 py-2 rounded-lg border border-border-strong text-soft font-bold text-[10px] uppercase tracking-wider transition hover:border-info hover:text-info flex items-center justify-center gap-1.5">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-media/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-border-strong rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <CalendarDays className="w-10 h-10 text-info mx-auto" />
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
                  className="w-full bg-muted border border-border-strong rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-info transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reschedule-court" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Court <span className="normal-case tracking-normal font-bold text-muted-foreground">(leave blank to unassign)</span>
                </label>
                <input
                  id="reschedule-court"
                  list="umpire-court-options"
                  value={rescheduleCourt}
                  onChange={(e) => setRescheduleCourt(e.target.value)}
                  placeholder="e.g. C3"
                  className="w-full bg-muted border border-border-strong rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-info transition"
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
                disabled={savingReschedule || !rescheduleReason.trim()}
                onClick={saveReschedule}
                className="w-full py-3 px-4 rounded-xl bg-info hover:bg-info/90 text-info-foreground font-black text-sm uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-media/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-border-strong rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <Flag className="w-10 h-10 text-warning mx-auto" />
                <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Record Walkover</h2>
                <p className="text-xs text-muted-foreground">Who turned up? The team you pick advances.</p>
              </div>

              {([1, 2] as const).map((side) => (
                <button key={side}
                  disabled={savingWalkover}
                  onClick={() => recordWalkover(walkoverFor, side)}
                  className="w-full py-3 px-4 rounded-xl bg-muted border border-border-strong hover:border-warning text-foreground font-bold text-sm transition disabled:opacity-50 text-left">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team {side} advances</span>
                  {(side === 1 ? walkoverFor.team1_label : walkoverFor.team2_label) ?? `Team ${side}`}
                </button>
              ))}

              <button
                disabled={savingWalkover}
                onClick={() => recordWalkover(walkoverFor, 0)}
                className="w-full py-3 px-4 rounded-xl bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] border border-danger/50 text-danger font-bold text-sm transition disabled:opacity-50">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-media/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-border-strong rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <ClipboardEdit className="w-10 h-10 text-success mx-auto" />
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
                      className="w-full bg-muted border border-border-strong rounded-xl px-3 py-2.5 text-center text-sm text-foreground font-bold outline-none focus:border-success transition"
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
                      className="w-full bg-muted border border-border-strong rounded-xl px-3 py-2.5 text-center text-sm text-foreground font-bold outline-none focus:border-success transition"
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
                  <div className="text-center text-xs text-success font-bold bg-success/10 border border-success/30 rounded-xl py-2">
                    Winner: {winner} ({t1Wins}-{t2Wins} sets)
                  </div>
                );
              })()}

              <button
                disabled={savingDirectScore}
                onClick={submitDirectScore}
                className="w-full py-3 px-4 rounded-xl bg-success hover:bg-success/90 text-success-foreground font-black text-sm uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-media/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border shadow-2xl overflow-hidden">
              <div className="flex justify-between items-center p-4 sm:p-5 border-b border-border shrink-0">
                <span className="text-xs font-black uppercase text-muted-foreground tracking-wider">Match Official Desk · Tie Arbiter</span>
                <button
                  type="button"
                  onClick={() => setActiveTieForConsole(null)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-soft hover:bg-muted transition"
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
