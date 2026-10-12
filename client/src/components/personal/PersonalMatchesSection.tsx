import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { MatchCard as FeedMatchCard } from "@/components/feed/MatchCard";
import { shareMatch } from "@/lib/shareMatch";
import type { PersonalMatch } from "@/hooks/usePlayerPersonal";
import { Sigma, Swords, Users, Trophy } from "lucide-react";

export type FormatTab = "All" | "Singles" | "Doubles" | "Mixed Doubles";

export function PersonalMatchCardItem({ match, currentUser }: { match: any; currentUser: any }) {
  const [liked, setLiked] = useState<boolean | null>(null);

  const isLikedLocally = liked !== null ? liked : !!localStorage.getItem(`liked_${match.id}`);
  const baseCount = Array.isArray(match.kudos_users) ? match.kudos_users.length : (match.kudos_count || 0);
  const isIncludedInBackend = Array.isArray(match.kudos_users) && currentUser?.id && match.kudos_users.includes(currentUser.id);

  let finalKudosCount = baseCount;
  if (isLikedLocally && !isIncludedInBackend) {
    finalKudosCount += 1;
  } else if (!isLikedLocally && isIncludedInBackend) {
    finalKudosCount = Math.max(0, finalKudosCount - 1);
  }

  const isKudosed = isLikedLocally || isIncludedInBackend;

  const handleKudos = async () => {
    const storageKey = `liked_${match.id}`;
    const isCurrentlyLiked = isKudosed;

    if (!isCurrentlyLiked) {
      localStorage.setItem(storageKey, "1");
      setLiked(true);
      toast.success("Match liked! ❤️");
    } else {
      localStorage.removeItem(storageKey);
      setLiked(false);
      toast.success("Like removed");
    }

    if (currentUser?.id) {
      supabase
        .rpc("toggle_match_kudos", { p_match_id: match.id })
        .then(({ error }) => {
          if (error) console.warn("Failed to sync kudos live:", error);
        });
    }
  };

  return (
    <FeedMatchCard
      match={match}
      currentUser={currentUser}
      isKudosed={isKudosed}
      kudosCount={finalKudosCount}
      onKudos={handleKudos}
      onShare={() => shareMatch(match)}
    />
  );
}

export function MatchesSection({ matches, fullMatches, formatTab, setFormatTab, currentUser }: { matches: PersonalMatch[]; fullMatches: any[]; formatTab: FormatTab; setFormatTab: (tab: FormatTab) => void; currentUser: any }) {
  const [matchTypeFilter, setMatchTypeFilter] = useState<"ALL" | "TOURNAMENT" | "FRIENDLY">("ALL");

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

      // Type filter
      if (matchTypeFilter === "TOURNAMENT" && m.is_friendly !== false) return false;
      if (matchTypeFilter === "FRIENDLY" && m.is_friendly === false) return false;

      return true;
    });
  }, [fullMatches, formatTab, matchTypeFilter]);

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
              className={`text-left transition-all bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border p-3.5 sm:p-4 cursor-pointer ${
                isSelected 
                  ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/50 dark:ring-amber-500/50 scale-[1.02]" 
                  : "border-slate-100 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 ${
                s.color === "primary" ? "text-primary" : s.color === "blue" ? "text-[var(--series-a)]" : s.color === "green" ? "text-green-500" : "text-amber-500"
              }`} />
              <div className="text-sm font-black text-slate-800 dark:text-slate-100">{s.count}</div>
              <div className="text-[10px] font-bold text-muted-foreground">{s.label}</div>
              <div className={`text-xs font-bold mt-1 ${
                s.color === "primary" ? "text-primary" : s.color === "blue" ? "text-[var(--series-a)]" : s.color === "green" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
              }`}>{s.winRate}% win</div>
            </button>
          );
        })}
      </div>

      {/* Match Type Pills Filter */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          {(["ALL", "TOURNAMENT", "FRIENDLY"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setMatchTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                matchTypeFilter === type
                  ? "bg-white dark:bg-slate-700 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {type === "ALL" ? "All Types" : type === "TOURNAMENT" ? "Tournaments" : "Friendlies"}
            </button>
          ))}
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          Showing {filtered.length} match{filtered.length === 1 ? "" : "es"}
        </div>
      </div>

      {/* Match Cards Feed */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((m) => <PersonalMatchCardItem key={m.id} match={m} currentUser={currentUser} />)
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground italic bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            No matches found for the selected filters
          </div>
        )}
      </div>
    </div>
  );
}
