import { playerWon } from "@/lib/matchResult";
import { useMemo } from "react";
import type { PlayerRow, MatchWithPlayers } from "@/types";
import type { TournamentRun } from "./useTournamentMatchHistory";

export function usePlayerStats(
  player: PlayerRow | null,
  liveMatches: MatchWithPlayers[],
  validAchievements: string[],
  tournamentRuns?: TournamentRun[]
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
        const won = playerWon(m, id);
        if (won == null) return "D";
        return won ? "W" : "L";
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

    const singlesStats = computeStats(singles);
    const doublesStats = computeStats(doubles);
    const mixedStats = computeStats(mixed);

    const overallStats = computeStats(confirmed);
    const friendlyStats = computeStats(friendly);
    const tourneyStats = computeStats(tournament);

    // Augment overallStats and tourneyStats with tournamentRuns
    if (tournamentRuns && tournamentRuns.length > 0) {
      let tourneyRunWins = 0;
      let tourneyRunLosses = 0;
      
      let tourneySinglesWins = 0;
      let tourneySinglesLosses = 0;
      let tourneyDoublesWins = 0;
      let tourneyDoublesLosses = 0;
      let tourneyMixedWins = 0;
      let tourneyMixedLosses = 0;

      for (const run of tournamentRuns) {
        tourneyRunWins += run.wins;
        tourneyRunLosses += run.losses;
        
        const cat = run.category.toLowerCase();
        const isMixed = cat.includes("mixed") || cat === "xd";
        const isSingles = !isMixed && (cat.includes("singles") || cat === "ms" || cat === "ws");
        const isDoubles = !isMixed && !isSingles && (cat.includes("doubles") || cat === "md" || cat === "wd");

        if (isMixed) {
          tourneyMixedWins += run.wins;
          tourneyMixedLosses += run.losses;
        } else if (isSingles) {
          tourneySinglesWins += run.wins;
          tourneySinglesLosses += run.losses;
        } else {
          // If we can't tell, assume doubles as it's the most common, or check if it has "doubles"
          // We'll default to doubles for team matches if neither singles nor mixed is specified
          tourneyDoublesWins += run.wins;
          tourneyDoublesLosses += run.losses;
        }
      }
      
      overallStats.wins += tourneyRunWins;
      overallStats.losses += tourneyRunLosses;
      overallStats.total += (tourneyRunWins + tourneyRunLosses);
      overallStats.winPct = overallStats.total > 0 ? Math.round((overallStats.wins / overallStats.total) * 100) : 0;

      tourneyStats.wins += tourneyRunWins;
      tourneyStats.losses += tourneyRunLosses;
      tourneyStats.total += (tourneyRunWins + tourneyRunLosses);
      tourneyStats.winPct = tourneyStats.total > 0 ? Math.round((tourneyStats.wins / tourneyStats.total) * 100) : 0;
      
      singlesStats.wins += tourneySinglesWins;
      singlesStats.losses += tourneySinglesLosses;
      singlesStats.total += (tourneySinglesWins + tourneySinglesLosses);
      singlesStats.winPct = singlesStats.total > 0 ? Math.round((singlesStats.wins / singlesStats.total) * 100) : 0;
      
      doublesStats.wins += tourneyDoublesWins;
      doublesStats.losses += tourneyDoublesLosses;
      doublesStats.total += (tourneyDoublesWins + tourneyDoublesLosses);
      doublesStats.winPct = doublesStats.total > 0 ? Math.round((doublesStats.wins / doublesStats.total) * 100) : 0;
      
      mixedStats.wins += tourneyMixedWins;
      mixedStats.losses += tourneyMixedLosses;
      mixedStats.total += (tourneyMixedWins + tourneyMixedLosses);
      mixedStats.winPct = mixedStats.total > 0 ? Math.round((mixedStats.wins / mixedStats.total) * 100) : 0;
    }

    return {
      all: overallStats,
      friendly: friendlyStats,
      tournament: tourneyStats,
      singles: singlesStats,
      doubles: doublesStats,
      mixed: mixedStats,
    };
  }, [liveMatches, id, tournamentRuns]);

  const streakStats = useMemo(() => {
    if (!id || liveMatches.length === 0) return { current: 0, max: 0 };
    const confirmed = liveMatches.filter(m => m.status === "confirmed").sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let current = 0;
    let max = 0;
    confirmed.forEach(m => {
      const result = playerWon(m, id);
      if (result == null) {
        current = 0;
        return;
      }
      const won = result;

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
          "bg-warning/15 text-warning border-warning/30 ring-warning/20",
      });
    } else if (totalMatches >= 50) {
      _badges.push({
        id: "veteran",
        label: "Veteran",
        icon: "⚔️",
        description: "Played 50+ matches",
        color:
          "bg-muted-foreground/15 text-muted-foreground border-border-strong/30 ring-border-strong/20",
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
            "bg-info/15 text-info border-info/30 ring-info/20",
        });
      } else if (streakCount >= 3) {
        _badges.push({
          id: "on_fire",
          label: "On Fire",
          icon: "🔥",
          description: "3 Match Win Streak",
          color:
            "bg-secondary/15 text-secondary border-secondary/30 ring-secondary/20",
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
          "bg-danger/15 text-danger border-danger/30 ring-danger/20",
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
