import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { ChevronLeft, Swords, Trophy, TrendingUp, Flame, Calendar, MapPin, User, Activity, Ruler, ChevronDown } from "lucide-react";
import { getEloTier } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard } from "@/components/feed/MatchCard";

export default function ComparePlayers() {
  const [match, rawParams] = useRoute("/compare/:p1/:p2");
  const params = rawParams as Record<string, string> | null;
  const p1 = params?.p1;
  const p2 = params?.p2;
  
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  
  const [player1, setPlayer1] = useState<any>(null);
  const [player2, setPlayer2] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({ title: "Player Comparison" });

  useEffect(() => {
    supabase.from("players").select("id, full_name").is("deleted_at", null).order("full_name").then(({ data }) => setAllPlayers(data || []));
  }, []);

  useEffect(() => {
    if (!p1 || !p2) return;
    
    async function load() {
      if (!p1 || !p2) return;
      setLoading(true);
      // Fetch players
      const [p1Res, p2Res] = await Promise.all([
        supabase.from("players").select("*").eq("id", p1).single(),
        supabase.from("players").select("*").eq("id", p2).single()
      ]);
      setPlayer1(p1Res.data);
      setPlayer2(p2Res.data);

      // Fetch head to head matches
      const { data: matchesData } = await supabase
        .from("matches")
        .select("*, player1:players!player1_id(*), player2:players!player2_id(*), partner1:players!team1_partner_id(*), partner2:players!team2_partner_id(*)")
        .eq("status", "confirmed")
        .or(`player1_id.eq.${p1},player2_id.eq.${p1},team1_partner_id.eq.${p1},team2_partner_id.eq.${p1}`)
        .order("created_at", { ascending: true });

      if (matchesData) {
        // Filter specifically for head to head (they are on opposing teams)
        const h2h = matchesData.filter(m => {
          const p1Team = m.player1_id === p1 || m.team1_partner_id === p1 ? 1 : (m.player2_id === p1 || m.team2_partner_id === p1 ? 2 : 0);
          const p2Team = m.player1_id === p2 || m.team1_partner_id === p2 ? 1 : (m.player2_id === p2 || m.team2_partner_id === p2 ? 2 : 0);
          return p1Team !== 0 && p2Team !== 0 && p1Team !== p2Team;
        });
        setMatches(h2h);
      }
      setLoading(false);
    }
    load();
  }, [p1, p2]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading rivalry data...</div>;
  }

  if (!player1 || !player2) {
    return <div className="p-8 text-center text-rose-500">Could not load players.</div>;
  }

  // Calculate stats
  let p1Wins = 0;
  let p2Wins = 0;
  
  const eloHistory = [];
  let currentP1Elo = 1200;
  let currentP2Elo = 1200;

  for (const m of matches) {
    const p1Team = m.player1_id === player1.id || m.team1_partner_id === player1.id ? 1 : 2;
    const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id ? 1 : 2;
    
    if (winnerTeam === p1Team) p1Wins++;
    else p2Wins++;

    // Track elo rating at this point in time (approximation based on history)
    currentP1Elo += (p1Team === 1 ? m.elo_change_p1 || 0 : m.elo_change_p2 || 0);
    currentP2Elo += (p1Team === 2 ? m.elo_change_p1 || 0 : m.elo_change_p2 || 0);

    eloHistory.push({
      date: new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      [player1.full_name]: currentP1Elo,
      [player2.full_name]: currentP2Elo
    });
  }

  // Calculate Matchup Streak
  let p1Streak = 0;
  let p2Streak = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const p1Team = m.player1_id === player1.id || m.team1_partner_id === player1.id ? 1 : 2;
    const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id ? 1 : 2;
    
    if (winnerTeam === p1Team) {
      if (p2Streak > 0) break;
      p1Streak++;
    } else {
      if (p1Streak > 0) break;
      p2Streak++;
    }
  }

  const totalMatches = matches.length;
  const p1WinRate = totalMatches > 0 ? Math.round((p1Wins / totalMatches) * 100) : 0;
  const p2WinRate = totalMatches > 0 ? Math.round((p2Wins / totalMatches) * 100) : 0;

  // Format breakdown
  const formatBreakdown = ["Singles", "Doubles", "Mixed Doubles"].map(fmt => {
    const fmtMatches = matches.filter(m => m.category === fmt);
    let fP1Wins = 0, fP2Wins = 0;
    for (const m of fmtMatches) {
      const p1Team = m.player1_id === player1.id || m.team1_partner_id === player1.id ? 1 : 2;
      const winnerTeam = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id ? 1 : 2;
      if (winnerTeam === p1Team) fP1Wins++; else fP2Wins++;
    }
    return { format: fmt, p1Wins: fP1Wins, p2Wins: fP2Wins, total: fmtMatches.length };
  }).filter(f => f.total > 0);

  // Single format labels: "Singles" → "S", "Doubles" → "D", "Mixed Doubles" → "XD"
  const fmtLabel = (f: string) => f === "Singles" ? "Singles" : f === "Doubles" ? "Doubles" : "Mixed";
  const fmtColor1 = "text-emerald-600 dark:text-emerald-400";
  const fmtColor2 = "text-blue-600 dark:text-blue-400";

  return (
    <div className="pb-24 max-w-4xl mx-auto px-4 mt-6">
      <Link href="/players">
        <button className="flex items-center text-slate-500 hover:text-slate-800 dark:hover:text-white mb-6 transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Directory
        </button>
      </Link>

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 border border-rose-200 dark:border-rose-900/50">
          <Swords className="w-4 h-4" /> Head to Head Rivalry
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-4">
          <span className="truncate max-w-[40%] text-right">{player1.full_name.split(" ")[0]}</span>
          <span className="text-slate-300 dark:text-slate-700 text-2xl font-mono italic">VS</span>
          <span className="truncate max-w-[40%] text-left">{player2.full_name.split(" ")[0]}</span>
        </h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-8 text-center relative z-10">
        <Card className="p-4 sm:p-6 bg-white dark:bg-slate-900 shadow-xl border-t-4 border-t-emerald-500 rounded-3xl overflow-hidden relative">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Wins</div>
          <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white">{p1Wins}</div>
        </Card>
        
        <div className="flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2 shadow-inner border border-slate-200 dark:border-slate-700">
            <Trophy className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Encounters</div>
          <div className="text-xl font-black text-slate-700 dark:text-slate-300">{matches.length}</div>
        </div>

        <Card className="p-4 sm:p-6 bg-white dark:bg-slate-900 shadow-xl border-t-4 border-t-blue-500 rounded-3xl overflow-hidden relative">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Wins</div>
          <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white">{p2Wins}</div>
        </Card>
      </div>

      {/* Profiles Side by Side */}
      <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-8">
        {/* Player 1 */}
        <div className="flex flex-col items-center text-center">
          <img src={player1.avatar_url || ""} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-emerald-100 dark:border-emerald-900 shadow-lg mb-4" />
          <div className="relative group w-full max-w-[200px] mx-auto">
            <select
              value={player1.id}
              onChange={(e) => {
                if (e.target.value !== player2.id) {
                  setLocation(`/compare/${e.target.value}/${player2.id}`);
                }
              }}
              className="text-xl font-black text-slate-900 dark:text-white bg-transparent appearance-none text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-6 py-1 rounded-xl w-full truncate focus:outline-none"
            >
              <option value={player1.id} className="hidden">{player1.full_name}</option>
              {allPlayers.map((p) => (
                <option key={p.id} value={p.id} className="text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {p.full_name}
                </option>
              ))}
            </select>
            <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>
          
          <div className={`mt-2 px-3 py-1 rounded-lg backdrop-blur-md border border-white/25 text-xs font-black uppercase shadow-sm flex items-center gap-1.5 ${getEloTier(player1.elo_rating).bg} ${getEloTier(player1.elo_rating).color}`}>
             <Trophy className="w-3 h-3" /> {getEloTier(player1.elo_rating).name} • {player1.elo_rating} OVR
          </div>
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-center text-center">
          <img src={player2.avatar_url || ""} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-blue-100 dark:border-blue-900 shadow-lg mb-4" />
          <div className="relative group w-full max-w-[200px] mx-auto">
            <select
              value={player2.id}
              onChange={(e) => {
                if (e.target.value !== player1.id) {
                  setLocation(`/compare/${player1.id}/${e.target.value}`);
                }
              }}
              className="text-xl font-black text-slate-900 dark:text-white bg-transparent appearance-none text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-6 py-1 rounded-xl w-full truncate focus:outline-none"
            >
              <option value={player2.id} className="hidden">{player2.full_name}</option>
              {allPlayers.map((p) => (
                <option key={p.id} value={p.id} className="text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {p.full_name}
                </option>
              ))}
            </select>
            <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>
          
          <div className={`mt-2 px-3 py-1 rounded-lg backdrop-blur-md border border-white/25 text-xs font-black uppercase shadow-sm flex items-center gap-1.5 ${getEloTier(player2.elo_rating).bg} ${getEloTier(player2.elo_rating).color}`}>
             <Trophy className="w-3 h-3" /> {getEloTier(player2.elo_rating).name} • {player2.elo_rating} OVR
          </div>
        </div>
      </div>

      {/* Win Rate Bar */}
      {totalMatches > 0 && (
        <div className="mb-12">
          <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2 px-2">
            <span className="text-emerald-600 dark:text-emerald-400">{p1WinRate}% Win Rate</span>
            <span className="text-blue-600 dark:text-blue-400">{p2WinRate}% Win Rate</span>
          </div>
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${p1WinRate}%` }} />
            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${p2WinRate}%` }} />
          </div>
          
          {/* Matchup Streak */}
          <div className="mt-4 flex justify-center">
            {p1Streak > 1 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full text-xs font-black">
                <Flame className="w-3 h-3" /> {player1.full_name.split(" ")[0]} is on a {p1Streak} match win streak!
              </span>
            )}
            {p2Streak > 1 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full text-xs font-black">
                <Flame className="w-3 h-3" /> {player2.full_name.split(" ")[0]} is on a {p2Streak} match win streak!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tale of the Tape */}
      <Card className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 mb-8 overflow-hidden">
        <h3 className="text-sm font-black text-slate-800 dark:text-white mb-6 text-center uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-4">
          Tale of the Tape
        </h3>
        
        <div className="space-y-4">
          {[
            { label: "Department", icon: MapPin, p1Val: player1.department, p2Val: player2.department },
            { label: "Playing Style", icon: Activity, p1Val: player1.playing_style || "Balanced", p2Val: player2.playing_style || "Balanced" },
            { label: "Dominant Hand", icon: User, p1Val: player1.dominant_hand || "Right-handed", p2Val: player2.dominant_hand || "Right-handed" },
            { label: "Height", icon: Ruler, p1Val: player1.height || "N/A", p2Val: player2.height || "N/A" },
            { label: "Joined", icon: Calendar, p1Val: player1.joined_year || "N/A", p2Val: player2.joined_year || "N/A" }
          ].map((stat, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
              <div className="flex-1 text-right text-sm font-bold text-slate-700 dark:text-slate-300 pr-4">{stat.p1Val}</div>
              <div className="w-24 shrink-0 flex flex-col items-center justify-center">
                 <stat.icon className="w-4 h-4 text-slate-400 mb-1" />
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">{stat.label}</span>
              </div>
              <div className="flex-1 text-left text-sm font-bold text-slate-700 dark:text-slate-300 pl-4">{stat.p2Val}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Format Breakdown */}
      {formatBreakdown.length > 0 && (
        <Card className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 mb-8 overflow-hidden">
          <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4 text-center uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-4">
            Format Breakdown
          </h3>
          <div className="space-y-4">
            {formatBreakdown.map(f => {
              const p1Pct = f.total > 0 ? Math.round((f.p1Wins / f.total) * 100) : 0;
              const p2Pct = 100 - p1Pct;
              return (
                <div key={f.format}>
                  <div className="flex justify-between text-xs font-black mb-1.5">
                    <span className={f.p1Wins >= f.p2Wins ? fmtColor1 : "text-slate-400"}>{f.p1Wins}W · {p1Pct}%</span>
                    <span className="text-slate-400 uppercase tracking-widest">{fmtLabel(f.format)}</span>
                    <span className={f.p2Wins > f.p1Wins ? fmtColor2 : "text-slate-400"}>{p2Pct}% · {f.p2Wins}W</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 transition-all duration-700 rounded-l-full" style={{ width: `${p1Pct}%` }} />
                    <div className="h-full bg-blue-500 transition-all duration-700 rounded-r-full" style={{ width: `${p2Pct}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-400 text-center mt-1">{f.total} match{f.total !== 1 ? "es" : ""}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Trend Chart */}
      {eloHistory.length > 0 && (
        <Card className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Rivalry ELO Trend
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eloHistory} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickMargin={10} />
                <YAxis stroke="#64748b" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                  itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                />
                <Line type="monotone" dataKey={player1.full_name} stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey={player2.full_name} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Recent Matches */}
      {matches.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Swords className="w-4 h-4 text-slate-500" /> Recent Encounters
          </h3>
          <div className="space-y-3">
            {[...matches].reverse().slice(0, 5).map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                currentUser={session?.user}
                isKudosed={false}
                kudosCount={0}
                hideActions={true}
              />
            ))}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center p-8 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-3xl mt-6 border border-slate-200 dark:border-slate-700">
          No head-to-head matches played yet.
        </div>
      )}
    </div>
  );
}
