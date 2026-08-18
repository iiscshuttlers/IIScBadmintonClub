import type { PlayerSlim as Player } from "@/types";

// Shape of a DB match row passed into edit mode (distinct from BwfMatchState)
export type MatchEditState = {
  is_edit_mode: true;
  is_tournament_match?: boolean;
  id: string;
  player1_id: string;
  player2_id: string;
  team1_partner_id?: string | null;
  team2_partner_id?: string | null;
  winner_id?: string | null;
  score?: string | null;
  match_score?: string | null;
  round?: string | null;
  is_friendly?: boolean | null;
  category?: string;
  sets_history?: string[] | null;
  player1?: { full_name: string } | null;
  player2?: { full_name: string } | null;
  partner1?: { full_name: string } | null;
  partner2?: { full_name: string } | null;
  team1_label?: string | null;
  team2_label?: string | null;
};

/** Serve/receive state captured immediately BEFORE a rally, so it can be
 *  restored exactly when an umpire deducts that point. */
export type ServeSnapshot = {
  serverTeam: 1 | 2;
  serverPlayerIndex: 0 | 1;
  receiverPlayerIndex: 0 | 1;
  receiverP0AtTop: boolean;
  t1LastServedBy: 0 | 1;
  t2LastServedBy: 0 | 1;
  /** Which player (0|1) currently stands in each team's right service court. */
  t1RightCourt?: 0 | 1;
  t2RightCourt?: 0 | 1;
};

export type PointLogEntry = {
  gameNum: number;
  team: 1 | 2 | "let" | "fault";
  t1Score: number;
  t2Score: number;
  serverTeam: 1 | 2;
  note?: string;
  ts: number;
  /** Optional — absent on logs written before this was introduced, so undo
   *  falls back to score-only rollback for matches already in progress. */
  prev?: ServeSnapshot;
};

export type BwfMatchState = {
  id: string;
  umpireId: string;
  umpireName: string;
  isFriendly: boolean;
  isTournamentMatch?: boolean;
  matchNumber?: string;
  category: string;
  inferredCategory?: string;
  customCategory?: string;
  dbId?: string;
  pointsToWin: number;
  bestOfSets: number;
  goldenPoint: number;
  t1: { p1Id: string; p1Name: string; p2Id?: string; p2Name?: string; teamName?: string; score: number; games: number };
  t2: { p1Id: string; p1Name: string; p2Id?: string; p2Name?: string; teamName?: string; score: number; games: number };
  serverTeam: 1 | 2;
  serverPlayerIndex: 0 | 1;
  receiverPlayerIndex: 0 | 1;
  receiverP0AtTop: boolean;
  t1LastServedBy: 0 | 1;
  t2LastServedBy: 0 | 1;
  /** Which player (0|1) stands in each team's RIGHT service court.
   *  Authoritative basis for who serves and who receives: BWF 9.1.6 — the
   *  serving side swaps courts on winning a rally, the receiving side never
   *  does; server and receiver then follow from score parity.
   *  Optional so matches already in progress keep working. */
  t1RightCourt?: 0 | 1;
  t2RightCourt?: 0 | 1;
  endsSwapped: boolean;
  pointLog: PointLogEntry[];
  status: "setup" | "playing" | "finished";
  winner?: 1 | 2;
  retiredTeam?: 1 | 2;
  setsHistory: string[];
  tournament?: string;
  takeoverRequest?: {
    requesterId: string;
    requesterName: string;
    status: "pending" | "approved" | "rejected";
  };
};

export type CardType = "yellow" | "red" | "black";
export type CardTarget = "t1p1" | "t1p2" | "t2p1" | "t2p2";

// ── Court Visual ──────────────────────────────────────────────────────────────

// ── Player Select ─────────────────────────────────────────────────────────────


// ── UmpireEngine ──────────────────────────────────────────────────────────────
