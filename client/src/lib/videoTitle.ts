/**
 * Player names for the video scoreboard overlay, read from a video title:
 *   "Radhika and Kaling vs Tanisha and Aneesh || XD Finals"
 *   "A & B vs C & D"   (videos auto-added from YouTube)
 *   "Men's Doubles Semifinal: A & B vs C & D | Open Tournament 2026"
 * Returns null when the title has no single "X vs Y".
 * Title splitting for the YouTube sync lives in supabase/functions/_shared/youtubeFeed.ts.
 */
export function parseTeamsFromTitle(title: string): { teamA: string[]; teamB: string[] } | null {
  let match = title.split("|").find((p) => /\svs\.?\s/i.test(p))?.trim() ?? "";
  const colon = match.indexOf(":");
  if (colon > 0 && colon < match.search(/\svs\.?\s/i)) match = match.slice(colon + 1).trim();
  const sides = match.split(/\s+vs\.?\s+/i);
  if (sides.length !== 2) return null;
  const team = (s: string) => s.split(/\s+(?:and|&)\s+/i).map((n) => n.trim()).filter(Boolean);
  const teamA = team(sides[0]);
  const teamB = team(sides[1]);
  return teamA.length > 0 && teamB.length > 0 ? { teamA, teamB } : null;
}
