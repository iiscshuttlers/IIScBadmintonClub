import { useState, useMemo } from "react";
import { Link } from "wouter";
import { EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";

interface TournamentStandingsTabProps {
  matches: any[];
  players: any[];
}

export function TournamentStandingsTab({ matches, players }: TournamentStandingsTabProps) {
  const [activeCategory, setActiveCategory] = useState<"OVERALL" | "MS" | "WS" | "MD" | "WD" | "XD">("OVERALL");
  const { isAdmin } = useAuth();

  const stats = useMemo(() => {
    // Initialize stats map
    const playerStats: Record<string, {
      id: string;
      wins: number;
      losses: number;
      played: number;
    }> = {};

    players.forEach(p => {
      playerStats[p.id] = { id: p.id, wins: 0, losses: 0, played: 0 };
    });

    const isMatchInCategory = (match: any, cat: string) => {
      if (cat === "OVERALL") return true;
      // Extract category logic
      if (!match.category) return false;
      const matchCat = match.category.toUpperCase();
      if (cat === "MS") return matchCat.includes("SINGLES") && !matchCat.includes("WOMEN"); // rough approximation, better to use exact match if db stores "MS"
      if (cat === "WS") return matchCat.includes("WOMEN") && matchCat.includes("SINGLES");
      if (cat === "MD") return matchCat.includes("DOUBLES") && !matchCat.includes("WOMEN") && !matchCat.includes("MIXED");
      if (cat === "WD") return matchCat.includes("WOMEN") && matchCat.includes("DOUBLES");
      if (cat === "XD") return matchCat.includes("MIXED");
      
      return matchCat === cat;
    };

    matches.forEach(m => {
      if (!isMatchInCategory(m, activeCategory)) return;

      const {
        player1_id, player2_id, team1_partner_id, team2_partner_id,
        winner_id, winner_partner_id, loser_id, loser_partner_id
      } = m;

      // Add to played
      if (player1_id && playerStats[player1_id]) playerStats[player1_id].played++;
      if (player2_id && playerStats[player2_id]) playerStats[player2_id].played++;
      if (team1_partner_id && playerStats[team1_partner_id]) playerStats[team1_partner_id].played++;
      if (team2_partner_id && playerStats[team2_partner_id]) playerStats[team2_partner_id].played++;

      // Add to wins
      if (winner_id && playerStats[winner_id]) playerStats[winner_id].wins++;
      if (winner_partner_id && playerStats[winner_partner_id]) playerStats[winner_partner_id].wins++;

      // Add to losses
      if (loser_id && playerStats[loser_id]) playerStats[loser_id].losses++;
      if (loser_partner_id && playerStats[loser_partner_id]) playerStats[loser_partner_id].losses++;
    });

    // Filter out players with 0 matches played
    let ranked = Object.values(playerStats).filter(s => s.played > 0);

    // Sort: Wins DESC -> Losses ASC -> Played DESC
    ranked.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses; // fewer losses is better
      return b.played - a.played;
    });

    return ranked;
  }, [matches, players, activeCategory]);

  return (
    <div className="w-full max-w-4xl mx-auto pb-12 font-sans relative">
      {isAdmin && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 p-3 rounded-xl flex items-start gap-3">
          <EyeOff className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Admin View:</span> You are seeing this page because you are an admin.
            The ELO column is visible only to you.
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex overflow-x-auto pb-2 mb-6 hide-scrollbar gap-2">
        {(["OVERALL", "MS", "WS", "MD", "WD", "XD"] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {cat === "OVERALL" ? "Overall" : cat}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <Card className="rounded-3xl shadow-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-widest font-black text-muted-foreground dark:text-muted-foreground">
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4">Player</th>
                <th className="p-4 hidden sm:table-cell">Dept</th>
                <th className="p-4 text-center">W</th>
                <th className="p-4 text-center">L</th>
                <th className="p-4 text-center">Played</th>
                {isAdmin && <th className="p-4 text-right text-amber-600 dark:text-amber-500">ELO</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-muted-foreground">
                    No tournament matches found for this category.
                  </td>
                </tr>
              ) : (
                stats.map((stat, index) => {
                  const player = players.find(p => p.id === stat.id);
                  if (!player) return null;

                  return (
                    <tr key={stat.id} className="hover:bg-white dark:hover:bg-slate-800/80 transition-colors group">
                      <td className="p-4 text-center">
                        <span className={`font-black ${index < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                          #{index + 1}
                        </span>
                      </td>
                      <td className="p-4">
                        <Link href={`/player/${player.id}`}>
                          <div className="flex items-center gap-3 cursor-pointer">
                            <Avatar src={player.avatar_url} name={player.full_name} size="sm" />
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                              {player.full_name}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          {player.department || "-"}
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-emerald-600 dark:text-emerald-500">{stat.wins}</td>
                      <td className="p-4 text-center font-bold text-rose-600 dark:text-rose-500">{stat.losses}</td>
                      <td className="p-4 text-center font-semibold text-slate-500">{stat.played}</td>
                      {isAdmin && (
                        <td className="p-4 text-right font-black text-amber-600 dark:text-amber-500">
                          {Math.round(player.tournament_elo || player.elo_rating || 1200)}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
