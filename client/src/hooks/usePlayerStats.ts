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
      player.started_playing_year != null,
      player.racket_details && player.racket_details.length > 0,
      !!player.shoes,
      !!player.instagram,
      !!(player.stats?.media?.length),
      validAchievements.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [player, validAchievements]);

  // BWF-style Split Stats (Computed First)
  const splitStats = useMemo(() => {
    if (!id) return null;
    const confirmed = liveMatches.filter((m) => m.status === "confirmed");
    const friendly = confirmed.filter((m) => m.is_friendly !== false);
    const tournament = confirmed.filter((m) => m.is_friendly === false);

    const computeStats = (matches: MatchWithPlayers[]) => {
      const matchResults = matches.map(m => {
        if (!m.winner_id) return "D";
        const isTeam1 = m.player1_id === id || m.team1_partner_id === id;
        const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
        return (isTeam1 ? isTeam1Winner : !isTeam1Winner) ? "W" : "L";
      });

      const wins = matchResults.filter(r => r === "W").length;
      const losses = matchResults.filter(r => r === "L").length;
      const draws = matchResults.filter(r => r === "D").length;
      const totalDecided = wins + losses;
      const winPct = totalDecided > 0 ? Math.round((wins / totalDecided) * 100) : 0;
      const recentForm = matchResults.slice(0, 5) as ("W" | "L" | "D")[];
      
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
      if (!m.winner_id) {
        current = 0;
        return;
      }
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
    const totalMatches = splitStats?.all?.total || 0;

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
    const streak = splitStats?.all?.streak;
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
  }, [player, splitStats, validAchievements]);

  const winPct = splitStats?.all?.winPct || 0;
  const totalMatches = splitStats?.all?.total || 0;
  const totalPlayedGames = splitStats?.all?.total || 0;

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
