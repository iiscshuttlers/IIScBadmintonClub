import { useState, useMemo, useRef } from "react";
import { Link } from "wouter";
import { EyeOff, Download, Image as ImageIcon, FileText, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { getDepartmentAcronym } from "@/data/departments";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface TournamentStandingsTabProps {
  matches: any[];
  players: any[];
}

const SortIcon = ({ sortConfig, columnKey }: { sortConfig: { key: string, direction: "asc" | "desc" } | null, columnKey: string }) => {
  if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 inline-block" />;
  return sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 ml-1 inline-block text-primary" /> : <ArrowDown className="w-3 h-3 ml-1 inline-block text-primary" />;
};

export function TournamentStandingsTab({ matches, players }: TournamentStandingsTabProps) {
  const [activeCategory, setActiveCategory] = useState<"OVERALL" | "S" | "D" | "XD">("OVERALL");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
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
      if (!match.category) return false;
      const matchCat = match.category.toUpperCase();
      
      // Exact code match
      if (matchCat === cat) return true;
      
      // Descriptive string match fallback
      if (cat === "S") return matchCat.includes("SINGLES") || matchCat === "MS" || matchCat === "WS";
      if (cat === "D") return (matchCat.includes("DOUBLES") && !matchCat.includes("MIXED")) || matchCat === "MD" || matchCat === "WD";
      if (cat === "XD") return matchCat.includes("MIXED") || matchCat === "XD";
      
      return false;
    };

    matches.forEach(m => {
      if (!isMatchInCategory(m, activeCategory)) return;

      const hasTeam1 = m.player1_id || (m.team1_label && !m.team1_label.toLowerCase().includes("bye"));
      const hasTeam2 = m.player2_id || (m.team2_label && !m.team2_label.toLowerCase().includes("bye"));
      if (!hasTeam1 || !hasTeam2) return; // Skip BYEs!

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
    const baseRanked = Object.values(playerStats).filter(s => s.played > 0).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return b.played - a.played;
    }).map((stat, i) => ({ ...stat, originalRank: i + 1 }));

    if (sortConfig) {
      baseRanked.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;
        
        switch (sortConfig.key) {
          case "player":
            valA = players.find(p => p.id === a.id)?.full_name || "";
            valB = players.find(p => p.id === b.id)?.full_name || "";
            break;
          case "dept":
            valA = players.find(p => p.id === a.id)?.department || "";
            valB = players.find(p => p.id === b.id)?.department || "";
            break;
          case "wins":
            valA = a.wins;
            valB = b.wins;
            break;
          case "ratio":
            valA = a.played > 0 ? (a.wins / a.played) : 0;
            valB = b.played > 0 ? (b.wins / b.played) : 0;
            break;
          case "played":
            valA = a.played;
            valB = b.played;
            break;
          case "rank":
            valA = a.originalRank;
            valB = b.originalRank;
            break;
          case "elo":
            const pA = players.find(p => p.id === a.id);
            const pB = players.find(p => p.id === b.id);
            valA = activeCategory === "S" ? (pA?.singles_elo || 1200) :
                   activeCategory === "D" ? (pA?.doubles_elo || 1200) :
                   activeCategory === "XD" ? (pA?.mixed_elo || 1200) :
                   (pA?.tournament_elo || pA?.elo_rating || 1200);
            valB = activeCategory === "S" ? (pB?.singles_elo || 1200) :
                   activeCategory === "D" ? (pB?.doubles_elo || 1200) :
                   activeCategory === "XD" ? (pB?.mixed_elo || 1200) :
                   (pB?.tournament_elo || pB?.elo_rating || 1200);
            break;
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return baseRanked;
  }, [matches, players, activeCategory, sortConfig]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "desc";
    if (key === "player" || key === "dept" || key === "rank") direction = "asc";

    if (sortConfig && sortConfig.key === key && sortConfig.direction === direction) {
      setSortConfig({ key, direction: direction === "asc" ? "desc" : "asc" });
    } else if (sortConfig && sortConfig.key === key) {
      setSortConfig(null);
    } else {
      setSortConfig({ key, direction });
    }
  };

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

      {/* Export Controls */}
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => {
          const headers = ["Rank", "Player", "Dept", "W-L", "Win %", "Played"];
          if (isAdmin) headers.push("ELO");
          const rows = stats.map((stat, i) => {
            const p = players.find((pl) => pl.id === stat.id);
            if (!p) return null;
            let elo = Math.round(p.tournament_elo || p.elo_rating || 1200);
            if (activeCategory === "S") elo = Math.round(p.singles_elo || 1200);
            if (activeCategory === "D") elo = Math.round(p.doubles_elo || 1200);
            if (activeCategory === "XD") elo = Math.round(p.mixed_elo || 1200);

            const winPct = stat.played > 0 ? ((stat.wins / stat.played) * 100).toFixed(1) + "%" : "0%";
            const row = [
              i + 1,
              `"${p.full_name}"`,
              `"${p.department || ""}"`,
              `'${stat.wins}-${stat.losses}`,
              `"${winPct}"`,
              stat.played
            ];
            if (isAdmin) row.push(elo.toString());
            return row.join(",");
          }).filter(Boolean);

          const csv = [headers.join(","), ...rows].join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `standings_${activeCategory}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}>
          <Download className="w-4 h-4 mr-2" />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={async () => {
          if (!tableRef.current) return;
          const canvas = await html2canvas(tableRef.current, { backgroundColor: null, scale: 2 });
          const url = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = url;
          a.download = `standings_${activeCategory}.png`;
          a.click();
        }}>
          <ImageIcon className="w-4 h-4 mr-2" />
          PNG
        </Button>
        <Button variant="outline" size="sm" onClick={async () => {
          if (!tableRef.current) return;
          const canvas = await html2canvas(tableRef.current, { scale: 2 });
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
          pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
          pdf.save(`standings_${activeCategory}.pdf`);
        }}>
          <FileText className="w-4 h-4 mr-2" />
          PDF
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto pb-2 mb-6 hide-scrollbar gap-2">
        {(["OVERALL", "S", "D", "XD"] as const).map(cat => (
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
      <div ref={tableRef}>
        <Card className="rounded-3xl shadow-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[500px]">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-xs uppercase tracking-widest font-black text-muted-foreground dark:text-muted-foreground">
                  <th className="p-2 sm:p-4 w-12 sm:w-16 text-center cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort("rank")}>
                    Rank <SortIcon sortConfig={sortConfig} columnKey="rank" />
                  </th>
                  <th className="p-2 sm:p-4 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort("player")}>
                    Player <SortIcon sortConfig={sortConfig} columnKey="player" />
                  </th>
                  <th className="p-2 sm:p-4 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort("dept")}>
                    Dept <SortIcon sortConfig={sortConfig} columnKey="dept" />
                  </th>
                  <th className="p-2 sm:p-4 text-center cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort("wins")}>
                    W-L <SortIcon sortConfig={sortConfig} columnKey="wins" />
                  </th>
                  <th className="p-2 sm:p-4 text-center cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort("ratio")}>
                    Win % <SortIcon sortConfig={sortConfig} columnKey="ratio" />
                  </th>
                  <th className="p-2 sm:p-4 text-center cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort("played")}>
                    Played <SortIcon sortConfig={sortConfig} columnKey="played" />
                  </th>
                  {isAdmin && (
                    <th className="p-2 sm:p-4 text-right text-amber-600 dark:text-amber-500 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort("elo")}>
                      ELO <SortIcon sortConfig={sortConfig} columnKey="elo" />
                    </th>
                  )}
                </tr>
              </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-muted-foreground text-sm">
                    No tournament matches found for this category.
                  </td>
                </tr>
              ) : (
                stats.map((stat, index) => {
                  const player = players.find(p => p.id === stat.id);
                  if (!player) return null;

                  return (
                    <tr key={stat.id} className="hover:bg-white dark:hover:bg-slate-800/80 transition-colors group text-xs sm:text-sm">
                      <td className="p-2 sm:p-4 text-center">
                        <span className={`font-black ${(stat as any).originalRank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                          #{ (stat as any).originalRank }
                        </span>
                      </td>
                      <td className="p-2 sm:p-4">
                        <Link href={`/player/${player.id}`}>
                          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                            <Avatar src={player.avatar_url} name={player.full_name} size="sm" className="w-6 h-6 sm:w-8 sm:h-8" />
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors max-w-[120px] sm:max-w-none truncate">
                              {player.full_name}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="p-2 sm:p-4">
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          {getDepartmentAcronym(player.department) || "-"}
                        </span>
                      </td>
                      <td className="p-2 sm:p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                        <span className="text-emerald-600 dark:text-emerald-500">{stat.wins}</span>
                        <span className="opacity-50 mx-1">-</span>
                        <span className="text-rose-600 dark:text-rose-500">{stat.losses}</span>
                      </td>
                      <td className="p-2 sm:p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                        {stat.played > 0 ? ((stat.wins / stat.played) * 100).toFixed(1) + "%" : "0%"}
                      </td>
                      <td className="p-2 sm:p-4 text-center font-semibold text-slate-500">{stat.played}</td>
                      {isAdmin && (
                        <td className="p-2 sm:p-4 text-right font-black text-amber-600 dark:text-amber-500">
                          {Math.round(
                            activeCategory === "S" ? (player.singles_elo || 1200) :
                            activeCategory === "D" ? (player.doubles_elo || 1200) :
                            activeCategory === "XD" ? (player.mixed_elo || 1200) :
                            (player.tournament_elo || player.elo_rating || 1200)
                          )}
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
    </div>
  );
}
