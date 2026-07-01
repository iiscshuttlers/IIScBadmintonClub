import { useMemo } from "react";
import type { PlayerRow, MatchWithPlayers } from "@/types";

export function usePlayerStats(
  player: PlayerRow | null,
  liveMatches: MatchWithPlayers[],
  validAchievements: string[]
) {
  const id = player?.id;

  const profileCompleteness = useMemo(() => {
    if (!player) return 0;
    const checks = [
      !!player.avatar_url,
      !!player.bio,
      !!player.quote,
      !!player.nationality,
      !!player.height,
      !!player.coach,
      player.years_playing != null,
      player.racket_details && player.racket_details.length > 0,
      !!player.shoes,
      !!player.instagram,
      !!(player.stats?.media?.length),
      validAchievements.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [player, validAchievements]);

  const dynamicBadges = useMemo(() => {
    if (!player) return [];
    const _badges: {
      id: string;
      label: string;
      icon: string;
      description: string;
      color: string;
    }[] = [];

    // Centurion Badge
    let totalMatches = 0;
    if (player.win_loss_record) {
      const match = player.win_loss_record.match(/(\d+)W\s*-\s*(\d+)L/);
      if (match) totalMatches = parseInt(match[1]) + parseInt(match[2]);
    } else if (player.stats?.totalMatches) {
      totalMatches = player.stats.totalMatches;
    }

    if (totalMatches >= 100) {
      _badges.push({
        id: "centurion",
        label: "Centurion",
        icon: "💯",
        description: "Played 100+ matches",
        color:
          "bg-amber-500/15 text-amber-400 border-amber-500/30 ring-amber-500/20",
      });
    } else if (totalMatches >= 50) {
      _badges.push({
        id: "veteran",
        label: "Veteran",
        icon: "⚔️",
        description: "Played 50+ matches",
        color:
          "bg-slate-500/15 text-muted-foreground border-slate-500/30 ring-slate-500/20",
      });
    }

    // Win Streak Badge
    const streak = player.stats?.currentStreak;
    if (streak && streak.startsWith("W")) {
      const streakCount = parseInt(streak.replace("W", "")) || 0;
      if (streakCount >= 5) {
        _badges.push({
          id: "unstoppable",
          label: "Unstoppable",
          icon: "⚡",
          description: "5+ Match Win Streak",
          color:
            "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 ring-indigo-500/20",
        });
      } else if (streakCount >= 3) {
        _badges.push({
          id: "on_fire",
          label: "On Fire",
          icon: "🔥",
          description: "3 Match Win Streak",
          color:
            "bg-orange-500/15 text-orange-400 border-orange-500/30 ring-orange-500/20",
        });
      }
    }

    // Giant Slayer Badge
    const hasGiantSlayer = validAchievements.some(
      (a) =>
        a.toLowerCase().includes("giant slayer") ||
        a.toLowerCase().includes("upset"),
    );
    if (hasGiantSlayer) {
      _badges.push({
        id: "giant_slayer",
        label: "Giant Slayer",
        icon: "🗡️",
        description: "Defeated a much higher ranked opponent",
        color:
          "bg-rose-500/15 text-rose-400 border-rose-500/30 ring-rose-500/20",
      });
    }

    return _badges;
  }, [player, validAchievements]);

  const winPct = useMemo(() => {
    if (!player) return 0;
    const stats = player.stats;
    if (stats?.winPercentage != null) return stats.winPercentage;
    const w = stats?.wins ?? 0;
    const l = stats?.losses ?? 0;
    if (w + l === 0) {
      const m = player.win_loss_record?.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
      if (m) {
        const ww = +m[1],
          ll = +m[2];
        return ww + ll ? (ww / (ww + ll)) * 100 : 0;
      }
      return 0;
    }
    return (w / (w + l)) * 100;
  }, [player]);

  const totalMatches = useMemo(() => {
    if (!player) return 0;
    const stats = player.stats;
    if (stats?.totalMatches != null) return stats.totalMatches;
    const m = player.win_loss_record?.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
    if (m) return +m[1] + +m[2];
    return (stats?.wins ?? 0) + (stats?.losses ?? 0);
  }, [player]);

  // BWF-style Split Stats
  const splitStats = useMemo(() => {
    if (!id) return null;
    const confirmed = liveMatches.filter((m) => m.status === "confirmed");
    const friendly = confirmed.filter((m) => m.is_friendly !== false);
    const tournament = confirmed.filter((m) => m.is_friendly === false);

    const computeStats = (matches: MatchWithPlayers[]) => {
      const matchResults = matches.map(m => {
        const isTeam1 = m.player1_id === id || m.team1_partner_id === id;
        const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
        return (isTeam1 ? isTeam1Winner : !isTeam1Winner) ? "W" : "L";
      });

      const wins = matchResults.filter(r => r === "W").length;
      const losses = matches.length - wins;
      const winPct = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;
      const recentForm = matchResults.slice(0, 5) as ("W" | "L")[];
      
      let streak = "";
      if (matchResults.length > 0) {
        const firstResult = matchResults[0];
        let count = 0;
        for (const r of matchResults) {
          if (r === firstResult) count++;
          else break;
        }
        streak = `${firstResult}${count}`;
      }
      return {
        wins,
        losses,
        total: matches.length,
        winPct,
        recentForm,
        streak,
      };
    };

    const singles = confirmed.filter((m) => !m.team1_partner_id && !m.team2_partner_id);
    const doublesMatches = confirmed.filter((m) => m.team1_partner_id || m.team2_partner_id);
    
    const mixed = doublesMatches.filter(m => {
       const allGenders = [m.player1?.gender, m.player2?.gender, m.partner1?.gender, m.partner2?.gender]
         .map(g => (g || '').toLowerCase())
         .filter(Boolean);
       return allGenders.includes('male') && allGenders.includes('female');
    });

    const doubles = doublesMatches.filter(m => !mixed.includes(m));

    return {
      all: computeStats(confirmed),
      friendly: computeStats(friendly),
      tournament: computeStats(tournament),
      singles: computeStats(singles),
      doubles: computeStats(doubles),
      mixed: computeStats(mixed),
    };
  }, [liveMatches, id]);

  const streakStats = useMemo(() => {
    if (!id || liveMatches.length === 0) return { current: 0, max: 0 };
    const confirmed = liveMatches.filter(m => m.status === "confirmed").sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let current = 0;
    let max = 0;
    confirmed.forEach(m => {
      const isTeam1 = m.player1_id === id || m.team1_partner_id === id;
      const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
      const won = isTeam1 ? isTeam1Winner : !isTeam1Winner;
      
      if (won) {
        current++;
        if (current > max) max = current;
      } else {
        current = 0;
      }
    });
    return { current, max };
  }, [id, liveMatches]);

  const totalPlayedGames = useMemo(() => {
    if (!player?.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split("-").map(Number);
    return (w || 0) + (l || 0);
  }, [player?.win_loss_record]);

  return {
    profileCompleteness,
    dynamicBadges,
    winPct,
    totalMatches,
    splitStats,
    streakStats,
    totalPlayedGames
  };
}
