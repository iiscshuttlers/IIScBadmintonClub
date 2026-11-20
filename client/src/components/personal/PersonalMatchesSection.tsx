import { useMemo } from "react";
import { MatchCard as FeedMatchCard } from "@/components/feed/MatchCard";
import { shareMatch } from "@/lib/shareMatch";
import type { PersonalMatch } from "@/hooks/usePlayerPersonal";
import { Sigma, Swords, Users, Trophy } from "lucide-react";

export type FormatTab = "All" | "Singles" | "Doubles" | "Mixed Doubles";

export function PersonalMatchCardItem({ match, currentUser }: { match: any; currentUser: any }) {
  return (
    <FeedMatchCard
      match={match}
      currentUser={currentUser}
      onShare={() => shareMatch(match)}
    />
  );
}

export function MatchesSection({ matches, fullMatches, formatTab, setFormatTab, currentUser }: { matches: PersonalMatch[]; fullMatches: any[]; formatTab: FormatTab; setFormatTab: (tab: FormatTab) => void; currentUser: any }) {

  const getGroup = (c?: string) => {
    const cat = (c || "").toUpperCase();
    if (cat === "MS" || cat === "WS" || cat.includes("SINGLES")) return "Singles";
    if (cat === "MD" || cat === "WD" || (cat.includes("DOUBLES") && !cat.includes("MIXED"))) return "Doubles";
    if (cat === "XD" || cat.includes("MIXED")) return "Mixed Doubles";
    return "Singles";
  };

  const isWinner = (m: any) => {
    if (typeof m.won === "boolean") return m.won;
    const pId = currentUser?.id;
    if (!pId) return false;
    const isTeam1 = m.player1_id === pId || m.team1_partner_id === pId || m.player1?.id === pId;
    if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
    const isTeam1Winner = m.winner_side ? m.winner_side === 1 : (m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id || m.winner_id === m.player1?.id);
    return isTeam1 ? isTeam1Winner : !isTeam1Winner;
  };

  const stats = useMemo(() => {
    const all = fullMatches;
    const singles = fullMatches.filter((m) => getGroup(m.category) === "Singles");
    const doubles = fullMatches.filter((m) => getGroup(m.category) === "Doubles");
    const mixedDoubles = fullMatches.filter((m) => getGroup(m.category) === "Mixed Doubles");

    const calcWinRate = (arr: any[]) => {
      if (arr.length === 0) return 0;
      const wins = arr.filter(isWinner).length;
      return ((wins / arr.length) * 100).toFixed(0);
    };

    return {
      "All": { count: all.length, winRate: calcWinRate(all), icon: Sigma, color: "primary", label: "All Matches" },
      "Singles": { count: singles.length, winRate: calcWinRate(singles), icon: Swords, color: "blue", label: "Singles" },
      "Doubles": { count: doubles.length, winRate: calcWinRate(doubles), icon: Users, color: "green", label: "Doubles" },
      "Mixed Doubles": { count: mixedDoubles.length, winRate: calcWinRate(mixedDoubles), icon: Trophy, color: "amber", label: "Mixed" },
    };
  }, [fullMatches, currentUser]);

  const filtered = useMemo(() => {
    return fullMatches.filter((m) => {
      // Format filter
      if (formatTab !== "All" && getGroup(m.category) !== formatTab) return false;

      return true;
    });
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
