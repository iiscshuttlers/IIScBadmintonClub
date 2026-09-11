import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Trophy, ArrowRight, MapPin, Calendar, ChevronDown, ChevronUp, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

interface Tournament {
  id: string;
  name: string;
  status: string;
}

interface LiveMatch {
  id: string;
  category: string;
  team1_label: string;
  team2_label: string;
  t1_p1_name: string;
  t1_p2_name: string;
  t2_p1_name: string;
  t2_p2_name: string;
  court_number: string;
  match_code: string;
  round_name: string;
  t1_score: number;
  t2_score: number;
  sets_history: string[];
  server_team: number; // 1 or 2
  server_player_index: number; // 0 = p1, 1 = p2 (doubles)
  is_doubles: boolean;
}

interface TodayMatch {
  id: string;
  category: string;
  team1_label: string;
  team2_label: string;
  status: string;
  scheduled_at: string | null;
  score_team1?: number | null;
  score_team2?: number | null;
  winner_id?: string | null;
  player1_id?: string | null;
}

export function ActiveTournamentWidget() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [todayMatches, setTodayMatches] = useState<TodayMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTodayMatches, setShowTodayMatches] = useState(false);
  const [loadingToday, setLoadingToday] = useState(false);

  useEffect(() => {
    async function fetchActiveData(isInitial = false) {
      if (isInitial) setLoading(true);
      try {
        // Fetch active tournament
        const { data: tourneys } = await supabase
          .from("tournaments")
          .select("id, name, status")
          .eq("status", "active")
          .limit(1);

        if (tourneys && tourneys.length > 0) {
          setTournament(tourneys[0]);
        } else {
          setTournament(null);
        }

        // Fetch ALL live broadcasted matches from site_data
        const { data: siteData } = await supabase
          .from("site_data")
          .select("value")
          .eq("key", "live_matches")
          .maybeSingle();

        if (siteData?.value) {
          const liveState = siteData.value as Record<string, any>;
          const matchesList = Object.values(liveState)
            .filter((m: any) => m && m.status === "playing")
            .map((m: any) => {
              const isDoubles = !!(m.t1?.p2Name || m.t2?.p2Name);
              return {
                id: m.id,
                category: m.inferredCategory || m.category || "Singles",
                team1_label: m.t1?.p1Name + (m.t1?.p2Name ? ` & ${m.t1.p2Name}` : ""),
                team2_label: m.t2?.p1Name + (m.t2?.p2Name ? ` & ${m.t2.p2Name}` : ""),
                t1_p1_name: m.t1?.p1Name || "",
                t1_p2_name: m.t1?.p2Name || "",
                t2_p1_name: m.t2?.p1Name || "",
                t2_p2_name: m.t2?.p2Name || "",
                court_number: m.court || "",
                match_code: m.matchNumber || "",
                round_name: m.isFriendly ? "Friendly" : (m.matchNumber || ""),
                t1_score: m.t1?.score ?? 0,
                t2_score: m.t2?.score ?? 0,
                sets_history: m.setsHistory || [],
                server_team: m.serverTeam ?? 0,
                server_player_index: m.serverPlayerIndex ?? 0,
                is_doubles: isDoubles,
              };
            });
          setLiveMatches(matchesList);
        } else {
          setLiveMatches([]);
        }
      } catch (err) {
        console.error("Error fetching active tournament data:", err);
      } finally {
        if (isInitial) setLoading(false);
      }
    }

    fetchActiveData(true);

    const channel = supabase.channel('live_matches_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_data', filter: "key=eq.live_matches" }, () => {
        fetchActiveData(false);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchTodayMatches() {
    setLoadingToday(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from("matches")
        .select("id, category, player1:player1_id(full_name), player2:player2_id(full_name), partner1:team1_partner_id(full_name), partner2:team2_partner_id(full_name), status, scheduled_at, score_team1, score_team2, winner_id, player1_id, team1_label, team2_label")
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString());

      if (data) {
        const mapped: TodayMatch[] = (data as any[]).map((m) => ({
          id: m.id,
          category: m.category || "",
          team1_label: m.team1_label || (m.player1?.full_name || "TBD") + (m.partner1?.full_name ? ` & ${m.partner1.full_name}` : ""),
          team2_label: m.team2_label || (m.player2?.full_name || "TBD") + (m.partner2?.full_name ? ` & ${m.partner2.full_name}` : ""),
          status: m.status,
          scheduled_at: m.scheduled_at,
          score_team1: m.score_team1,
          score_team2: m.score_team2,
          winner_id: m.winner_id,
          player1_id: m.player1_id,
        }));

        const upcoming = mapped
          .filter(m => m.status === "scheduled" || m.status === "in_progress")
          .sort((a, b) => {
            if (!a.scheduled_at && !b.scheduled_at) return 0;
            if (!a.scheduled_at) return 1;
            if (!b.scheduled_at) return -1;
            return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
          });

        const completed = mapped
          .filter(m => m.status === "completed" || m.status === "walkover")
          .sort((a, b) => {
            if (!a.scheduled_at && !b.scheduled_at) return 0;
            if (!a.scheduled_at) return 1;
            if (!b.scheduled_at) return -1;
            return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
          });

        setTodayMatches([...upcoming, ...completed]);
      }
    } catch (err) {
      console.error("Error fetching today's matches:", err);
    } finally {
      setLoadingToday(false);
    }
  }

  const handleToggleTodayMatches = () => {
    if (!showTodayMatches && todayMatches.length === 0) fetchTodayMatches();
    setShowTodayMatches(prev => !prev);
  };

  const formatTime = (dt: string | null) => {
    if (!dt) return "";
    return new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return null;

  if (!tournament && liveMatches.length === 0) return null;

  return (
    <Card className="border-0 bg-white dark:bg-slate-900/40 backdrop-blur-md shadow-lg overflow-hidden mb-4 mt-2 ring-1 ring-slate-200/50 dark:ring-slate-800/50">

      {/* Tournament header */}
      {tournament && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border-b border-emerald-500/20 dark:border-emerald-500/30 p-4 sm:p-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Active Tournament</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">
                {tournament.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleTodayMatches}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 border ${
                showTodayMatches
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-700 border-slate-700"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Today's Matches
              {showTodayMatches ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <Link href={`/pulse?tab=events`}>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0">
                View Tournament
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Live Broadcasts */}
      <AnimatePresence>
        {liveMatches.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-5">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Live Broadcasted Matches
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveMatches.map((m) => {
                const isT1Leading = m.t1_score > m.t2_score;
                const isT2Leading = m.t2_score > m.t1_score;
                return (
                  <div key={m.id} className="bg-slate-900 rounded-2xl p-4 border border-red-900/40 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500" />
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {m.category}{m.round_name ? ` · ${m.round_name}` : ""}
                      </span>
                      {m.court_number && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400">
                          <MapPin className="w-3 h-3" /> Court {m.court_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {/* Team 1 */}
                      <div className="flex-1 min-w-0">
                        {m.is_doubles ? (
                          <div className="space-y-0.5">
                            {/* T1 P1 */}
                            <div className="flex items-center gap-1.5">
                              {m.server_team === 1 && m.server_player_index === 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" title="Serving" />
                              )}
                              <p className={`text-xs font-black truncate leading-tight ${
                                m.server_team === 1 && m.server_player_index === 0 ? "text-green-400" :
                                isT1Leading ? "text-yellow-400" : "text-slate-200"
                              }`}>{m.t1_p1_name || "TBD"}</p>
                            </div>
                            {/* T1 P2 */}
                            {m.t1_p2_name && (
                              <div className="flex items-center gap-1.5">
                                {m.server_team === 1 && m.server_player_index === 1 && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" title="Serving" />
                                )}
                                <p className={`text-xs font-black truncate leading-tight ${
                                  m.server_team === 1 && m.server_player_index === 1 ? "text-green-400" :
                                  isT1Leading ? "text-yellow-400" : "text-slate-300"
                                }`}>{m.t1_p2_name}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {m.server_team === 1 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" title="Serving" />
                            )}
                            <p className={`text-sm font-black truncate ${
                              m.server_team === 1 ? "text-green-400" :
                              isT1Leading ? "text-yellow-400" : "text-slate-200"
                            }`}>{m.team1_label || "TBD"}</p>
                          </div>
                        )}
                      </div>
                      {/* Score */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-xl border border-slate-700 shrink-0">
                        <span className={`text-xl font-black tabular-nums ${isT1Leading ? "text-yellow-400" : "text-slate-100"}`}>{m.t1_score}</span>
                        <span className="text-slate-600 text-xs">-</span>
                        <span className={`text-xl font-black tabular-nums ${isT2Leading ? "text-yellow-400" : "text-slate-100"}`}>{m.t2_score}</span>
                      </div>
                      {/* Team 2 */}
                      <div className="flex-1 min-w-0 text-right">
                        {m.is_doubles ? (
                          <div className="space-y-0.5">
                            {/* T2 P1 */}
                            <div className="flex items-center justify-end gap-1.5">
                              <p className={`text-xs font-black truncate leading-tight ${
                                m.server_team === 2 && m.server_player_index === 0 ? "text-green-400" :
                                isT2Leading ? "text-yellow-400" : "text-slate-200"
                              }`}>{m.t2_p1_name || "TBD"}</p>
                              {m.server_team === 2 && m.server_player_index === 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" title="Serving" />
                              )}
                            </div>
                            {/* T2 P2 */}
                            {m.t2_p2_name && (
                              <div className="flex items-center justify-end gap-1.5">
                                <p className={`text-xs font-black truncate leading-tight ${
                                  m.server_team === 2 && m.server_player_index === 1 ? "text-green-400" :
                                  isT2Leading ? "text-yellow-400" : "text-slate-300"
                                }`}>{m.t2_p2_name}</p>
                                {m.server_team === 2 && m.server_player_index === 1 && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" title="Serving" />
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <p className={`text-sm font-black truncate ${
                              m.server_team === 2 ? "text-green-400" :
                              isT2Leading ? "text-yellow-400" : "text-slate-200"
                            }`}>{m.team2_label || "TBD"}</p>
                            {m.server_team === 2 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" title="Serving" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {m.sets_history.length > 0 && (
                      <p className="mt-1.5 text-center text-[10px] text-slate-500 font-semibold">{m.sets_history.join(", ")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's Matches */}
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
            <div className="border-t border-slate-200/50 dark:border-slate-800 p-4 sm:p-5">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Today — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </h4>

              {loadingToday ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : todayMatches.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-500">No matches scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayMatches.map((m) => {
                    const isCompleted = m.status === "completed" || m.status === "walkover";
                    const hasScore = m.score_team1 != null && m.score_team2 != null;
                    const isT1Winner = isCompleted && m.winner_id === m.player1_id;
                    const isT2Winner = isCompleted && !!m.winner_id && m.winner_id !== m.player1_id;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isCompleted
                            ? "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70"
                            : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 shadow-sm"
                        }`}
                      >
                        <div className="shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Clock className={`w-4 h-4 ${m.status === "in_progress" ? "text-red-500 animate-pulse" : "text-indigo-400"}`} />
                          )}
                        </div>
                        <div className="text-[10px] font-black text-slate-400 shrink-0 w-12 text-center">
                          {formatTime(m.scheduled_at)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isT1Winner ? "text-emerald-500" : "text-slate-700 dark:text-slate-200"}`}>{m.team1_label}</p>
                          <p className={`text-xs font-bold truncate mt-0.5 ${isT2Winner ? "text-emerald-500" : "text-slate-700 dark:text-slate-200"}`}>{m.team2_label}</p>
                        </div>
                        {isCompleted && hasScore ? (
                          <div className="shrink-0 flex flex-col items-center">
                            <span className={`text-sm font-black tabular-nums ${isT1Winner ? "text-emerald-500" : "text-slate-400"}`}>{m.score_team1}</span>
                            <span className={`text-sm font-black tabular-nums ${isT2Winner ? "text-emerald-500" : "text-slate-400"}`}>{m.score_team2}</span>
                          </div>
                        ) : m.status === "in_progress" ? (
                          <span className="text-[9px] font-black uppercase tracking-wider text-red-500 px-2 py-0.5 bg-red-500/10 rounded-full shrink-0">LIVE</span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400 shrink-0">{m.category?.slice(0, 2)?.toUpperCase() || ""}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
