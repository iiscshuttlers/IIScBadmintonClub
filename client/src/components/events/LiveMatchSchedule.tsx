import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Calendar, ChevronDown, ChevronUp, MapPin, Clock, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MatchPredictionCard } from "@/components/feed/MatchPredictions";
import { getCourtColor, cn } from "@/lib/utils";

interface ScheduledMatch {
  id: string;
  category: string;
  match_code: string;
  round_name: string;
  team1_label: string | null;
  team2_label: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  winner_side: 1 | 2 | null;
  sets_history: string[] | null;
}

const CAT_COLORS: Record<string, string> = {
  "MS": "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  "MD": "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  "WS": "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  "WD": "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  "XD": "bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800",
  "Team": "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
};

const CAT_BOX_COLORS: Record<string, string> = {
  "MS": "border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20",
  "MD": "border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20",
  "WS": "border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20",
  "WD": "border-pink-200 dark:border-pink-900/50 bg-pink-50/30 dark:bg-pink-950/20",
  "XD": "border-fuchsia-200 dark:border-fuchsia-900/50 bg-fuchsia-50/30 dark:bg-fuchsia-950/20",
  "Team": "border-violet-200 dark:border-violet-900/50 bg-violet-50/30 dark:bg-violet-950/20",
};

export function LiveMatchSchedule({ tournamentId, playerName }: { tournamentId: string | null, playerName: string | null }) {
  const [schedMatches, setSchedMatches] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeDate, setActiveDate] = useState("ALL");

  const { profile, isAdmin } = useAuth();
  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});
  const [revealedMatchIds, setRevealedMatchIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!profile?.id) return;
    const loadPicks = async () => {
      const { data: myVotes } = await supabase
        .from("live_match_votes")
        .select("live_match_id, pick")
        .eq("user_id", profile.id);
      if (myVotes) {
        const p: Record<string, 1 | 2> = {};
        myVotes.forEach(v => { p[v.live_match_id] = v.pick as 1 | 2; });
        setPicks(p);
      }
      const { data: siteData } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "poll_revealed_matches")
        .single();
      if (siteData?.value) {
        setRevealedMatchIds(siteData.value as Record<string, boolean>);
      }
    };
    loadPicks();
  }, [profile?.id]);

  const handlePick = async (matchId: string, team: 1 | 2) => {
    if (!profile?.id) return;
    setPicks(prev => ({ ...prev, [matchId]: team }));
    await supabase.from("live_match_votes").upsert({
      live_match_id: matchId,
      user_id: profile.id,
      pick: team
    }, { onConflict: 'live_match_id,user_id' });
  };

  const handleToggleReveal = async (matchId: string) => {
    if (!isAdmin) return;
    const isRevealed = !!revealedMatchIds[matchId];
    const nextState = { ...revealedMatchIds, [matchId]: !isRevealed };
    setRevealedMatchIds(nextState);
    await supabase.from("site_data").upsert({ key: "poll_revealed_matches", value: nextState }, { onConflict: "key" });
  };

  useEffect(() => {
    if (!tournamentId) { setLoading(false); return; }
    supabase
      .from("tournament_matches")
      .select("id,category,match_code,round_name,team1_label,team2_label,court_number,scheduled_at,status,winner_side,sets_history")
      .eq("tournament_id", tournamentId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("round", { ascending: false })
      .order("match_number", { ascending: false })
      .then(({ data }) => {
        setSchedMatches((data as ScheduledMatch[]) ?? []);
        setLoading(false);
      });
  }, [tournamentId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 animate-spin border-4 border-primary border-t-transparent rounded-full" /></div>;

  const categories = ["ALL", ...new Set(schedMatches.map((m) => m.category))];
  
  const formatDateForPill = (dateStr: string | null) => 
    dateStr ? new Date(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Unscheduled";
    
  const dates = ["ALL", ...new Set(schedMatches.map((m) => formatDateForPill(m.scheduled_at)))];

  const filtered = schedMatches.filter((m) => {
    const catMatch = activeCategory === "ALL" || m.category === activeCategory;
    const dateMatch = activeDate === "ALL" || formatDateForPill(m.scheduled_at) === activeDate;
    return catMatch && dateMatch;
  });

  if (!schedMatches.length) return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <Calendar className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-4" />
      <h3 className="text-xl font-black text-muted-foreground dark:text-slate-200 mb-2">Schedule Not Yet Available</h3>
      <p className="text-muted-foreground max-w-md">Match schedule will appear here once the admin assigns court times to bracket matches.</p>
    </div>
  );

  const renderMatchList = (matches: ScheduledMatch[]) => {
    const grouped: Record<string, Record<string, ScheduledMatch[]>> = {};
    for (const m of matches) {
      const key = m.scheduled_at
        ? new Date(m.scheduled_at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
        : "Unscheduled";
      if (!grouped[key]) grouped[key] = {};
      const catKey = m.category || "Other";
      if (!grouped[key][catKey]) grouped[key][catKey] = [];
      grouped[key][catKey].push(m);
    }

    return (
      <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
        {Object.entries(grouped).sort(([dateA], [dateB]) => {
          if (dateA === "Unscheduled") return 1;
          if (dateB === "Unscheduled") return -1;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        }).map(([date, categoriesGroup]) => {
          const isOpen = activeDate !== "ALL" && activeDate === date;
          const totalMatchesForDate = Object.values(categoriesGroup).reduce((acc, matches) => acc + matches.length, 0);
          return (
            <details key={date} open={isOpen} className="group mb-6 last:mb-0 relative">
              <summary className="flex items-center gap-3 mb-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none outline-none">
                <Calendar className="w-4 h-4 text-primary" />
                <h4 className="font-black text-muted-foreground dark:text-slate-200 text-sm flex-1">
                  {date} <span className="text-xs font-bold text-slate-400">({totalMatchesForDate})</span>
                </h4>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      const printContent = document.getElementById(`print-schedule-${date.replace(/\s+/g, '-')}`);
                      if (printContent) {
                        const originalContents = document.body.innerHTML;
                        document.body.innerHTML = printContent.innerHTML;
                        window.print();
                        document.body.innerHTML = originalContents;
                        window.location.reload();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-bold"
                  >
                    <Trophy className="w-3 h-3" />
                    Print
                  </button>
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                </div>
              </summary>
              <div className="space-y-6" id={`print-schedule-${date.replace(/\s+/g, '-')}`}>
                {/* Print Header (Only visible in print) */}
                <div className="hidden print:block mb-8 text-center border-b pb-4">
                  <h1 className="text-2xl font-black mb-1">IISc Badminton Club</h1>
                  <h2 className="text-xl text-slate-600">Match Schedule - {date}</h2>
                </div>

                {Object.entries(categoriesGroup).map(([cat, dayMatches]) => {
                  const catCls = CAT_COLORS[cat] ?? "bg-slate-50 dark:bg-slate-800 text-muted-foreground border-slate-200";
                  const boxCls = CAT_BOX_COLORS[cat] ?? "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900";
                  
                  return (
                    <div key={cat} className="space-y-3">
                      <h5 className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg border w-max ${catCls}`}>
                        {cat} Matches
                      </h5>
                      {dayMatches.map((m, idx) => {
                        const isCompleted = m.status === "completed" || m.status === "walkover";
                        const isLive = m.status === "in_progress";
                        const checkMatch = (label: string | undefined | null, pName: string | null) => {
                          if (!label || !pName) return false;
                          const l = label.toLowerCase();
                          const p = pName.toLowerCase();
                          if (l.includes(p) || p.includes(l)) return true;
                          const parts = p.split(' ').filter(x => x.length > 2);
                          return parts.length > 0 && parts.some(part => l.includes(part));
                        };
                        const isMyMatch = checkMatch(m.team1_label, playerName) || checkMatch(m.team2_label, playerName);
                        
                        let customBoxCls = boxCls;
                        if (isLive) {
                          customBoxCls = cn(boxCls, "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 shadow-md shadow-red-500/10");
                        } else if (isMyMatch) {
                          customBoxCls = cn(boxCls, "ring-2 ring-primary border-primary shadow-lg shadow-primary/30 animate-pulse !bg-primary/5 dark:!bg-primary/10");
                        }

                        return (
                          <div key={m.id} className={cn("rounded-2xl border p-4 print:break-inside-avoid print:border-slate-300 print:shadow-none transition-all duration-300", customBoxCls)}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 w-5">#{idx + 1}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${catCls} print:bg-transparent print:border-slate-300`}>{m.category}</span>
                            <span className="text-[10px] text-muted-foreground font-bold">{m.round_name} · {m.match_code}</span>
                            {m.court_number && (
                              <span className={cn("flex items-center gap-1 text-[10px] font-bold", getCourtColor(m.court_number))}>
                                <MapPin className="w-3 h-3" /> Court {m.court_number}
                              </span>
                            )}
                            {m.scheduled_at && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            {isLive && <span className="text-[10px] font-black text-red-500 animate-pulse">● LIVE</span>}
                            {isCompleted && <span className="text-[10px] font-black text-primary">✓ Done</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold flex-1 ${m.winner_side === 1 ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-slate-200"}`}>
                              {m.team1_label ?? "TBD"}
                            </span>
                            <span className="text-[10px] font-black text-rose-400 shrink-0">VS</span>
                            <span className={`text-sm font-bold flex-1 text-right ${m.winner_side === 2 ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-slate-200"}`}>
                              {m.team2_label ?? "TBD"}
                            </span>
                          </div>
                          {isCompleted && m.sets_history?.length ? (
                            <p className="mt-1.5 text-xs font-mono text-muted-foreground">{m.sets_history.join(", ")}</p>
                          ) : null}

                          {/* Poll Card (Compact) */}
                          {m.match_code && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/50 print:hidden">
                              <MatchPredictionCard
                                compact
                                matchId={m.match_code}
                                t1Ids={[]}
                                t2Ids={[]}
                                t1Label={m.team1_label ?? "TBD"}
                                t2Label={m.team2_label ?? "TBD"}
                                hasStarted={isLive || isCompleted}
                                myPick={picks[m.match_code]}
                                profileId={profile?.id}
                                onPick={(team) => handlePick(m.match_code, team)}
                                isResultsRevealed={isLive || !!revealedMatchIds[m.match_code]}
                                isAdmin={isAdmin}
                                onToggleRevealResults={() => handleToggleReveal(m.match_code)}
                              />
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        {/* Date filter dropdown */}
        <div className="relative inline-block">
          <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          <select
            value={activeDate}
            onChange={(e) => setActiveDate(e.target.value)}
            className="pl-9 pr-10 py-1.5 rounded-xl text-sm font-black transition-all bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
          >
            {dates.map((date) => (
              <option key={date} value={date}>
                {date === "ALL" ? "All Dates" : date}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
        </div>
        
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-xl text-sm font-black transition-all border ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-muted-foreground hover:border-primary"
            }`}>
            {cat}
          </button>
        ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl p-1 sm:p-2">
          {renderMatchList(filtered)}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <Calendar className="w-10 h-10 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No matches found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try changing your filters.</p>
        </div>
      )}
    </div>
  );
}
