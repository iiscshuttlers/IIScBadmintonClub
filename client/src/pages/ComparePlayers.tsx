import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useArchivedTournaments } from "@/hooks/useArchivedTournaments";
import { fetchPlayer, fetchPlayerList } from "@/services/playerService";
import { fetchPlayerMatches } from "@/services/matchService";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import type { PlayerRow } from "@/types/player";
import type { MatchWithPlayers } from "@/types/match";
import { Trophy, Swords, Calendar, PlaySquare, ChevronDown, User, MapPin, Activity, Flame, Shield, Users, Crown, ChevronLeft, TrendingUp, Ruler } from "lucide-react";
import { getEloTier } from "@/lib/tiers";
import { calculateRanksMap } from "@/lib/rankingUtils";
import { generateMatchPrediction } from "@/lib/aiPredictor";
import { computeWinnerLeaderboard } from "@/data/tournamentArchive";
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
import { InfoModal } from "@/components/InfoModal";
import { TeaserOverlay } from "@/components/TeaserOverlay";
import { eligibilityOf, relation, winnerOf, type ComparisonRow } from "@/lib/comparison";

export default function ComparePlayers() {
  const [match, rawParams] = useRoute("/compare/:p1/:p2");
  const params = rawParams as Record<string, string> | null;
  const p1 = params?.p1;
  const p2 = params?.p2;
  
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  
  const [player1, setPlayer1] = useState<PlayerRow | null>(null);
  const [player2, setPlayer2] = useState<PlayerRow | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({ title: "Player Comparison" });

  const { archivedTournaments } = useArchivedTournaments();

  const getMedalCount = (name: string) => {
    if (!archivedTournaments) return 0;
    const leaderboard = computeWinnerLeaderboard(archivedTournaments);
    const entry = leaderboard.find(l => {
       const lowerName = name.toLowerCase();
       const lName = l.name.toLowerCase();
       return lName === lowerName || lowerName.includes(lName) || lName.includes(lowerName.split(' ')[0]);
    });
    return entry ? entry.wins : 0;
  };

  useEffect(() => {
    fetchPlayerList().then((data) => setAllPlayers(data || []));
  }, []);

  useEffect(() => {
    if (!p1 || !p2) return;
    
    async function load() {
      if (!p1 || !p2) return;
      setLoading(true);
      // Fetch players
      const [p1Data, p2Data] = await Promise.all([
        fetchPlayer(p1),
        fetchPlayer(p2)
      ]);
      setPlayer1(p1Data);
      setPlayer2(p2Data);

      // Fetch head to head matches
      const matchesData = await fetchPlayerMatches(p1, 1000);

      if (matchesData) {
        // Reverse because we need ascending order for trend charts
        const ascMatches = [...matchesData].reverse();
        // Filter specifically for head to head (they are on opposing teams)
        // Shared WP8 policy: opposite sides, finished, with a recorded winner.
        // Walkovers and unfinished/disputed rows are left to the full
        // head-to-head page so these totals always reconcile with the list.
        const h2h = ascMatches.filter(m => {
          const row = toComparisonRow(m);
          return relation(row, { ids: [p1] }, { ids: [p2] })?.kind === "against" && eligibilityOf(row).eligibility === "counted";
        });
        setMatches(h2h);
      }
      setLoading(false);
    }
    load();
  }, [p1, p2]);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading rivalry data...</div>;
  }

  if (!player1 || !player2) {
    return <div className="p-6 text-center text-danger">Could not load players.</div>;
  }

  // Calculate stats
  let p1Wins = 0;
  let p2Wins = 0;
  
  const eloHistory = [];
  let currentP1Elo = 1200;
  let currentP2Elo = 1200;

  for (const m of matches) {
    const p1Team = m.player1_id === player1.id || m.team1_partner_id === player1.id ? 1 : 2;
    const winnerTeam = winnerOf(toComparisonRow(m));
    
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
    const winnerTeam = winnerOf(toComparisonRow(m));
    
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
      const winnerTeam = winnerOf(toComparisonRow(m));
      if (winnerTeam === p1Team) fP1Wins++; else fP2Wins++;
    }
    return { format: fmt, p1Wins: fP1Wins, p2Wins: fP2Wins, total: fmtMatches.length };
  }).filter(f => f.total > 0);

  // Single format labels: "Singles" → "S", "Doubles" → "D", "Mixed Doubles" → "XD"
  const fmtLabel = (f: string) => f === "Singles" ? "Singles" : f === "Doubles" ? "Doubles" : "Mixed";
  const fmtColor1 = "text-primary";
  const fmtColor2 = "text-info";

  const rankMap = calculateRanksMap(allPlayers);
  const p1RankNum = rankMap[player1.id]?.overall || 0;
  const p2RankNum = rankMap[player2.id]?.overall || 0;
  const p1Rank = p1RankNum > 0 ? `#${p1RankNum}` : "UR";
  const p2Rank = p2RankNum > 0 ? `#${p2RankNum}` : "UR";
  
  const formatRank = (r: number) => r > 0 ? `#${r}` : "UR";
  const p1RanksAll = rankMap[player1.id] || { overall: 0, singles: 0, doubles: 0, mixed: 0 };
  const p2RanksAll = rankMap[player2.id] || { overall: 0, singles: 0, doubles: 0, mixed: 0 };

  return (
    <div className="pb-24 pt-6 max-w-4xl mx-auto px-4">
      <button onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = `${import.meta.env.BASE_URL}pulse`} className="flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to H2H
        </button>

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-danger/10 text-danger px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-2 border border-danger/30">
          <Swords className="w-4 h-4" /> Head to Head Rivalry
          <InfoModal
            title="H2H RIVALRY"
            items={[
              { badge: "AI", title: "Pundit Analysis", desc: "Our AI model analyzes playing styles to predict the outcome of future matches between these two players." }
            ]}
            triggerClassName="text-danger hover:text-danger/80"
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-foreground flex items-center justify-center gap-4">
          <span className="truncate max-w-[40%] text-right">{player1.full_name.split(" ")[0]}</span>
          <span className="text-muted-foreground text-2xl font-mono italic">VS</span>
          <span className="truncate max-w-[40%] text-left">{player2.full_name.split(" ")[0]}</span>
        </h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-8 text-center relative z-10">
        <Card className="p-4 sm:p-6 bg-card shadow-xl border-t-4 border-t-primary rounded-3xl overflow-hidden relative">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Wins</div>
          <div className="text-4xl sm:text-5xl font-black text-foreground">{p1Wins}</div>
        </Card>
        
        <div className="flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-2 shadow-inner border border-border-strong">
            <Trophy className="w-5 h-5 text-gold" />
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Counted meetings</div>
          <div className="text-xl font-black text-soft">{matches.length}</div>
          <Link href={`/h2h?a=${player1.id}&b=${player2.id}`} className="mt-1 inline-flex items-center min-h-[44px] px-2 text-[11px] font-bold text-primary underline">
            Full head-to-head
          </Link>
        </div>

        <Card className="p-4 sm:p-6 bg-card shadow-xl border-t-4 border-t-info rounded-3xl overflow-hidden relative">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Wins</div>
          <div className="text-4xl sm:text-5xl font-black text-foreground">{p2Wins}</div>
        </Card>
      </div>

      {/* Profiles Side by Side */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-8">
        {/* Player 1 */}
        <div className="flex flex-col items-center text-center">
          <img src={player1.avatar_url || ""} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-primary shadow-lg mb-4" />
          <div className="relative group w-full px-1 mx-auto">
            <PlayerSelect
              value={player1.id}
              onChange={(newId) => {
                if (newId && newId !== player2.id) {
                  setLocation(`/compare/${newId}/${player2.id}`);
                }
              }}
              players={allPlayers}
              className="text-sm sm:text-xl font-black text-foreground bg-transparent appearance-none text-center cursor-pointer hover:bg-muted px-2 sm:px-6 py-1 rounded-xl w-full focus:outline-none/90 focus:ring-0 focus:border-0/90 border-0 outline-none pr-8"
            />
            <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none text-primary">
              <ChevronDown className="w-5 h-5 drop-shadow-md" />
            </div>
          </div>
          
          <div className={`mt-2 px-3 py-1 rounded-lg backdrop-blur-md border border-foreground/25 text-xs font-black uppercase shadow-sm flex items-center gap-1.5 ${getEloTier(player1.elo_rating).bg} ${getEloTier(player1.elo_rating).text}`}>
             <Trophy className="w-3 h-3" /> {getEloTier(player1.elo_rating).name} • OVR: {p1Rank}
          </div>
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-center text-center">
          <img src={player2.avatar_url || ""} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-info/40 shadow-lg mb-4" />
          <div className="relative group w-full px-1 mx-auto">
            <PlayerSelect
              value={player2.id}
              onChange={(newId) => {
                if (newId && newId !== player1.id) {
                  setLocation(`/compare/${player1.id}/${newId}`);
                }
              }}
              players={allPlayers}
              className="text-sm sm:text-xl font-black text-foreground bg-transparent appearance-none text-center cursor-pointer hover:bg-muted px-2 sm:px-6 py-1 rounded-xl w-full focus:outline-none/90 focus:ring-0 focus:border-0/90 border-0 outline-none pr-8"
            />
            <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none text-info">
              <ChevronDown className="w-5 h-5 drop-shadow-md" />
            </div>
          </div>
          
          <div className={`mt-2 px-3 py-1 rounded-lg backdrop-blur-md border border-foreground/25 text-xs font-black uppercase shadow-sm flex items-center gap-1.5 ${getEloTier(player2.elo_rating).bg} ${getEloTier(player2.elo_rating).text}`}>
             <Trophy className="w-3 h-3" /> {getEloTier(player2.elo_rating).name} • OVR: {p2Rank}
          </div>
        </div>
      </div>

      {/* Win Rate Bar */}
      {totalMatches > 0 && (
        <div className="mb-12">
          <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2 px-2">
            <span className="text-primary">{p1WinRate}% Win Rate</span>
            <span className="text-info">{p2WinRate}% Win Rate</span>
          </div>
          <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex shadow-inner">
            <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${p1WinRate}%` }} />
            <div className="h-full bg-info transition-all duration-1000" style={{ width: `${p2WinRate}%` }} />
          </div>
          
          {/* Matchup Streak */}
          <div className="mt-4 flex justify-center">
            {p1Streak > 1 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary/20 text-secondary rounded-full text-xs font-black">
                <Flame className="w-3 h-3" /> {player1.full_name.split(" ")[0]} is on a {p1Streak} match win streak!
              </span>
            )}
            {p2Streak > 1 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary/20 text-secondary rounded-full text-xs font-black">
                <Flame className="w-3 h-3" /> {player2.full_name.split(" ")[0]} is on a {p2Streak} match win streak!
              </span>
            )}
          </div>
        </div>
      )}

      <TeaserOverlay isLocked={!session}>
        {/* AI Prediction Pundit Card */}
      <AiPredictionCard player1={player1} player2={player2} p1Wins={p1Wins} p2Wins={p2Wins} matches={matches} />

      {/* Tale of the Tape */}
      <Card className="p-6 bg-card rounded-3xl shadow-lg border border-border mb-8 overflow-hidden">
        <h3 className="text-sm font-black text-foreground mb-6 text-center uppercase tracking-widest border-b border-border pb-4">
          Tale of the Tape
        </h3>
        
        <div className="space-y-4">
          {[
            { label: "Department", icon: MapPin, p1Val: player1.department, p2Val: player2.department, color: "text-danger", chip: "bg-danger/15" },
            { label: "Playing Style", icon: Activity, p1Val: player1.playing_style || "Balanced", p2Val: player2.playing_style || "Balanced", color: "text-warning", chip: "bg-warning/15" },
            { label: "Dominant Hand", icon: User, p1Val: player1.dominant_hand || "Right-handed", p2Val: player2.dominant_hand || "Right-handed", color: "text-individual", chip: "bg-individual/15" },
            { label: "Medals", icon: Trophy, p1Val: getMedalCount(player1.full_name), p2Val: getMedalCount(player2.full_name), color: "text-warning", chip: "bg-warning/15" },
            { label: "Experience", icon: Flame, p1Val: player1.started_playing_year ? `${new Date().getFullYear() - player1.started_playing_year} yrs` : "N/A", p2Val: player2.started_playing_year ? `${new Date().getFullYear() - player2.started_playing_year} yrs` : "N/A", color: "text-secondary", chip: "bg-secondary/15" },
            { label: "Fav Format", icon: Activity, p1Val: player1.favorite_format || "N/A", p2Val: player2.favorite_format || "N/A", color: "text-success", chip: "bg-success/15" }
          ].map((stat, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex-1 text-right text-sm font-bold text-primary pr-4">{stat.p1Val}</div>
              <div className="w-24 shrink-0 flex flex-col items-center justify-center">
                 <span className={`flex items-center justify-center w-8 h-8 rounded-full mb-1 ${stat.chip}`}>
                   <stat.icon className={`w-4 h-4 ${stat.color}`} />
                 </span>
                 <span className={`text-[10px] font-black uppercase tracking-wider text-center ${stat.color}`}>{stat.label}</span>
              </div>
              <div className="flex-1 text-left text-sm font-bold text-info pl-4">{stat.p2Val}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Format Breakdown */}
      {formatBreakdown.length > 0 && (
        <Card className="p-6 bg-card rounded-3xl shadow-lg border border-border mb-8 overflow-hidden">
          <h3 className="text-sm font-black text-foreground mb-4 text-center uppercase tracking-widest border-b border-border pb-4">
            Format Breakdown
          </h3>
          <div className="space-y-4">
            {formatBreakdown.map(f => {
              const p1Pct = f.total > 0 ? Math.round((f.p1Wins / f.total) * 100) : 0;
              const p2Pct = 100 - p1Pct;
              return (
                <div key={f.format}>
                  <div className="flex justify-between text-xs font-black mb-1.5">
                    <span className={f.p1Wins >= f.p2Wins ? fmtColor1 : "text-muted-foreground"}>{f.p1Wins}W · {p1Pct}%</span>
                    <span className="text-muted-foreground uppercase tracking-widest">{fmtLabel(f.format)}</span>
                    <span className={f.p2Wins > f.p1Wins ? fmtColor2 : "text-muted-foreground"}>{p2Pct}% · {f.p2Wins}W</span>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                    <div className="h-full bg-primary transition-all duration-700 rounded-l-full" style={{ width: `${p1Pct}%` }} />
                    <div className="h-full bg-info transition-all duration-700 rounded-r-full" style={{ width: `${p2Pct}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground text-center mt-1">{f.total} match{f.total !== 1 ? "es" : ""}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}


        {/* Rankings */}
        <Card className="p-6 bg-card rounded-3xl shadow-lg border border-border mb-8 overflow-hidden">
          <h3 className="text-sm font-black text-foreground mb-6 text-center uppercase tracking-widest border-b border-border pb-4">
            Leaderboard Rankings
          </h3>
          <div className="space-y-4">
            {[
              { label: "Overall", icon: Trophy, p1Val: formatRank(p1RanksAll.overall), p2Val: formatRank(p2RanksAll.overall), color: "text-warning", chip: "bg-warning/15" },
              { label: "Singles", icon: User, p1Val: formatRank(p1RanksAll.singles), p2Val: formatRank(p2RanksAll.singles), color: "text-info", chip: "bg-info/15" },
              { label: "Doubles", icon: User, p1Val: formatRank(p1RanksAll.doubles), p2Val: formatRank(p2RanksAll.doubles), color: "text-success", chip: "bg-success/15" },
              { label: "Mixed", icon: User, p1Val: formatRank(p1RanksAll.mixed), p2Val: formatRank(p2RanksAll.mixed), color: "text-individual", chip: "bg-individual/15" }
            ].map((stat, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex-1 text-right text-lg font-black text-primary pr-4">{stat.p1Val}</div>
                <div className="w-24 shrink-0 flex flex-col items-center justify-center">
                   <span className={`flex items-center justify-center w-8 h-8 rounded-full mb-1 ${stat.chip}`}>
                     <stat.icon className={`w-4 h-4 ${stat.color}`} />
                   </span>
                   <span className={`text-[10px] font-black uppercase tracking-wider text-center ${stat.color}`}>{stat.label}</span>
                </div>
                <div className="flex-1 text-left text-lg font-black text-info pl-4">{stat.p2Val}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Matches List */}
        {matches.length > 0 && (
          <div>
            <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
              <Swords className="w-4 h-4 text-muted-foreground" /> Recent Encounters
            </h3>
            <div className="space-y-3">
              {[...matches].reverse().slice(0, 5).map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  currentUser={session?.user}
                  hideActions={true}
                />
              ))}
            </div>
          </div>
        )}
      </TeaserOverlay>

      {matches.length === 0 && (
        <div className="text-center p-6 text-muted-foreground bg-muted/50 rounded-3xl mt-6 border border-border-strong">
          No head-to-head matches played yet.
        </div>
      )}
    </div>
  );
}

function AiPredictionCard({ player1, player2, p1Wins, p2Wins, matches }: { player1: PlayerRow, player2: PlayerRow, p1Wins: number, p2Wins: number, matches: MatchWithPlayers[] }) {
  const prediction = generateMatchPrediction(player1, player2, p1Wins, p2Wins, matches);

  return (
    <Card className="p-6 bg-gradient-to-br from-info/20 to-individual/20 text-on-accent rounded-3xl shadow-2xl mb-8 relative overflow-hidden border border-info/30">
      {/* Decorative background flair */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-individual/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-info/20 blur-3xl rounded-full pointer-events-none" />

      <h3 className="text-sm font-black uppercase tracking-widest text-info mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-individual" />
        AI Match Prediction
      </h3>

      <div className="mb-6 flex items-end justify-between">
        <div className="text-left">
          <div className="text-3xl font-black text-primary">{prediction.p1WinProbability}%</div>
          <div className="text-xs font-bold text-info tracking-wider uppercase mt-1">{player1.full_name.split(" ")[0]} Win Prob</div>
        </div>
        <div className="text-center text-info font-black italic pb-1 px-4">
          VS
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-info">{prediction.p2WinProbability}%</div>
          <div className="text-xs font-bold text-info tracking-wider uppercase mt-1">{player2.full_name.split(" ")[0]} Win Prob</div>
        </div>
      </div>

      <div className="bg-info/20 backdrop-blur border border-info/30 rounded-2xl p-4 text-sm leading-relaxed text-info italic shadow-inner">
        "{prediction.punditCommentary}"
      </div>
    </Card>
  );
}

/** Adapt a profile match (friendly or tournament, partner columns mapped) to the shared comparison row. */
function toComparisonRow(m: any): ComparisonRow {
  const friendly = m.is_friendly === true || (m.is_friendly == null && m.winner_side == null && !m.tournament_id);
  return {
    id: m.id,
    source: friendly ? "friendly" : "tournament",
    status: m.status,
    winnerSide: m.winner_side === 1 || m.winner_side === 2 ? m.winner_side : null,
    winnerId: m.winner_id ?? null,
    side1: [m.player1_id, m.team1_partner_id ?? m.player3_id].filter(Boolean),
    side2: [m.player2_id, m.team2_partner_id ?? m.player4_id].filter(Boolean),
    category: m.category ?? null,
    date: m.ended_at ?? m.created_at ?? null,
    score: m.score ?? null,
    round: null,
    event: null,
  };
}
