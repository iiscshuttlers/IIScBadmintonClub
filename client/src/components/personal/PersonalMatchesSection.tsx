import { playerWon } from "@/lib/matchResult";
import { useMemo } from "react";
import { MatchCard as FeedMatchCard } from "@/components/feed/MatchCard";
import { shareMatch } from "@/lib/shareMatch";
import { orderProfileMatches } from "@/lib/profileMatchOrder";
import type { PersonalMatch } from "@/hooks/usePlayerPersonal";
import { Sigma, Swords, Users, Trophy } from "lucide-react";

export type FormatTab = "All" | "Singles" | "Doubles" | "Mixed Doubles";
const FORMAT_ORDER = ["Singles", "Doubles", "Mixed Doubles"] as const;

export function PersonalMatchCardItem({ match, currentUser }: { match: any; currentUser: any }) {
  return (
    <FeedMatchCard
      match={match}
      currentUser={currentUser}
      onShare={() => shareMatch(match)}
    />
  );
}

/**
 * A player's matches as feed cards, with format filters and win rates.
 * `playerId` is whose profile it is (defaults to the viewer); win rates count
 * only decided matches, so upcoming and live ones do not drag them down.
 */
export function MatchesSection({ matches, fullMatches, formatTab, setFormatTab, currentUser, playerId }: { matches: PersonalMatch[]; fullMatches: any[]; formatTab: FormatTab; setFormatTab: (tab: FormatTab) => void; currentUser: any; playerId?: string }) {

  const getGroup = (c?: string) => {
    const cat = (c || "").toUpperCase();
    if (cat === "MS" || cat === "WS" || cat.includes("SINGLES")) return "Singles";
    if (cat === "MD" || cat === "WD" || (cat.includes("DOUBLES") && !cat.includes("MIXED"))) return "Doubles";
    if (cat === "XD" || cat.includes("MIXED")) return "Mixed Doubles";
    return "Singles";
  };

  const ownerId = playerId ?? currentUser?.id;
  const resultOf = (m: any): boolean | null => (typeof m.won === "boolean" ? m.won : playerWon(m, ownerId));
  const isWinner = (m: any) => resultOf(m) === true;

  const stats = useMemo(() => {
    const all = fullMatches;
    const singles = fullMatches.filter((m) => getGroup(m.category) === "Singles");
    const doubles = fullMatches.filter((m) => getGroup(m.category) === "Doubles");
    const mixedDoubles = fullMatches.filter((m) => getGroup(m.category) === "Mixed Doubles");

    const calcWinRate = (arr: any[]) => {
      const decided = arr.filter((m) => resultOf(m) !== null);
      if (decided.length === 0) return 0;
      const wins = decided.filter(isWinner).length;
      return ((wins / decided.length) * 100).toFixed(0);
    };

    return {
      "All": { count: all.length, winRate: calcWinRate(all), icon: Sigma, color: "primary", label: "All Matches" },
      "Singles": { count: singles.length, winRate: calcWinRate(singles), icon: Swords, color: "blue", label: "Singles" },
      "Doubles": { count: doubles.length, winRate: calcWinRate(doubles), icon: Users, color: "green", label: "Doubles" },
      "Mixed Doubles": { count: mixedDoubles.length, winRate: calcWinRate(mixedDoubles), icon: Trophy, color: "amber", label: "Mixed" },
    };
  }, [fullMatches, ownerId]);

  // Grouped by format; within a format live, upcoming, then finished (latest first).
  const filtered = useMemo(() => {
    const inTab = fullMatches.filter((m) => formatTab === "All" || getGroup(m.category) === formatTab);
    return orderProfileMatches(inTab, (m) => getGroup(m.category), FORMAT_ORDER);
  }, [fullMatches, formatTab]);

  return (
    <div className="space-y-4">
      {/* Format Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["All", "Singles", "Doubles", "Mixed Doubles"] as FormatTab[]).map((tab) => {
          const s = stats[tab];
          const Icon = s.icon;
          const isSelected = formatTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => setFormatTab(tab)}
              className={`text-left transition-all bg-muted/80 rounded-2xl shadow-md border p-3.5 sm:p-4 cursor-pointer ${
                isSelected 
                  ? "border-warning ring-2 ring-warning/50 scale-[1.02]" 
                  : "border-border-strong/50 hover:border-border-strong"
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 ${
                s.color === "primary" ? "text-primary" : s.color === "blue" ? "text-series-a" : s.color === "green" ? "text-success" : "text-warning"
              }`} />
              <div className="text-sm font-black text-foreground">{s.count}</div>
              <div className="text-[10px] font-bold text-muted-foreground">{s.label}</div>
              <div className={`text-xs font-bold mt-1 ${
                s.color === "primary" ? "text-primary" : s.color === "blue" ? "text-series-a" : s.color === "green" ? "text-success" : "text-warning"
              }`}>{s.winRate}% win</div>
            </button>
          );
        })}
      </div>

      {/* Match count */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <div className="text-xs font-semibold text-muted-foreground">
          Showing {filtered.length} match{filtered.length === 1 ? "" : "es"}
        </div>
      </div>

      {/* Match Cards Feed */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((m) => <PersonalMatchCardItem key={m.id} match={m} currentUser={currentUser} />)
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground italic bg-muted/80 rounded-2xl border border-border-strong/50">
            No matches found for the selected filters
          </div>
        )}
      </div>
    </div>
  );
}
