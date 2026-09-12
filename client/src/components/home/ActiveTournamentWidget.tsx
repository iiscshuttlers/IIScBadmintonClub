import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import {
  Calendar, CalendarRange, Trophy, Loader2, ChevronRight, Activity, Clock, Users, Flame, ChevronDown, ChevronUp, MapPin, ArrowRight, CheckCircle2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { PollsSection } from "@/components/feed/PollsSection";
import { BarChart2, Plus, Minus } from "lucide-react";

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
  round_name: string;
  match_code: string;
  court_number: string | null;
  team1_label: string;
  team2_label: string;
  status: string;
  scheduled_at: string | null;
  score: string | null;
  winner_id: string | null;
  player1_id: string | null;
}

export function ActiveTournamentWidget() {
  const { isAdmin } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [todayMatches, setTodayMatches] = useState<TodayMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTodayMatches, setShowTodayMatches] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [loadingToday, setLoadingToday] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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
      const { data } = await supabase
        .from("tournament_matches")
        .select("id, category, round_name, match_code, court_number, status, scheduled_at, score, winner_id, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label")
        .gte("scheduled_at", queryStart.toISOString())
        .lte("scheduled_at", queryEnd.toISOString());

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
            winner_id: m.winner_id,
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

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto mt-2 sm:mt-0">
            <Link href={`/pulse?tab=events`}>
              <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95 shrink-0 border border-emerald-500/50">
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

      {/* Today's Matches & Polls */}
      <div className={`px-3 sm:px-5 pb-4 grid grid-cols-2 gap-2 sm:gap-3 ${liveMatches.length === 0 ? "pt-4" : ""}`}>
        <button
          onClick={handleToggleTodayMatches}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 border ${
            showTodayMatches
              ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30"
              : "bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/60 border-indigo-900/50 hover:border-indigo-700/50"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Today's Matches</span>
          {showTodayMatches ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </button>

        <button
          onClick={handleTogglePolls}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 border ${
            showPolls
              ? "bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-600/30"
              : "bg-violet-950/40 text-violet-300 hover:bg-violet-900/60 border-violet-900/50 hover:border-violet-700/50"
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
            <div className="border-t border-slate-200/50 dark:border-slate-800 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  {selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                </h4>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => adjustDate(-1)} className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <input 
                    type="date" 
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={toLocalISOString(selectedDate)}
                    onChange={handleDateChange}
                  />
                  <button onClick={() => adjustDate(1)} className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors">
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
                  <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-500">No matches scheduled for this date</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayMatches.map((m) => {
                    const isCompleted = m.status === "completed" || m.status === "walkover";
                    const isT1Winner = isCompleted && !!m.winner_id && m.winner_id === m.player1_id;
                    const isT2Winner = isCompleted && !!m.winner_id && m.winner_id !== m.player1_id;
                    
                    const getCategoryColorClass = (cat: string) => {
                      const c = cat?.substring(0, 2).toUpperCase() || "";
                      if (c === "MS") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50";
                      if (c === "WS") return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border-pink-200 dark:border-pink-800/50";
                      if (c === "MD") return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50";
                      if (c === "WD") return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50";
                      if (c === "XD") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50";
                      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
                    };
                    const isLive = m.status === "in_progress";
                    const tabStatus = isCompleted ? "completed" : isLive ? "live" : "upcoming";
                    const href = `/pulse?tab=matches&m_status=${tabStatus}&m_cat=ALL#match-card-${m.id}`;

                    return (
                      <Link
                        key={m.id}
                        href={href}
                        className={`flex flex-col gap-2 p-3 rounded-xl border transition-all cursor-pointer block ${
                          isCompleted
                            ? "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100 hover:border-indigo-300 dark:hover:border-indigo-700/50"
                            : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600/50"
                        }`}
                      >
                        {/* Top Row: Time | Format | Round | Status/Score */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-[10px] font-black text-slate-400 shrink-0">
                              {formatTime(m.scheduled_at) || "--:--"}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${getCategoryColorClass(m.category)}`}>
                              {m.category?.slice(0,2) || "TBD"}
                            </span>
                            {m.round_name && (
                              <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">
                                {m.round_name}
                              </span>
                            )}
                          </div>
                          
                          <div className="shrink-0 ml-2">
                            {isCompleted && m.score ? (
                              <div className="flex items-center gap-0.5 text-[11px] font-black tracking-wide bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                                {m.score.split(',').map((setScore, idx, arr) => {
                                  const parts = setScore.trim().split('-');
                                  if (parts.length === 2) {
                                    return (
                                      <span key={idx} className="flex items-center">
                                        <span className={isT1Winner ? "text-emerald-600 dark:text-emerald-400" : isT2Winner ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"}>{parts[0]}</span>
                                        <span className="text-slate-400 dark:text-slate-500 mx-0.5">-</span>
                                        <span className={isT2Winner ? "text-emerald-600 dark:text-emerald-400" : isT1Winner ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"}>{parts[1]}</span>
                                        {idx < arr.length - 1 && <span className="text-slate-400 dark:text-slate-500 mr-1.5">,</span>}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span key={idx} className="text-slate-600 dark:text-slate-300">
                                      {setScore}{idx < arr.length - 1 ? ',' : ''}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : m.status === "in_progress" ? (
                              <span className="text-[9px] font-black uppercase tracking-wider text-red-500 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-1.5 shadow-sm shadow-red-500/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                LIVE
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/30">
                                {m.match_code || "TBD"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Teams/Players */}
                        <div className="flex flex-col gap-1.5 mt-0.5">
                          <div className="flex items-start gap-2">
                            {isT1Winner ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : isCompleted ? (
                              <div className="w-3.5 h-3.5 shrink-0" />
                            ) : null}
                            <p className={`text-xs sm:text-sm font-bold leading-snug ${
                              isT1Winner ? "text-emerald-600 dark:text-emerald-400" : 
                              isCompleted ? "text-slate-500 dark:text-slate-400" : 
                              "text-slate-800 dark:text-slate-200"
                            }`}>
                              {m.team1_label}
                            </p>
                          </div>
                          
                          <div className="flex items-start gap-2">
                            {isT2Winner ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : isCompleted ? (
                              <div className="w-3.5 h-3.5 shrink-0" />
                            ) : null}
                            <p className={`text-xs sm:text-sm font-bold leading-snug ${
                              isT2Winner ? "text-emerald-600 dark:text-emerald-400" : 
                              isCompleted ? "text-slate-500 dark:text-slate-400" : 
                              "text-slate-800 dark:text-slate-200"
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
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider"
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
            <div className="border-t border-slate-200/50 dark:border-slate-800 p-4 sm:p-5">
              <PollsSection />
              
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleTogglePolls}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider"
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
