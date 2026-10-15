/**
 * Officiating record for a player: matches umpired (tournament_matches.umpired_by),
 * tournaments, finals, and tiered badges. Badge "earned" dates come from the
 * match that crossed the threshold, so nothing needs persisting.
 */

export interface UmpiredMatch {
  id: string;
  tournament_id: string;
  category: string | null;
  round_name: string | null;
  team1_label: string | null;
  team2_label: string | null;
  score: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  scheduled_at: string | null;
  tournaments?: { name: string | null } | null;
}

export interface UmpireBadge {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  earnedAt?: string;
  current: number;
  target: number;
}

export interface UmpireRecord {
  matches: number;
  tournaments: number;
  finals: number;
  busiestDay?: { date: string; matches: number };
  badges: UmpireBadge[];
  recent: UmpiredMatch[];
}

const when = (m: UmpiredMatch) => m.ended_at || m.started_at || m.scheduled_at || "";
const isFinal = (m: UmpiredMatch) => /^final$/i.test((m.round_name ?? "").trim());
/** Local calendar day in IST, the club's timezone. */
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const TIERS = [
  { id: "ump_first_whistle", label: "First Whistle", description: "Umpired your first match", target: 1 },
  { id: "ump_regular", label: "Regular Official", description: "Umpire 10 matches", target: 10 },
  { id: "ump_seasoned", label: "Seasoned Umpire", description: "Umpire 25 matches", target: 25 },
  { id: "ump_chief", label: "Chief Umpire", description: "Umpire 50 matches", target: 50 },
];

export function computeUmpireRecord(all: UmpiredMatch[]): UmpireRecord {
  const done = all
    .filter((m) => m.status === "completed" || m.status === "walkover")
    .sort((a, b) => when(a).localeCompare(when(b)));

  const badges: UmpireBadge[] = TIERS.map((t) => {
    const hit = done[t.target - 1];
    return { ...t, earned: !!hit, earnedAt: hit ? when(hit) || undefined : undefined, current: Math.min(done.length, t.target) };
  });

  const finals = done.filter(isFinal);
  badges.push({
    id: "ump_big_stage",
    label: "Big Stage",
    description: "Umpire a final",
    target: 1,
    current: Math.min(finals.length, 1),
    earned: finals.length > 0,
    earnedAt: finals[0] ? when(finals[0]) || undefined : undefined,
  });

  // Marathon: 8+ matches in one day.
  const perDay = new Map<string, UmpiredMatch[]>();
  for (const m of done) {
    const w = when(m);
    if (!w) continue;
    const k = dayKey(w);
    perDay.set(k, [...(perDay.get(k) ?? []), m]);
  }
  let busiest: { date: string; matches: number } | undefined;
  let marathonAt: string | undefined;
  for (const [date, list] of perDay) {
    if (!busiest || list.length > busiest.matches) busiest = { date, matches: list.length };
    if (list.length >= 8) {
      const at = when(list[7]);
      if (!marathonAt || at < marathonAt) marathonAt = at;
    }
  }
  badges.push({
    id: "ump_marathon",
    label: "Marathon Day",
    description: "Umpire 8 matches in a single day",
    target: 8,
    current: Math.min(busiest?.matches ?? 0, 8),
    earned: !!marathonAt,
    earnedAt: marathonAt,
  });

  // Multi-event: officiated at 3 different tournaments.
  const firstPerTournament = new Map<string, string>();
  for (const m of done) if (!firstPerTournament.has(m.tournament_id)) firstPerTournament.set(m.tournament_id, when(m));
  const tournamentDates = Array.from(firstPerTournament.values()).sort();
  badges.push({
    id: "ump_circuit",
    label: "On the Circuit",
    description: "Umpire at 3 different tournaments",
    target: 3,
    current: Math.min(firstPerTournament.size, 3),
    earned: firstPerTournament.size >= 3,
    earnedAt: tournamentDates[2] || undefined,
  });

  return {
    matches: done.length,
    tournaments: firstPerTournament.size,
    finals: finals.length,
    busiestDay: busiest,
    badges,
    recent: [...done].reverse().slice(0, 8),
  };
}
