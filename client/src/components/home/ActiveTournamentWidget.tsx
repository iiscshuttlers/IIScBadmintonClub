import { winningSide } from "@/lib/matchResult";
import { matchShortPath, tournamentPath } from "@/lib/tournamentRoutes";
import { useEffect, useState } from "react";
import { fetchActiveTournamentRows, fetchTournamentMatchesScheduledBetween } from "@/services/tournamentService";
import { Card } from "@/components/ui/card";
import { Calendar, Trophy, ChevronDown, ChevronUp, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { PollsSection } from "@/components/feed/PollsSection";
import { BarChart2, Plus, Minus } from "lucide-react";
import { useAnyTournamentLive } from "@/hooks/queries/useAnyTournamentLive";
import { HomeLiveStrip } from "@/components/home/HomeLiveStrip";

/**
 * Home "Happening now": the active tournament, live score tickers for every
 * tournament with a match on court (tournament_matches only), and the
 * day's matches and polls behind two collapsed toggles.
 */

interface Tournament {
  id: string;
  name: string;
  status: string;
  format_family?: string | null;
}

interface TodayMatch {
  id: string;
  category: string;
  round_name: string;
  match_code: string;
  court_number: string | null;
  team1_label: string;
  team2_label: string;
  status: string;
  scheduled_at: string | null;
  score: string | null;
  winner_side: 1 | 2 | null;
  player1_id: string | null;
}

export function ActiveTournamentWidget() {
  const { isAdmin } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const { tournamentIds: liveTournamentIds } = useAnyTournamentLive();
  const [todayMatches, setTodayMatches] = useState<TodayMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTodayMatches, setShowTodayMatches] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [loadingToday, setLoadingToday] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;
    fetchActiveTournamentRows()
      .then((tourneys) => { if (!cancelled) setTournament(tourneys?.[0] ?? null); })
      .catch((err) => console.error("Error fetching active tournament:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function fetchTodayMatches(dateToFetch: Date = selectedDate) {
    setLoadingToday(true);
    try {
      // Pad the search window by 24 hours on each side to avoid timezone cutoff issues when querying Supabase.
      const queryStart = new Date(dateToFetch);
      queryStart.setDate(queryStart.getDate() - 1);
      queryStart.setHours(0, 0, 0, 0);

      const queryEnd = new Date(dateToFetch);
      queryEnd.setDate(queryEnd.getDate() + 1);
      queryEnd.setHours(23, 59, 59, 999);

      // tournament_matches is the correct table for scheduled tournament matches
      const data = await fetchTournamentMatchesScheduledBetween(queryStart.toISOString(), queryEnd.toISOString());

      if (data) {
        const targetDateStr = toLocalISOString(dateToFetch);
        
        const mapped: TodayMatch[] = (data as any[])
          .filter(m => m.scheduled_at && toLocalISOString(new Date(m.scheduled_at)) === targetDateStr)
          .filter(m => m.status !== "draft" || isAdmin)
          .map((m) => ({
            id: m.id,
            category: m.category || "",
            round_name: m.round_name || "",
            match_code: m.match_code || "",
            court_number: m.court_number || null,
            team1_label: m.team1_label || "TBD",
            team2_label: m.team2_label || "TBD",
            status: m.status,
            scheduled_at: m.scheduled_at,
            score: m.score || null,
            winner_side: winningSide(m),
            player1_id: m.player1_id,
          }));

        // 1. Live matches
        const live = mapped.filter(m => m.status === "in_progress");
        
        // 2. Scheduled/Draft matches (Chronological)
        const scheduled = mapped
          .filter(m => m.status === "scheduled" || m.status === "draft")
          .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

        // 3. Completed matches (Reverse Chronological)
        const completed = mapped
          .filter(m => m.status === "completed" || m.status === "walkover")
          .sort((a, b) => new Date(b.scheduled_at!).getTime() - new Date(a.scheduled_at!).getTime());

        setTodayMatches([...live, ...scheduled, ...completed]);
      }
    } catch (err) {
      console.error("Error fetching today's matches:", err);
    } finally {
      setLoadingToday(false);
    }
  }

  const handleToggleTodayMatches = () => {
    if (!showTodayMatches) fetchTodayMatches(selectedDate);
    setShowTodayMatches(prev => !prev);
    setShowPolls(false);
  };

  const handleTogglePolls = () => {
    setShowPolls(prev => !prev);
    setShowTodayMatches(false);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [year, month, day] = e.target.value.split('-').map(Number);
      const newDate = new Date(year, month - 1, day);
      setSelectedDate(newDate);
      if (showTodayMatches) {
        fetchTodayMatches(newDate);
      }
    }
  };

  const adjustDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
    if (showTodayMatches) {
      fetchTodayMatches(newDate);
    }
  };

  const toLocalISOString = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const formatTime = (dt: string | null) => {
    if (!dt) return "";
    return new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return null;

  if (!tournament && liveTournamentIds.length === 0) return null;

  return (
    <Card className="border-0 bg-[color-mix(in_srgb,var(--success)_10%,var(--card))] backdrop-blur-md shadow-lg overflow-hidden mb-3 mt-1 ring-1 ring-success/40">

      {/* Tournament header */}
      {tournament && (
        <div className="border-b border-success/20 px-4 py-2 sm:p-5 flex flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-success/20 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4 text-success" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-success">Happening now</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-foreground leading-tight">
                {tournament.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {tournament.id && tournament.format_family !== "TEAM" && (
              <Link href={`/predict/${tournament.id}`}>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border border-success/50 text-success hover:bg-success/10 cursor-pointer">
                  Predict
                </span>
              </Link>
            )}
            <Link
              href={tournamentPath(tournament.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-success hover:bg-success/90 text-success-foreground rounded-lg text-xs font-bold shadow-md shadow-success/20 hover:shadow-lg hover:shadow-success/30 transition-all active:scale-95 shrink-0 border border-success/50"
            >
              View
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      )}

      {/* Live now: one score ticker per tournament with a match on court */}
      {liveTournamentIds.length > 0 && (
        <div className="px-4 sm:px-5 pb-1">
          <HomeLiveStrip />
        </div>
      )}

      {/* Today's Matches & Polls */}
      <div className={`px-3 sm:px-5 pb-2.5 sm:pb-4 grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-4`}>
        <button
          onClick={handleToggleTodayMatches}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 border ${
            showTodayMatches
              ? "bg-info text-info-foreground border-info shadow-lg shadow-info/30"
              : "bg-info/15 text-info hover:bg-info/25 border-info/30 hover:border-info/50"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Today's Matches</span>
          {showTodayMatches ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        <button
          onClick={handleTogglePolls}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 border ${
            showPolls
              ? "bg-individual text-individual-foreground border-individual shadow-lg shadow-individual/30"
              : "bg-individual/15 text-individual hover:bg-individual/25 border-individual/30 hover:border-individual/50"
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5 shrink-0" />
          <span>Polls</span>
          {showPolls ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>
      </div>

      <AnimatePresence>
        {showTodayMatches && (
          <motion.div
            key="today"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-info" />
                  {selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                </h4>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => adjustDate(-1)} className="p-1 rounded-lg bg-muted hover:bg-muted-strong text-soft border border-border-strong transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <input 
                    type="date" 
                    className="bg-muted border border-border-strong text-soft rounded-lg px-2 py-1 text-sm font-semibold focus:ring-2 focus:ring-info outline-none"
                    value={toLocalISOString(selectedDate)}
                    onChange={handleDateChange}
                  />
                  <button onClick={() => adjustDate(1)} className="p-1 rounded-lg bg-muted hover:bg-muted-strong text-soft border border-border-strong transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {loadingToday ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : todayMatches.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-bold text-muted-foreground">No matches scheduled for this date</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayMatches.map((m) => {
                    const isCompleted = m.status === "completed" || m.status === "walkover";
                    const isT1Winner = isCompleted && m.winner_side === 1;
                    const isT2Winner = isCompleted && m.winner_side === 2;
                    
                    const getCategoryColorClass = (cat: string) => {
                      const c = cat?.substring(0, 2).toUpperCase() || "";
                      if (c === "MS") return "bg-cat-ms/10 text-cat-ms border-cat-ms/30";
                      if (c === "WS") return "bg-cat-ws/10 text-cat-ws border-cat-ws/30";
                      if (c === "MD") return "bg-cat-md/10 text-cat-md border-cat-md/30";
                      if (c === "WD") return "bg-cat-wd/10 text-cat-wd border-cat-wd/30";
                      if (c === "XD") return "bg-cat-xd/10 text-cat-xd border-cat-xd/30";
                      return "bg-muted text-soft border-border-strong";
                    };
                    const isLive = m.status === "in_progress";
                    const tabStatus = isCompleted ? "completed" : isLive ? "live" : "upcoming";
                    // The day's match query spans tournaments, so resolve the owner server-side.
                    const href = matchShortPath(m.id);

                    return (
                      <Link
                        key={m.id}
                        href={href}
                        className={`flex flex-col gap-2 p-3 rounded-xl border transition-all cursor-pointer block ${
                          isCompleted
                            ? "bg-card/40 border-border opacity-80 hover:opacity-100 hover:border-info/50"
                            : "bg-muted/60 border-border-strong shadow-sm hover:shadow-md hover:border-info/50"
                        }`}
                      >
                        {/* Top Row: Time | Format | Round | Status/Score */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-[10px] font-black text-muted-foreground shrink-0">
                              {formatTime(m.scheduled_at) || "--:--"}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${getCategoryColorClass(m.category)}`}>
                              {m.category?.slice(0,2) || "TBD"}
                            </span>
                            {m.round_name && (
                              <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[100px]">
                                {m.round_name}
                              </span>
                            )}
                          </div>
                          
                          <div className="shrink-0 ml-2">
                            {isCompleted && m.score ? (
                              <div className="flex items-center gap-0.5 text-[11px] font-black tracking-wide bg-muted px-2 py-1 rounded shadow-sm border border-border-strong/50">
                                {m.score.split(',').map((setScore, idx, arr) => {
                                  const parts = setScore.trim().split('-');
                                  if (parts.length === 2) {
                                    return (
                                      <span key={idx} className="flex items-center">
                                        <span className={isT1Winner ? "text-success" : isT2Winner ? "text-muted-foreground" : "text-soft"}>{parts[0]}</span>
                                        <span className="text-muted-foreground mx-0.5">-</span>
                                        <span className={isT2Winner ? "text-success" : isT1Winner ? "text-muted-foreground" : "text-soft"}>{parts[1]}</span>
                                        {idx < arr.length - 1 && <span className="text-muted-foreground mr-1.5">,</span>}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span key={idx} className="text-soft">
                                      {setScore}{idx < arr.length - 1 ? ',' : ''}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : m.status === "in_progress" ? (
                              <span className="text-[9px] font-black uppercase tracking-wider text-live px-2 py-0.5 bg-live/10 border border-live/20 rounded-full flex items-center gap-1.5 shadow-sm shadow-live/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span>
                                LIVE
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-info bg-info/10 px-1.5 py-0.5 rounded border border-info/20">
                                {m.match_code || "TBD"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Teams/Players */}
                        <div className="flex flex-col gap-1.5 mt-0.5">
                          <div className="flex items-start gap-2">
                            {isT1Winner ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                            ) : isCompleted ? (
                              <div className="w-3.5 h-3.5 shrink-0" />
                            ) : null}
                            <p className={`text-xs sm:text-sm font-bold leading-snug ${
                              isT1Winner ? "text-success" : 
                              isCompleted ? "text-muted-foreground" : 
                              "text-soft"
                            }`}>
                              {m.team1_label}
                            </p>
                          </div>
                          
                          <div className="flex items-start gap-2">
                            {isT2Winner ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                            ) : isCompleted ? (
                              <div className="w-3.5 h-3.5 shrink-0" />
                            ) : null}
                            <p className={`text-xs sm:text-sm font-bold leading-snug ${
                              isT2Winner ? "text-success" : 
                              isCompleted ? "text-muted-foreground" : 
                              "text-soft"
                            }`}>
                              {m.team2_label}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleToggleTodayMatches}
                  className="p-2 text-muted-foreground hover:text-soft hover:bg-muted rounded-full transition-colors flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider"
                >
                  <ChevronUp className="w-4 h-4" />
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPolls && (
          <motion.div
            key="polls"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4 sm:p-5">
              <PollsSection tournamentId={tournament?.id} />
              
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleTogglePolls}
                  className="p-2 text-muted-foreground hover:text-soft hover:bg-muted rounded-full transition-colors flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider"
                >
                  <ChevronUp className="w-4 h-4" />
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
