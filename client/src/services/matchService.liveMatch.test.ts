import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BwfMatchState } from "@/types/umpire";

const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    channel: () => ({ send: () => {} }),
  },
}));

const { MatchService } = await import("./matchService");

const stateAt = (score: number) => ({ id: "m1", t1: { score } } as unknown as BwfMatchState);

/** Track settlement without awaiting, so a promise that never settles is visible. */
function watch(p: Promise<void>) {
  const seen = { settled: false, rejected: false };
  p.then(() => { seen.settled = true; }, () => { seen.settled = true; seen.rejected = true; });
  return seen;
}

const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe("upsertLiveMatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });
  afterEach(() => { vi.useRealTimers(); });

  it("debounces rapid scoring into one write of the newest state", async () => {
    void MatchService.upsertLiveMatch("m1", stateAt(1));
    void MatchService.upsertLiveMatch("m1", stateAt(2));
    void MatchService.upsertLiveMatch("m1", stateAt(3));

    expect(rpc).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].match_state.t1.score).toBe(3);
  });

  it("settles superseded callers instead of leaving them pending", async () => {
    // A superseded call used to keep its promise forever unresolved, so the
    // caller's `await` never returned and the tournament-score sync that runs
    // after it was skipped for every point but the last.
    const first = watch(MatchService.upsertLiveMatch("m1", stateAt(1)));
    const second = watch(MatchService.upsertLiveMatch("m1", stateAt(2)));

    await vi.advanceTimersByTimeAsync(500);
    await tick();

    expect(first.settled).toBe(true);
    expect(second.settled).toBe(true);
    expect(first.rejected).toBe(false);
  });

  it("reports a failed write to every waiting caller", async () => {
    rpc.mockResolvedValue({ error: new Error("offline") });
    const first = watch(MatchService.upsertLiveMatch("m1", stateAt(1)));
    const second = watch(MatchService.upsertLiveMatch("m1", stateAt(2)));

    await vi.advanceTimersByTimeAsync(500);
    await tick();

    expect(first.rejected).toBe(true);
    expect(second.rejected).toBe(true);
  });

  it("flushes a pending score immediately, before the debounce elapses", async () => {
    // Backgrounding a mobile tab suspends timers, so the pending write has to
    // be forced out rather than waiting for the 500ms window.
    const pending = watch(MatchService.upsertLiveMatch("m1", stateAt(7)));
    expect(rpc).not.toHaveBeenCalled();

    await MatchService.flushLiveMatches();
    await tick();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].match_state.t1.score).toBe(7);
    expect(pending.settled).toBe(true);

    // The cancelled timer must not fire a second, redundant write.
    await vi.advanceTimersByTimeAsync(500);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps separate matches independent", async () => {
    void MatchService.upsertLiveMatch("m1", stateAt(1));
    void MatchService.upsertLiveMatch("m2", stateAt(2));

    await vi.advanceTimersByTimeAsync(500);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map(c => c[1].p_match_id).sort()).toEqual(["m1", "m2"]);
  });

  it("does nothing when there is nothing pending to flush", async () => {
    await MatchService.flushLiveMatches();
    expect(rpc).not.toHaveBeenCalled();
  });
});
