import type { MatchView } from "@/lib/matchView";

export type StoryType = "champions" | "upset" | "thriller" | "day_summary";

export interface FactualStoryItem {
  id: string;
  type: StoryType;
  headline: string;
  body: string;
  discipline?: string | null;
  supportingMatchIds: string[];
  /** Deterministic snapshot of the computed facts used for review/revalidation. */
  sourceFingerprint: string;
  facts: {
    winnerLabel?: string;
    runnerUpLabel?: string;
    score?: string;
    round?: string;
    details?: string;
  };
}

export interface TournamentStoryDraft {
  tournamentId: string;
  tournamentName: string;
  generatedAt: string;
  items: FactualStoryItem[];
}

export type StoryReviewStatus = "draft" | "reviewed" | "published" | "needs_review";

export interface TournamentStoryReview {
  draft: TournamentStoryDraft;
  status: StoryReviewStatus;
  reviewedAt: string | null;
  publishedAt: string | null;
  invalidatedItemIds: string[];
}

function sourceFingerprint(match: MatchView): string {
  return JSON.stringify({
    id: match.id,
    state: match.state,
    winner: match.sides.find((side) => side.isWinner)?.playerIds ?? [],
    score: match.scoreText,
    games: match.games,
    round: match.roundName,
    discipline: match.discipline,
  });
}

/**
 * Builds factual stories from verified completed match records.
 * Follows WC-08 deterministic facts without invented commentary.
 */
export function buildTournamentStoryDraft(
  tournament: { id: string; name: string },
  matches: MatchView[]
): TournamentStoryDraft {
  const completed = matches.filter((m) => m.state === "completed" && m.sides.some((s) => s.isWinner));
  const items: FactualStoryItem[] = [];

  // 1. Champions & Finalists
  const finals = completed.filter((m) => /final\b/i.test(m.roundName) && !/semi|quarter/i.test(m.roundName));
  for (const m of finals) {
    const winner = m.sides.find((s) => s.isWinner);
    const runnerUp = m.sides.find((s) => !s.isWinner && !s.isBye);
    if (!winner || !runnerUp) continue;

    const disc = m.discipline ?? m.categoryLabel ?? "Event";
    const scoreStr = m.scoreText || m.games.map((g) => `${g.side1}-${g.side2}`).join(", ");

    items.push({
      id: `champ-${m.id}`,
      type: "champions",
      headline: `${winner.label} crowned ${disc} Champion`,
      body: `${winner.label} defeated ${runnerUp.label} in the ${disc} final (${scoreStr}).`,
      discipline: m.discipline,
      supportingMatchIds: [m.id],
      sourceFingerprint: sourceFingerprint(m),
      facts: {
        winnerLabel: winner.label,
        runnerUpLabel: runnerUp.label,
        score: scoreStr,
        round: m.roundName,
      },
    });
  }

  // 2. Seed Upsets
  for (const m of completed) {
    const winner = m.sides.find((s) => s.isWinner);
    const loser = m.sides.find((s) => !s.isWinner && !s.isBye);
    if (!winner || !loser) continue;

    // Upset condition: winner is unseeded beating seed <= 4, or winner seed > loser seed
    const isUpset =
      (winner.seed === null && loser.seed !== null && loser.seed <= 4) ||
      (winner.seed !== null && loser.seed !== null && winner.seed > loser.seed);

    if (isUpset) {
      const disc = m.discipline ?? m.categoryLabel ?? "Event";
      const scoreStr = m.scoreText || m.games.map((g) => `${g.side1}-${g.side2}`).join(", ");
      const loserSeedStr = loser.seed ? `[Seed ${loser.seed}]` : "";
      const winnerSeedStr = winner.seed ? `[Seed ${winner.seed}]` : "Unseeded";

      items.push({
        id: `upset-${m.id}`,
        type: "upset",
        headline: `Seed Upset: ${winner.label} defeats ${loser.label}`,
        body: `${winnerSeedStr} ${winner.label} secured victory over ${loserSeedStr} ${loser.label} in the ${m.roundName} (${scoreStr}).`,
        discipline: m.discipline,
        supportingMatchIds: [m.id],
        sourceFingerprint: sourceFingerprint(m),
        facts: {
          winnerLabel: winner.label,
          runnerUpLabel: loser.label,
          score: scoreStr,
          round: m.roundName,
          details: `${winnerSeedStr} def. ${loserSeedStr}`,
        },
      });
    }
  }

  // 3. Thrillers / Deciding 3rd Games with tight margins
  for (const m of completed) {
    if (m.games.length === 3) {
      const g3 = m.games[2];
      const diff = Math.abs(g3.side1 - g3.side2);
      if (diff <= 2) {
        const winner = m.sides.find((s) => s.isWinner);
        const loser = m.sides.find((s) => !s.isWinner);
        if (!winner || !loser) continue;

        const scoreStr = m.games.map((g) => `${g.side1}-${g.side2}`).join(", ");
        items.push({
          id: `thriller-${m.id}`,
          type: "thriller",
          headline: `Three-game thriller: ${winner.label} edges ${loser.label}`,
          body: `A tightly contested 3-game battle concluded with ${winner.label} winning ${scoreStr}.`,
          discipline: m.discipline,
          supportingMatchIds: [m.id],
          sourceFingerprint: sourceFingerprint(m),
          facts: {
            winnerLabel: winner.label,
            runnerUpLabel: loser.label,
            score: scoreStr,
            round: m.roundName,
          },
        });
      }
    }
  }

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    generatedAt: new Date().toISOString(),
    items,
  };
}

