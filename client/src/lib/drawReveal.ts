/** Builds the first-round draw per category for the TV draw ceremony. */

export interface DrawMatch {
  id: string;
  category: string;
  round: number | null;
  round_name?: string | null;
  match_number: number | null;
  team1_label: string | null;
  team2_label: string | null;
  tie_id?: string | null;
}

export interface DrawPair {
  id: string;
  slot: number;
  side1: string;
  side2: string;
  isBye: boolean;
}

export interface CategoryDraw {
  category: string;
  roundName: string;
  pairs: DrawPair[];
}

const CATEGORY_ORDER = ["MS", "WS", "MD", "WD", "XD", "BS", "GS", "BD", "GD"];
const isBye = (l: string | null) => !!l && /\bbye\b/i.test(l);

export function buildDraw(matches: DrawMatch[]): CategoryDraw[] {
  const byCat = new Map<string, DrawMatch[]>();
  // Team-event rubbers aren't a draw; skip them.
  for (const m of matches) if (!m.tie_id) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m]);

  const out: CategoryDraw[] = [];
  for (const [category, list] of byCat) {
    const first = Math.min(...list.map((m) => m.round ?? Number.POSITIVE_INFINITY));
    const round = list
      .filter((m) => (m.round ?? Number.POSITIVE_INFINITY) === first)
      .sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0));
    if (round.length === 0) continue;
    out.push({
      category,
      roundName: round[0].round_name || "Round 1",
      pairs: round.map((m, i) => ({
        id: m.id,
        slot: i + 1,
        side1: m.team1_label || "TBD",
        side2: m.team2_label || "TBD",
        isBye: isBye(m.team1_label) || isBye(m.team2_label),
      })),
    });
  }
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c.toUpperCase());
    return i === -1 ? 99 : i;
  };
  return out.sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));
}
