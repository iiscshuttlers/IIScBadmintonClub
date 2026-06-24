import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { getEloTier } from "@/lib/tiers";
import { useHashTab } from "@/hooks/useHashTab";

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
  singles_record?: string;
  doubles_record?: string;
  mixed_record?: string;
}

export function useLeaderboardState(players: PlayerRank[]) {
  const [activeTab, setActiveTab] = useHashTab(
    ["elo", "ironman"] as const,
    (() => {
      const params = new URLSearchParams(window.location.search);
      const lb = params.get("lb");
      return (lb === "elo" || lb === "ironman" ? lb : null) ||
        (localStorage.getItem("leaderboard_tab") as "elo" | "ironman") ||
        "elo";
    })()
  );
  
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "MS" | "WS" | "MD" | "WD" | "XD">(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");
    if (["ALL", "MS", "WS", "MD", "WD", "XD"].includes(cat || "")) return cat as any;
    return "ALL";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("lb", activeTab);
    params.set("cat", categoryFilter);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}#${activeTab}`);
    localStorage.setItem("leaderboard_tab", activeTab);
  }, [activeTab, categoryFilter]);

  const [ironmanFilter, setIronmanFilter] = useState<"all" | "monthly">("all");
  const [monthlyCounts, setMonthlyCounts] = useState<Record<string, number>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshTick(t => t + 1), []);
  useAutoRefresh(bumpRefresh, 60_000);

  useEffect(() => {
    if (activeTab === "ironman" && ironmanFilter === "monthly") {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      supabase.from("matches").select("player1_id, player2_id, team1_partner_id, team2_partner_id")
        .eq("status", "confirmed")
        .gte("created_at", startOfMonth)
        .then(({data}) => {
           if (data) {
             const counts: Record<string, number> = {};
             for (const match of data) {
               [match.player1_id, match.player2_id, match.team1_partner_id, match.team2_partner_id].forEach(id => {
                 if (id) counts[id] = (counts[id] || 0) + 1;
               });
             }
             setMonthlyCounts(counts);
           }
        });
    }
  }, [activeTab, ironmanFilter, refreshTick]);

  const [upsets, setUpsets] = useState<any[]>([]);
  const [activeStreaks, setActiveStreaks] = useState<any[]>([]);
  const [allStreaks, setAllStreaks] = useState<Record<string, number>>({});
  const [lastEloChange, setLastEloChange] = useState<Record<string, number>>({});
  const [eloHistory, setEloHistory] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (activeTab === "elo") {
      let query = supabase
        .from("matches")
        .select("*, player1:players!player1_id(id, full_name, avatar_url), player2:players!player2_id(id, full_name, avatar_url), partner1:players!team1_partner_id(id, full_name, avatar_url), partner2:players!team2_partner_id(id, full_name, avatar_url)")
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(200);

      if (categoryFilter !== "ALL") {
        const dbCategory =
          categoryFilter === "MS" || categoryFilter === "WS" ? "Singles" :
          categoryFilter === "MD" || categoryFilter === "WD" || categoryFilter === "XD" ? "Doubles" :
          categoryFilter;
        query = query.eq("category", dbCategory);
      }

      query.then(({ data }) => {
          if (data) {
            const significantUpsets = data
              .filter(m => m.elo_change_p1 !== undefined && m.elo_change_p2 !== undefined)
              .map(m => {
                const isP1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
                const upsetScoreRaw = isP1Winner ? (m.elo_change_p1 || 0) : (m.elo_change_p2 || 0);
                const upsetScore = categoryFilter === "ALL" ? Math.floor(upsetScoreRaw / 3) : upsetScoreRaw;
                return { ...m, upsetScore };
              })
              .filter(m => m.upsetScore > (categoryFilter === "ALL" ? 6 : 20))
              .sort((a, b) => b.upsetScore - a.upsetScore)
              .slice(0, 3);
            setUpsets(significantUpsets);

            const lastChange: Record<string, number> = {};
            const history: Record<string, number[]> = {};
            for (const match of data) {
              const players4 = [
                { id: match.player1_id, change: match.elo_change_p1 },
                { id: match.player2_id, change: match.elo_change_p2 },
                { id: match.team1_partner_id, change: match.elo_change_p3 },
                { id: match.team2_partner_id, change: match.elo_change_p4 },
              ];
              for (const p of players4) {
                if (p.id && p.change != null) {
                  const displayChange = categoryFilter === "ALL" ? Math.floor(p.change / 3) : p.change;
                  if (!history[p.id]) history[p.id] = [];
                  if (history[p.id].length < 5) history[p.id].push(displayChange);
                  if (!(p.id in lastChange)) lastChange[p.id] = displayChange;
                }
              }
            }
            setLastEloChange(lastChange);
            setEloHistory(history);

            const playerStreaks: Record<string, { id: string, name: string, avatar: string, streak: number, isAlive: boolean }> = {};
            
            for (const match of data) {
              const isP1Winner = match.winner_id === match.player1_id || match.winner_id === match.team1_partner_id;
              
              const updatePlayer = (pId: string, pName: string, pAvatar: string, won: boolean) => {
                if (!pId) return;
                if (!playerStreaks[pId]) {
                  playerStreaks[pId] = { id: pId, name: pName, avatar: pAvatar, streak: 0, isAlive: true };
                }
                
                if (playerStreaks[pId].isAlive) {
                  if (won) playerStreaks[pId].streak += 1;
                  else playerStreaks[pId].isAlive = false;
                }
              };

              if (match.player1) updatePlayer(match.player1.id, match.player1.full_name, match.player1.avatar_url, isP1Winner);
              if (match.player2) updatePlayer(match.player2.id, match.player2.full_name, match.player2.avatar_url, !isP1Winner);
              if (match.partner1) updatePlayer(match.partner1.id, match.partner1.full_name, match.partner1.avatar_url, isP1Winner);
              if (match.partner2) updatePlayer(match.partner2.id, match.partner2.full_name, match.partner2.avatar_url, !isP1Winner);
            }

            const topStreaks = Object.values(playerStreaks)
              .filter(p => p.streak > 1)
              .sort((a, b) => b.streak - a.streak)
              .slice(0, 5);
            
            setActiveStreaks(topStreaks);
            
            const allStrks: Record<string, number> = {};
            Object.values(playerStreaks).forEach(p => { allStrks[p.id] = p.streak; });
            setAllStreaks(allStrks);
          }
        });
    }
  }, [activeTab, categoryFilter, refreshTick]);

  const getCategoryElo = (player: PlayerRank) => {
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
    top3, rest, exportLeaderboard, upsets, activeStreaks, monthlyCounts,
    getCategoryElo, getCategoryRecord, getMatchesCount, displayRecord,
    lastEloChange, eloHistory, allStreaks
  };
}