/**
 * Checks whether an existing story item is invalidated by a match score correction.
 */
export function isStoryInvalidated(
  item: FactualStoryItem,
  correctedMatchIds: string[]
): boolean {
  return item.supportingMatchIds.some((id) => correctedMatchIds.includes(id));
}

/** New drafts are private until an organiser explicitly reviews and publishes them. */
export function createStoryReview(draft: TournamentStoryDraft): TournamentStoryReview {
  return { draft, status: "draft", reviewedAt: null, publishedAt: null, invalidatedItemIds: [] };
}

export function markStoryReviewed(review: TournamentStoryReview, reviewedAt = new Date().toISOString()): TournamentStoryReview {
  return { ...review, status: "reviewed", reviewedAt, publishedAt: null, invalidatedItemIds: [] };
}

/**
 * Rechecks every computed item against a freshly generated draft. Changed or
 * removed facts return the story to review instead of silently staying public.
 */
export function reconcileStoryReview(
  review: TournamentStoryReview,
  latestDraft: TournamentStoryDraft,
): TournamentStoryReview {
  const latest = new Map(latestDraft.items.map((item) => [item.id, item.sourceFingerprint]));
  const invalidatedItemIds = review.draft.items
    .filter((item) => latest.get(item.id) !== item.sourceFingerprint)
    .map((item) => item.id);
  return {
    ...review,
    draft: latestDraft,
    status: invalidatedItemIds.length > 0 ? "needs_review" : review.status,
    publishedAt: invalidatedItemIds.length > 0 ? null : review.publishedAt,
    invalidatedItemIds,
  };
}

export function publishStoryReview(review: TournamentStoryReview, publishedAt = new Date().toISOString()): TournamentStoryReview {
  if (review.status !== "reviewed" || review.invalidatedItemIds.length > 0) {
    throw new Error("Story must be reviewed against current match facts before publication");
  }
  return { ...review, status: "published", publishedAt };
}

// ── Publication (WC-08) ─────────────────────────────────────────────────────
//
// Only the published story is stored, in the public-read / admin-write
// `site_data` table. Drafts are regenerated from match data in the organiser's
// browser and never written, so they cannot leak through the public read.

export const STORY_EDITORIAL_NOTE_MAX = 500;

export function storySiteDataKey(tournamentId: string): string {
  return `tournament_story:${tournamentId}`;
}

/** Plain-JSON record stored under `storySiteDataKey`. */
export interface PublishedStoryRecord {
  version: 1;
  tournamentId: string;
  publishedAt: string;
  /** Organiser wording, shown separately from the computed facts. */
  editorialNote: string;
  /** Computed items exactly as reviewed, including their source fingerprints. */
  items: FactualStoryItem[];
}

/**
 * Builds the record to publish from the organiser's selection. Items are taken
 * from a freshly generated draft so publication re-checks facts at that time.
 */
export function buildPublishedStoryRecord(
  latestDraft: TournamentStoryDraft,
  selectedItemIds: readonly string[],
  editorialNote: string,
  publishedAt = new Date().toISOString(),
): PublishedStoryRecord {
  const selected = new Set(selectedItemIds);
  const items = latestDraft.items.filter((item) => selected.has(item.id));
  if (items.length === 0) throw new Error("Select at least one verified story item to publish");
  return {
    version: 1,
    tournamentId: latestDraft.tournamentId,
    publishedAt,
    editorialNote: editorialNote.trim().slice(0, STORY_EDITORIAL_NOTE_MAX),
    items,
  };
}

export function parsePublishedStoryRecord(value: unknown, tournamentId: string): PublishedStoryRecord | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<PublishedStoryRecord>;
  if (v.version !== 1 || v.tournamentId !== tournamentId || !Array.isArray(v.items)) return null;
  if (typeof v.publishedAt !== "string") return null;
  const items = v.items.filter(
    (item): item is FactualStoryItem =>
      !!item &&
      typeof item.id === "string" &&
      typeof item.headline === "string" &&
      typeof item.body === "string" &&
      typeof item.sourceFingerprint === "string" &&
      Array.isArray(item.supportingMatchIds),
  );
  return {
    version: 1,
    tournamentId,
    publishedAt: v.publishedAt,
    editorialNote: typeof v.editorialNote === "string" ? v.editorialNote.slice(0, STORY_EDITORIAL_NOTE_MAX) : "",
    items,
  };
}

export interface PublicStoryView {
  /** Items whose facts still match current results. */
  visible: FactualStoryItem[];
  /** Published items withheld because a supporting result changed or vanished. */
  withheldItemIds: string[];
}

/**
 * Public rendering rule: every published item is re-checked against a draft
 * built from current results. Anything whose fingerprint changed is withheld,
 * so a corrected final can never keep showing the old champion.
 */
export function publicStoryView(record: PublishedStoryRecord, latestDraft: TournamentStoryDraft): PublicStoryView {
  const latest = new Map(latestDraft.items.map((item) => [item.id, item.sourceFingerprint]));
  const visible: FactualStoryItem[] = [];
  const withheldItemIds: string[] = [];
  for (const item of record.items) {
    if (latest.get(item.id) === item.sourceFingerprint) visible.push(item);
    else withheldItemIds.push(item.id);
  }
  return { visible, withheldItemIds };
}

