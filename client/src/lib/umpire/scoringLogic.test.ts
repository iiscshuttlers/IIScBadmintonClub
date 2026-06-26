import { describe, it, expect } from "vitest";
import { ScoringLogic } from "./scoringLogic";

describe("ScoringLogic", () => {
  it("should initialize with default state", () => {
    const logic = new ScoringLogic();
    expect(logic.format).toBe("BestOf3_21");
    expect(logic.state.t1Score).toBe(0);
    expect(logic.state.t2Score).toBe(0);
    expect(logic.state.serverTeam).toBe(1);
    expect(logic.isGameComplete()).toBe(false);
  });

  it("should add score to T1 and continue serving if T1 was already serving", () => {
    const logic = new ScoringLogic();
    logic.addT1Score(true); // T1 doubles
    expect(logic.state.t1Score).toBe(1);
    expect(logic.state.serverTeam).toBe(1);
    expect(logic.state.serverPlayerIndex).toBe(0); // same server
  });

  it("should change service to T2 and swap server index correctly", () => {
    const logic = new ScoringLogic();
    // T1 serves, T2 scores -> Service over
    logic.addT2Score(true); // T2 doubles
    expect(logic.state.t2Score).toBe(1);
    expect(logic.state.serverTeam).toBe(2);
    // Based on logic in addT2Score: isT2Doubles ? (t2LastServedBy === 0 ? 1 : 0) : 0
    // Default t2LastServedBy is 1, so 1 === 0 is false -> serverPlayerIndex = 0
    expect(logic.state.serverPlayerIndex).toBe(0);
  });

  it("should detect game complete at 21 points", () => {
    const logic = new ScoringLogic("BestOf3_21", {
      t1Score: 20,
      t2Score: 19
    });
    expect(logic.isGameComplete()).toBe(false);
    logic.addT1Score(true);
    expect(logic.state.t1Score).toBe(21);
    expect(logic.isGameComplete()).toBe(true);
  });

  it("should require win by 2 at 20-20 (deuce)", () => {
    const logic = new ScoringLogic("BestOf3_21", {
      t1Score: 20,
      t2Score: 20
    });
    logic.addT1Score(true);
    expect(logic.state.t1Score).toBe(21);
    expect(logic.isGameComplete()).toBe(false); // 21-20 is not win by 2

    logic.addT1Score(true);
    expect(logic.state.t1Score).toBe(22);
    expect(logic.isGameComplete()).toBe(true); // 22-20 is win by 2
  });

  it("should cap score at 30 (win at 30-29)", () => {
    const logic = new ScoringLogic("BestOf3_21", {
      t1Score: 29,
      t2Score: 29
    });
    logic.addT1Score(true);
    expect(logic.state.t1Score).toBe(30);
    expect(logic.isGameComplete()).toBe(true); // Cap reached
  });

  it("should support BestOf3_15 format", () => {
    const logic = new ScoringLogic("BestOf3_15", {
      t1Score: 14,
      t2Score: 10
    });
    logic.addT1Score(true);
    expect(logic.state.t1Score).toBe(15);
    expect(logic.isGameComplete()).toBe(true);
  });

  it("should undo last score addition", () => {
    const logic = new ScoringLogic();
    logic.addT1Score(true);
    expect(logic.state.t1Score).toBe(1);
    
    const success = logic.undo();
    expect(success).toBe(true);
    expect(logic.state.t1Score).toBe(0);
  });

  it("should deduct score directly via minusT1Score", () => {
    const logic = new ScoringLogic("BestOf3_21", {
      t1Score: 5
    });
    logic.minusT1Score();
    expect(logic.state.t1Score).toBe(4);
  });
});
