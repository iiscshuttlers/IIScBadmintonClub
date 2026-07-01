import { Link } from "wouter";
import { User, Swords, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getEloTier } from "@/lib/tiers";
import { PlayerRank } from "@/hooks/useLeaderboardState";

interface Props {
  rest: PlayerRank[];
  activeTab: "elo" | "ironman";
  eloMode: "club" | "tournament";
  allStreaks: Record<string, number>;
  getCategoryElo: (player: PlayerRank) => number;
  getCategoryRecord: (player: PlayerRank) => string;
  getMatchesCount: (record: string | any) => number;
  displayRecord: (record: string | any) => string;
  lastEloChange: Record<string, number>;
  eloHistory: Record<string, number[]>;
}

export function LeaderboardTable({
  rest, activeTab, eloMode, allStreaks, getCategoryElo, getCategoryRecord,
  getMatchesCount, displayRecord, lastEloChange, eloHistory
}: Props) {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="rounded-3xl shadow-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-widest font-black text-muted-foreground dark:text-muted-foreground">
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4">Player</th>
                <th className="p-4 hidden sm:table-cell">Department</th>
                <th className="p-4 hidden md:table-cell">Record</th>
                <th className="p-4 text-right">
                  {activeTab === "elo" ? (eloMode === "tournament" ? "Tournament ELO" : "ELO") : "Matches Played"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {rest.map((player, index) => {
                const hist = eloHistory[player.id] ?? [];
                const trendSum = hist.reduce((a, b) => a + b, 0);
                const trend =
                  activeTab !== "elo" || hist.length === 0
                    ? null
                    : trendSum > 10
                      ? "up"
                      : trendSum < -10
                        ? "down"
                        : "stable";
                return (
                <tr
                  key={player.id}
                  className="hover:bg-white dark:hover:bg-slate-800/80 transition-colors group"
                >
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-black text-muted-foreground dark:text-muted-foreground">#{index + 4}</span>
                      {trend === "up" && (
                        <span className="inline-flex items-center gap-0.5 text-primary text-[10px] font-black leading-none bg-primary/10 dark:bg-primary/30 px-1 rounded">▲ HOT</span>
                      )}
                      {trend === "down" && (
                        <span className="inline-flex items-center gap-0.5 text-rose-500 text-[10px] font-black leading-none bg-rose-50 dark:bg-rose-950/30 px-1 rounded">▼ DIP</span>
                      )}
                      {trend === "stable" && (
                        <span className="text-muted-foreground text-[10px] font-black leading-none">—</span>
                      )}
                      {hist.length > 1 && (
                        <div className="flex items-end gap-[1px] mt-0.5 h-3">
                          {hist.slice().reverse().map((v, i) => (
                            <div
                              key={i}
                              className={`w-1 rounded-sm ${v >= 0 ? "bg-primary" : "bg-rose-400"}`}
                              style={{ height: `${Math.min(12, 4 + Math.abs(v) / 3)}px` }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <Link href={`/player/${player.id}`}>
                      <div className="flex items-center gap-3 cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border-2 border-transparent group-hover:border-primary transition-colors">
                          {player.avatar_url ? (
                            <img
                              src={player.avatar_url}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-full h-full p-2 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-800 dark:text-slate-200 group-hover:text-primary dark:group-hover:text-primary transition-colors">
                              {player.full_name}
                            </span>
                            {allStreaks[player.id] >= 5 && (
                              <span title={`${allStreaks[player.id]} Win Streak`} className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 p-0.5 rounded flex items-center justify-center">
                                <Flame className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-muted-foreground sm:hidden">
                            {player.department}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="p-4 hidden sm:table-cell text-sm font-semibold text-muted-foreground dark:text-muted-foreground">
                    {player.department}
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    {getCategoryRecord(player) && getCategoryRecord(player) !== "0W - 0L" ? (
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 rounded text-xs font-bold font-mono whitespace-nowrap">
                        {displayRecord(getCategoryRecord(player))}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-muted-foreground text-xs font-bold italic whitespace-nowrap">
                        0W - 0L
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {activeTab === "elo" ? (
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border ${getEloTier(getCategoryElo(player)).bg} ${getEloTier(getCategoryElo(player)).text} border-current/20`}>
                        <Swords className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <div className="flex flex-col items-end leading-none gap-0.5">
                          <span className="text-[9px] uppercase font-black tracking-wider opacity-70">
                            {getEloTier(getCategoryElo(player)).name}
                          </span>
                          <span className="font-black text-sm">
                            {getCategoryElo(player)}
                          </span>
                        </div>
                        {lastEloChange[player.id] != null && (
                          <span className={`text-[9px] font-black px-1 py-0.5 rounded ${
                            lastEloChange[player.id] >= 0
                              ? "bg-primary/20 text-primary dark:text-primary/70"
                              : "bg-rose-500/20 text-rose-600 dark:text-rose-300"
                          }`}>
                            {lastEloChange[player.id] >= 0 ? "+" : ""}{lastEloChange[player.id]}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary border border-primary/40 dark:border-primary/50">
                        <Swords className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <div className="flex flex-col items-end leading-none gap-0.5">
                          <span className="text-[9px] uppercase font-black tracking-wider opacity-70">
                            Matches
                          </span>
                          <span className="font-black text-sm">
                            {getMatchesCount(getCategoryRecord(player))}
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
              {rest.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground dark:text-muted-foreground font-bold">
                    Not enough ranked players yet!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
