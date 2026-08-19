import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Swords, MapPin, Clock, Settings2, ChevronRight,
  ChevronLeft, ChevronDown, Trophy, Users, Play, CalendarDays, Bell, Flag
} from "lucide-react";
import { toast } from "sonner";
import { getCourtColor, cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export interface TournamentMatchForUmpire {
  id: string;
  tournament_id: string;
  tournament_name: string;
  category: string;
  match_code: string;
  round_name: string;
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
}

interface Props {
  onStartMatch: (match: TournamentMatchForUmpire) => void;
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

export function UmpireTournamentTab({ onStartMatch }: Props) {
  const { isAdmin, profile } = useAuth();
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
  const [collapsedRounds, setCollapsedRounds] = useState<Record<string, boolean>>({});
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [walkoverFor, setWalkoverFor] = useState<TournamentMatchForUmpire | null>(null);
  const [savingWalkover, setSavingWalkover] = useState(false);

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
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("id, name")
      .eq("status", "active");

    if (!tournaments?.length) { setLoading(false); return; }

    const tournamentIds = tournaments.map((t) => t.id);

    const { data: matchData, error } = await supabase
      .from("tournament_matches")
      .select("*")
      .in("tournament_id", tournamentIds)
      .in("status", ["scheduled", "in_progress"])
      .order("round")
      .order("match_number");

    if (error) { if (!silent) toast.error(error.message); setLoading(false); return; }

    const { data: rules } = await supabase
      .from("tournament_round_rules")
      .select("*")
      .in("tournament_id", tournamentIds);

    const enriched: TournamentMatchForUmpire[] = (matchData ?? []).map((m: any) => {
      const tournament = tournaments.find((t) => t.id === m.tournament_id);
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

    setAllMatches(enriched);
    // Keep an open match-detail screen in step with the refreshed data, so a
    // renamed team updates in front of the umpire instead of going stale.
    setSelectedMatch((prev) => (prev ? enriched.find((m) => m.id === prev.id) ?? prev : prev));
    setLoading(false);
  }, []);

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
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <Swords className="w-12 h-12 text-muted-foreground" />
      <p className="text-muted-foreground font-bold">No tournament matches need umpiring right now.</p>
      <p className="text-muted-foreground text-sm">Matches appear here when an active tournament has scheduled or in-progress matches.</p>
    </div>
  );

  // ── Step 1: Format selection ─────────────────────────────────────────────────
  if (step === "format") {
    let upcomingScheduled = allMatches
      .filter((m) => m.status === "scheduled" && m.scheduled_at)
      .filter((m) => {
        const t1 = m.team1_label;
        const t2 = m.team2_label;
        const isBye = t1 === "BYE" || t2 === "BYE" || t1?.includes(" BYE ") || t2?.includes(" BYE ") || t1?.toUpperCase().includes("BYE") || t2?.toUpperCase().includes("BYE");
        return !isBye;
      })
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

    const dateCounts = upcomingScheduled.reduce((acc, m) => {
      const d = new Date(m.scheduled_at!).toLocaleDateString();
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const availableDates = Object.keys(dateCounts);
    const availableCourts = [...new Set(upcomingScheduled.filter(m => m.court_number).map(m => m.court_number!))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

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
    if (upcomingDate !== "ALL") {
      upcomingScheduled = upcomingScheduled.filter(m => new Date(m.scheduled_at!).toLocaleDateString() === upcomingDate);
    }
    if (upcomingCourt !== "ALL") {
      upcomingScheduled = upcomingScheduled.filter(m => m.court_number === upcomingCourt);
    }

    return (
      <div className="space-y-4">
        {allMatches.some((m) => m.status === "scheduled" && m.scheduled_at) && (
          <div className="mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-black text-foreground">Upcoming Scheduled Matches ({upcomingScheduled.length})</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input 
                  type="text" 
                  placeholder="Search player, match #..."
                  value={upcomingSearch}
                  onChange={e => setUpcomingSearch(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-sm text-on-accent rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary w-[160px]"
                />
                <select 
                  value={upcomingFormat}
                  onChange={e => setUpcomingFormat(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-sm text-on-accent rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="ALL">All Formats</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {availableDates.length > 0 && (
                  <select 
                    value={upcomingDate}
                    onChange={e => setUpcomingDate(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-sm text-on-accent rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="ALL">All Dates</option>
                    {availableDates.map(d => <option key={d} value={d}>{d} ({dateCounts[d]})</option>)}
                  </select>
                )}
                {availableCourts.length > 0 && (
                  <select 
                    value={upcomingCourt}
                    onChange={e => setUpcomingCourt(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-sm text-on-accent rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="ALL">All Courts</option>
                    {availableCourts.map(c => <option key={c} value={c}>Court {c}</option>)}
                  </select>
                )}
              </div>
            </div>
            
            {upcomingScheduled.length === 0 ? (
              <div className="p-4 rounded-2xl border border-slate-700 bg-slate-800/50 text-center text-muted-foreground text-sm">
                No scheduled matches match your filters.
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingScheduled.map((m) => {
                  const noPlayers = !m.team1_label || !m.team2_label;

                  return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (!noPlayers) { setSelectedMatch(m); setStep("confirm"); } }}
                    className={cn(
                      "relative w-full p-4 sm:p-5 rounded-2xl border text-left transition-all duration-300 group overflow-hidden shadow-sm",
                      noPlayers
                        ? "bg-slate-800/40 border-slate-800/50 opacity-60 cursor-not-allowed"
                        : `${CAT_BOX_COLORS_DARK[m.category] || "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-primary/50 hover:shadow-primary/20"} hover:shadow-lg hover:-translate-y-1 cursor-pointer`
                    )}
                  >
                    {!noPlayers && (
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    )}
                    
                    <div className="relative flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider bg-slate-950/50 px-2 py-1 rounded-md border border-slate-800">
                          {m.category} • {m.match_code}
                        </span>
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
                          {!noPlayers && m.scheduled_at && (
                            <button
                              onClick={(e) => handleNotify(e, m.id)}
                              disabled={notifyingId === m.id}
                              className="flex items-center justify-center bg-primary/10 hover:bg-primary/30 text-primary p-1.5 rounded-md border border-primary/20 transition-colors ml-1 z-10"
                              title="Send Reminder to Players"
                            >
                              {notifyingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                            </button>
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
                          <div className="bg-slate-950/80 border border-slate-700/80 text-[10px] font-black text-rose-400 px-2 sm:px-3 py-1 rounded-full shadow-inner ring-1 ring-white/5">
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
                      const noPlayers = !m.team1_label || !m.team2_label || m.team1_label === "TBD" || m.team2_label === "TBD";

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
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStep(selectedCategory ? "match" : "format"); setSelectedMatch(null); }}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition text-muted-foreground hover:text-on-accent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-muted-foreground text-sm">Match Details</span>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Category + round banner */}
          <div className={`px-5 py-3 flex items-center gap-3 ${colors.active}`}>
            <span className="font-black text-sm">{selectedMatch.category}</span>
            <span className="text-sm font-bold opacity-80">·</span>
            <span className="text-sm font-bold opacity-90">{selectedMatch.round_name}</span>
            <span className="ml-auto text-[10px] font-black opacity-70 tracking-wider">{selectedMatch.match_code}</span>
          </div>

          <div className="p-5 space-y-5">
            {/* Players */}
            <div className="space-y-3">
              {[
                { label: selectedMatch.team1_label, side: "Team 1" },
                { label: selectedMatch.team2_label, side: "Team 2" },
              ].map(({ label, side }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{side}</p>
                    <p className="text-foreground font-black text-sm">{label ?? "TBD"}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Scoring config */}
            <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Settings2 className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-primary">{selectedMatch.points_to_win}</span>
                <span>pts to win</span>
              </div>
              <div className="text-muted-foreground">·</div>
              <div className="text-[11px] text-muted-foreground">
                Best of <span className="font-bold text-foreground">{selectedMatch.best_of_sets}</span> sets
              </div>
              <div className="text-muted-foreground">·</div>
              <div className="text-[11px] text-muted-foreground">
                Golden point @ <span className="font-bold text-foreground">{selectedMatch.golden_point}</span>
              </div>
            </div>

            {/* Court / time */}
            {(selectedMatch.court_number || selectedMatch.scheduled_at) && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {selectedMatch.court_number && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-blue-300">Court {selectedMatch.court_number}</span>
                  </span>
                )}
                {selectedMatch.scheduled_at && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {new Date(selectedMatch.scheduled_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
              </div>
            )}

            {/* Tournament name */}
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {selectedMatch.tournament_name}
            </p>

            {/* Start button */}
            <button
              onClick={async () => {
                // If user is admin/umpire, allow by default? The prompt says "they should have the right to umpire those matches and also time bounded umpiring".
                // If they have admin/umpire role globally, we can let them bypass, or we force the assignment check. 
                // Let's check assignments anyway if they are not an admin.
                const sessionResponse = await supabase.auth.getSession();
                const userId = sessionResponse.data.session?.user?.id;
                
                if (!userId) {
                  toast.error("Session expired. Please sign in again.");
                  return;
                }

                const possibleUserIds = [userId, profile?.id].filter(Boolean) as string[];
                const { data: assignments } = await supabase
                  .from("umpire_assignments")
                  .select("*")
                  .in("user_id", possibleUserIds);
                
                if (isAdmin) {
                  onStartMatch(selectedMatch);
                  return;
                }

                const now = new Date();
                const isValid = assignments?.some(a => {
                  if (a.tournament_match_id === selectedMatch.id) return true;
                  if (a.start_time && a.end_time) {
                    const start = new Date(a.start_time);
                    const end = new Date(a.end_time);
                    return now >= start && now <= end;
                  }
                  return false;
                });

                if (!isValid) {
                  toast.error("You don't have an active umpire assignment for this match or time block.");
                  return;
                }

                onStartMatch(selectedMatch);
              }}
              className="w-full py-4 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-black text-base transition flex items-center justify-center gap-2 shadow-lg shadow-primary/50/30"
            >
              <Play className="w-5 h-5 fill-white" />
              {selectedMatch.status === "in_progress" ? "Resume Match" : "Start Umpiring"}
            </button>

            {/* A no-show is discovered at the court, so the umpire needs to be
                able to record it without finding an admin. Distinct from the
                Retire flow, which is for a match that has already started. */}
            <button
              onClick={() => setWalkoverFor(selectedMatch)}
              className="w-full py-2.5 rounded-xl border border-[var(--warning)]/50 text-[var(--warning)] font-bold text-xs uppercase tracking-wider transition hover:bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] flex items-center justify-center gap-2">
              <Flag className="w-4 h-4" /> Record Walkover
            </button>
          </div>
        </div>

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
      </div>
    );
  }

  return null;
}
