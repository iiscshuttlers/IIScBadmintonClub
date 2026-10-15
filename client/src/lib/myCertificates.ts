import type { CertificateInput, Placement } from "./certificate";

/**
 * Every certificate a person earned in one tournament: a podium certificate per
 * category they medalled in, a participation certificate per category they
 * played without medalling, and an officiating certificate per official role.
 */

export interface CertMatch {
  category: string | null;
  round_name: string | null;
  match_code: string | null;
  status: string | null;
  winner_side: number | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
}

const isThirdPlace = (m: CertMatch) => /3rd|third/i.test(m.round_name ?? "") || /_3RD_/i.test(m.match_code ?? "");
const isFinal = (m: CertMatch) =>
  !isThirdPlace(m) && (/(^|\s)(grand\s+)?final$/i.test((m.round_name ?? "").trim()) || /_F_\d+$/i.test(m.match_code ?? ""));

function sideOf(m: CertMatch, uid: string): 1 | 2 | null {
  if (m.player1_id === uid || m.player3_id === uid) return 1;
  if (m.player2_id === uid || m.player4_id === uid) return 2;
  return null;
}

/** "Semifinal 2" → "Semi-finalist", "Quarterfinal" → "Quarter-finalist". */
export function stageReached(round: string | null): string | null {
  const r = (round ?? "").toLowerCase();
  if (/semi/.test(r)) return "Semi-finalist";
  if (/quarter/.test(r)) return "Quarter-finalist";
  if (/round of 16|pre-?quarter/.test(r)) return "Pre-quarter-finalist";
  return null;
}

const ROLE_TITLES: Record<string, string> = { UMPIRE: "Umpire", REFEREE: "Referee", ORGANIZER: "Organiser" };

export function computeMyCertificates(opts: {
  uid: string;
  name: string;
  tournamentName: string;
  date?: string;
  matches: CertMatch[];
  officialRoles: string[];
}): CertificateInput[] {
  const { uid, name, tournamentName, date } = opts;
  const base = { recipient: name, tournamentName, date };
  const out: CertificateInput[] = [];

  const byCategory = new Map<string, CertMatch[]>();
  for (const m of opts.matches) {
    if (!sideOf(m, uid)) continue;
    const c = m.category || "Open";
    byCategory.set(c, [...(byCategory.get(c) ?? []), m]);
  }

  for (const [category, ms] of Array.from(byCategory)) {
    const done = ms.filter((m) => (m.status === "completed" || m.status === "walkover") && m.winner_side);
    let placement: Placement | null = null;
    for (const m of done) {
      const won = m.winner_side === sideOf(m, uid);
      if (isFinal(m)) placement = won ? "winner" : "runnerUp";
      else if (isThirdPlace(m) && !placement) placement = won ? "third" : "fourth";
    }
    if (placement) {
      out.push({ ...base, placement, category });
      continue;
    }
    if (!done.length) continue; // only byes / unplayed — nothing to certify
    const lost = done.find((m) => m.winner_side !== sideOf(m, uid));
    out.push({ ...base, placement: "participation", category, achievement: stageReached(lost?.round_name ?? null) ?? undefined });
  }

  for (const role of Array.from(new Set(opts.officialRoles.map((r) => r.toUpperCase())))) {
    out.push({ ...base, placement: "official", category: "Tournament Official", achievement: ROLE_TITLES[role] ?? role });
  }
  return out;
}
