export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export interface ShoeItem {
  name: string;
  primary?: boolean;
}

export function parseShoesList(shoes: string | null): ShoeItem[] {
  if (!shoes) return [];
  try {
    if (shoes.startsWith("[")) return JSON.parse(shoes);
    return [{ name: shoes, primary: true }];
  } catch {
    return [{ name: shoes, primary: true }];
  }
}

export function parseWinLossRecord(record: string | any): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  if (!record) return { wins, losses };
  if (typeof record === 'string') {
    // If it's a JSON string
    try {
      if (record.startsWith("{")) {
        const parsed = JSON.parse(record);
        wins = parsed.wins || 0;
        losses = parsed.losses || 0;
        return { wins, losses };
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
    // Handle specific formats like "10W - 5L", "10-5"
    if (record.includes('W') && record.includes('L')) {
      const match = record.match(/(\d+)W\s*-\s*(\d+)L/);
      if (match) {
        wins = parseInt(match[1], 10);
        losses = parseInt(match[2], 10);
      }
    } else if (record.includes('-')) {
      const [w, l] = record.split('-').map((s: string) => parseInt(s.trim(), 10));
      wins = !isNaN(w) ? w : 0;
      losses = !isNaN(l) ? l : 0;
    }
  } else if (typeof record === 'object') {
    wins = record.wins || 0;
    losses = record.losses || 0;
  }
  return { wins, losses };
}

export function matchParticipantIds(match: any): string[] {
  return [match.player1_id, match.player2_id, match.team1_partner_id, match.team2_partner_id].filter(Boolean);
}

export function isMatchParticipant(match: any, playerId?: string | null): boolean {
  if (!playerId) return false;
  return (
    match.player1_id === playerId ||
    match.player2_id === playerId ||
    match.team1_partner_id === playerId ||
    match.team2_partner_id === playerId
  );
}

export function visibleMatchesForViewer(matches: any[], viewerPlayerId?: string | null): any[] {
  return matches.filter(
    (m) =>
      m.status === "confirmed" ||
      (m.status === "pending" && isMatchParticipant(m, viewerPlayerId))
  );
}
export function formatPlayerData(data: any) {
  return {
    id: data.id,
    fullName: data.full_name,
    nickname: data.nickname,
    avatar: data.avatar_url,
    department: data.department,
    joinedYear: data.joined_year,
    playingLevel: data.playing_level,
    dominantHand: data.dominant_hand,
    gender: data.gender,
    playingStyle: data.playing_style,
    favoriteShot: data.favorite_shot,
    favoriteIdol: data.favorite_idol,
    favoriteFormat: data.favorite_format,
    quote: data.quote,
    currentRacket: data.current_racket,
    racketDetails: data.racket_details || [],
    tournamentHistory: data.tournament_history || [],
    achievements: data.achievements || [],
    winLossRecord: (() => {
      const { wins, losses } = parseWinLossRecord(data.win_loss_record || data.stats);
      if (typeof data.win_loss_record === "string" && data.win_loss_record.includes("W") && data.win_loss_record.includes("-") && !data.win_loss_record.startsWith("{")) {
          return data.win_loss_record;
      }
      return `${wins}W - ${losses}L`;
    })(),
    nationality: data.nationality,
    homeState: data.home_state,
    height: data.height,
    yearsPlaying: data.years_playing,
    coach: data.coach,
    bio: data.bio,
    currentRanking: data.current_ranking,
    highestRanking: data.highest_ranking,
    stats: data.stats,
    recentForm: data.recent_form,
    recentMatches: data.recent_matches,
    frequentPartners: data.frequent_partners,
    careerHighlights: data.career_highlights,
    shoes:
      data.shoes && data.shoes.startsWith("[")
        ? JSON.parse(data.shoes).find((s: any) => s.primary)?.name ||
        JSON.parse(data.shoes)[0]?.name ||
        ""
        : data.shoes,
    shoesList: parseShoesList(data.shoes),
    apparel: data.apparel,
    social:
      data.instagram || data.email
        ? { instagram: data.instagram, email: data.email }
        : undefined,
    userId: data.id,
    isApproved: data.is_approved,
    role: data.role ?? 'player',
    buddies: data.buddies || [],
    buddyRequests: data.buddy_requests || [],
    elo_rating: data.elo_rating,
    singles_elo: data.singles_elo,
    doubles_elo: data.doubles_elo,
    mixed_elo: data.mixed_elo,
    singles_record: data.singles_record,
    doubles_record: data.doubles_record,
    mixed_record: data.mixed_record,
  };
}

