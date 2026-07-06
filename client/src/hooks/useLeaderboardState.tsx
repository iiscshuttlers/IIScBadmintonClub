import { useState, useEffect, useCallback } from "react";
import { getEloTier } from "@/lib/tiers";
import { useHashTab } from "@/hooks/useHashTab";
import { useIronmanMonthlyQuery } from "@/hooks/queries/useIronmanMonthlyQuery";
import { useLeaderboardStatsQuery } from "@/hooks/queries/useLeaderboardStatsQuery";
import { safeReplaceState, safeGetSearchParams } from "@/lib/navUtils";

export interface PlayerRank {
  id: string;
  full_name: string;
  avatar_url: string;
  elo_rating: number;
  department: string;
  win_loss_record: string;
  playing_level: string;
  gender?: string;
  singles_elo?: number;
  doubles_elo?: number;
  mixed_elo?: number;
  tournament_elo?: number;
  singles_record?: string;
  doubles_record?: string;
  mixed_record?: string;
}

export function useLeaderboardState(players: PlayerRank[]) {
  const [activeTab, setActiveTab] = useHashTab(
    ["elo", "ironman"] as const,
    (() => {
      const params = safeGetSearchParams();
      const lb = params.get("lb");
      return (lb === "elo" || lb === "ironman" ? lb : null) ||
        (localStorage.getItem("leaderboard_tab") as "elo" | "ironman") ||
        "elo";
    })()
  );
  
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "MS" | "WS" | "MD" | "WD" | "XD">(() => {
    const params = safeGetSearchParams();
    const cat = params.get("cat");
    if (["ALL", "MS", "WS", "MD", "WD", "XD"].includes(cat || "")) return cat as any;
    return "ALL";
  });

  const [ironmanFilter, setIronmanFilter] = useState<"all" | "monthly">("all");
  const [eloMode, setEloMode] = useState<"club" | "tournament">(() => {
    const params = safeGetSearchParams();
    const mode = params.get("mode");
    if (mode === "club" || mode === "tournament") return mode as any;
    return "club";
  });

  useEffect(() => {
    const params = safeGetSearchParams();
    params.set("lb", activeTab);
    params.set("cat", categoryFilter);
    params.set("mode", eloMode);
    safeReplaceState(`${window.location.pathname}?${params.toString()}#${activeTab}`);
    localStorage.setItem("leaderboard_tab", activeTab);
  }, [activeTab, categoryFilter, eloMode]);
  
  // Refactored data fetching using React Query
  const { data: monthlyCountsData } = useIronmanMonthlyQuery(eloMode, activeTab === "ironman" && ironmanFilter === "monthly");
  const monthlyCounts = monthlyCountsData || {};

  const { data: statsData } = useLeaderboardStatsQuery(categoryFilter, eloMode, activeTab === "elo");
  const upsets = statsData?.upsets || [];
  const activeStreaks = statsData?.activeStreaks || [];
  const allStreaks = statsData?.allStreaks || {};
  const lastEloChange = statsData?.lastEloChange || {};
  const eloHistory = statsData?.eloHistory || {};

  const getCategoryElo = (player: PlayerRank) => {
    if (eloMode === "tournament") return player.tournament_elo ?? 1200;
    if (categoryFilter === "MS" || categoryFilter === "WS") {
      return player.singles_elo ?? player.elo_rating;
    } else if (categoryFilter === "MD" || categoryFilter === "WD") {
      return player.doubles_elo ?? player.elo_rating;
    } else if (categoryFilter === "XD") {
      return player.mixed_elo ?? player.elo_rating;
    }
    return player.elo_rating;
  };

  const getCategoryRecord = (player: PlayerRank) => {
    if (eloMode === "tournament") {
      return statsData?.tournamentRecords?.[player.id] || "0W - 0L";
    }
    if (categoryFilter === "MS" || categoryFilter === "WS") return player.singles_record || "0W - 0L";
    if (categoryFilter === "MD" || categoryFilter === "WD") return player.doubles_record || "0W - 0L";
    if (categoryFilter === "XD") return player.mixed_record || "0W - 0L";
    return player.win_loss_record || "0W - 0L";
  };

  const getMatchesCount = (record: string | any) => {
    if (!record) return 0;
    const formatted =
      typeof record === "string" && record.includes("W")
        ? record
        : (() => {
            try {
              const parsed = typeof record === "string" ? JSON.parse(record) : record;
              if (parsed && typeof parsed.wins === "number" && typeof parsed.losses === "number") {
                return `${parsed.wins}W - ${parsed.losses}L`;
              }
            } catch {}
            return String(record);
          })();

    const match = formatted.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
    if (match) return parseInt(match[1]) + parseInt(match[2]);
    return 0;
  };

  const displayRecord = (record: string | any) => {
    if (!record) return "No data";
    try {
      const parsed = typeof record === "string" ? JSON.parse(record) : record;
      if (parsed && typeof parsed.wins === "number" && typeof parsed.losses === "number") {
        return `${parsed.wins}W - ${parsed.losses}L`;
      }
    } catch {}
    return String(record);
  };

  let filteredByGender = players;
  if (categoryFilter === "MS" || categoryFilter === "MD") {
    filteredByGender = players.filter(p => p.gender?.toUpperCase() === "MALE");
  } else if (categoryFilter === "WS" || categoryFilter === "WD") {
    filteredByGender = players.filter(p => p.gender?.toUpperCase() === "FEMALE");
  }

  const rankedPlayers = [...filteredByGender]
    .sort((a, b) => {
      if (activeTab === "elo") {
        const eloA = getCategoryElo(a);
        const eloB = getCategoryElo(b);
        if (eloB !== eloA) return eloB - eloA;

        const recA = getCategoryRecord(a);
        const recB = getCategoryRecord(b);
        
        const parseWinsLosses = (rec: any) => {
          const str = displayRecord(rec);
          const match = str.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
          if (match) {
            const w = parseInt(match[1]);
            const l = parseInt(match[2]);
            return { w, l, total: w + l, pct: w + l > 0 ? w / (w + l) : 0 };
          }
          return { w: 0, l: 0, total: 0, pct: 0 };
        };

        const statsA = parseWinsLosses(recA);
        const statsB = parseWinsLosses(recB);

        if (statsB.pct !== statsA.pct) return statsB.pct - statsA.pct;
        if (statsB.total !== statsA.total) return statsB.total - statsA.total;
        return a.full_name.localeCompare(b.full_name);
      }
      const matchesA = ironmanFilter === "monthly" ? (monthlyCounts[a.id] || 0) : getMatchesCount(getCategoryRecord(a));
      const matchesB = ironmanFilter === "monthly" ? (monthlyCounts[b.id] || 0) : getMatchesCount(getCategoryRecord(b));
      
      if (matchesB !== matchesA) return matchesB - matchesA;
      
      const eloA = getCategoryElo(a);
      const eloB = getCategoryElo(b);
      if (eloB !== eloA) return eloB - eloA;
      
      return a.full_name.localeCompare(b.full_name);
    });

  const top3 = rankedPlayers.slice(0, 3);
  const rest = rankedPlayers.slice(3);

  const exportLeaderboard = () => {
    if (rankedPlayers.length === 0) return;
    const headers = ["Rank", "Name", "Department", "Gender", "Level", "Global ELO", "Singles ELO", "Doubles ELO", "Mixed ELO", "Singles Record", "Doubles Record", "Mixed Record", "Matches Played"];
    const rows = rankedPlayers.map((p, index) => {
      return [
        index + 1,
        `"${p.full_name || ""}"`,
        `"${p.department || ""}"`,
        p.gender || "",
        getEloTier(p.elo_rating).name,
        p.elo_rating,
        p.singles_elo || "",
        p.doubles_elo || "",
        p.mixed_elo || "",
        p.singles_record || "0W - 0L",
        p.doubles_record || "0W - 0L",
        p.mixed_record || "0W - 0L",
        getMatchesCount(p.win_loss_record)
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Leaderboard_${categoryFilter}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    activeTab, setActiveTab, categoryFilter, setCategoryFilter, ironmanFilter, setIronmanFilter,
    eloMode, setEloMode,
    top3, rest, exportLeaderboard, upsets, activeStreaks, monthlyCounts,
    getCategoryElo, getCategoryRecord, getMatchesCount, displayRecord,
    lastEloChange, eloHistory, allStreaks
  };
}
