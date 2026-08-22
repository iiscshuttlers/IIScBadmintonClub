// Pure BWF Scoring Logic Engine

export type MatchFormat =
  | "BestOf3_21" // Best of 3 to 21
  | "BestOf3_15" // Best of 3 to 15
  | "Single_21"  // Single game to 21
  | "Single_31"; // Single game to 31

export interface ScoreState {
  t1Score: number;
  t2Score: number;
  serverTeam: 1 | 2;
  serverPlayerIndex: 0 | 1; // 0 or 1
  t1LastServedBy: 0 | 1; // Tracks who served last on team 1
  t2LastServedBy: 0 | 1; // Tracks who served last on team 2
  t1GamesWon: number;
  t2GamesWon: number;
  endsSwapped: boolean; // True if teams have switched physical sides
}

export class ScoringLogic {
  format: MatchFormat;
  state: ScoreState;
  history: ScoreState[];

  constructor(format: MatchFormat = "BestOf3_21", initialState?: Partial<ScoreState>) {
    this.format = format;
    this.state = {
      t1Score: 0,
      t2Score: 0,
      serverTeam: 1,
      serverPlayerIndex: 0,
      t1LastServedBy: 1, // Defaulting to 1 to match UmpireEngine.tsx init
      t2LastServedBy: 1,
      t1GamesWon: 0,
      t2GamesWon: 0,
      endsSwapped: false,
      ...initialState
    };
    this.history = [];
  }

  // --- Helpers to determine match rules ---
  get isBestOf3() { return this.format.startsWith("BestOf3"); }
  get targetScore() { return parseInt(this.format.split("_")[1]); }
  get maxScore() { return this.targetScore === 21 ? 30 : this.targetScore === 15 ? 21 : 40; }

  // --- State Mutators ---

  /** Save current state to history before mutating */
  saveHistory() {
    this.history.push({ ...this.state });
  }

  /** Undo the last point/action */
  undo() {
    if (this.history.length > 0) {
      this.state = this.history.pop()!;
      return true;
    }
    return false;
  }

  /** Team 1 scores a point */
  addT1Score(isT1Doubles: boolean) {
    if (this.isMatchComplete() || this.isGameComplete()) return;
    this.saveHistory();

    this.state.t1Score += 1;
    if (this.state.serverTeam === 1) {
      // Same server continues.
      this.state.t1LastServedBy = this.state.serverPlayerIndex;
    } else {
      // Service changes to T1. Court positions live in the match state
      // (t1RightCourt/t2RightCourt), which computeAddPoint maintains.
      this.state.serverTeam = 1;
      this.state.serverPlayerIndex = isT1Doubles ? (this.state.t1LastServedBy === 0 ? 1 : 0) : 0;
      this.state.t1LastServedBy = this.state.serverPlayerIndex;
      
    }
  }

  /** Team 2 scores a point */
  addT2Score(isT2Doubles: boolean) {
    if (this.isMatchComplete() || this.isGameComplete()) return;
    this.saveHistory();

    this.state.t2Score += 1;
    if (this.state.serverTeam === 2) {
      // Same server continues.
      this.state.t2LastServedBy = this.state.serverPlayerIndex;
    } else {
      // Service changes to T2. Court positions live in the match state
      // (t1RightCourt/t2RightCourt), which computeAddPoint maintains.
      this.state.serverTeam = 2;
      this.state.serverPlayerIndex = isT2Doubles ? (this.state.t2LastServedBy === 0 ? 1 : 0) : 0;
      this.state.t2LastServedBy = this.state.serverPlayerIndex;
      
    }
  }

  /** Deduct point from T1 (fault/correction) */
  minusT1Score() {
    // Usually undo is preferred over minus score, but keeping for direct manipulation
    if (this.state.t1Score > 0) {
      this.saveHistory();
      this.state.t1Score -= 1;
    }
  }

  /** Deduct point from T2 (fault/correction) */
  minusT2Score() {
    if (this.state.t2Score > 0) {
      this.saveHistory();
      this.state.t2Score -= 1;
    }
  }

  // --- Rule Checks ---
  
  isGameComplete() {
    const s1 = this.state.t1Score;
    const s2 = this.state.t2Score;
    const t = this.targetScore;
    const m = this.maxScore;

    if (s1 >= t || s2 >= t) {
      if (Math.abs(s1 - s2) >= 2) return true;
      if (s1 >= m || s2 >= m) return true;
    }
    return false;
  }

  isMatchComplete() {
    if (this.isBestOf3) {
      const gamesToWin = Math.ceil((this.format.startsWith("BestOf3") ? 3 : 1) / 2);
      return this.state.t1GamesWon >= gamesToWin || this.state.t2GamesWon >= gamesToWin;
    } else {
      return this.isGameComplete();
    }
  }
}
