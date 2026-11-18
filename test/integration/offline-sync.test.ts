import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BwfMatchState } from "@/types/umpire";

const nativeState = vi.hoisted(() => ({
  preferences: new Map<string, string>(),
  appStateListeners: [] as Array<(state: { isActive: boolean }) => void>,
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: nativeState.preferences.get(key) ?? null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      nativeState.preferences.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      nativeState.preferences.delete(key);
    }),
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn((_event: string, listener: (state: { isActive: boolean }) => void) => {
      nativeState.appStateListeners.push(listener);
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/services/umpireService", () => ({
  umpireService: {
    upsertLiveMatch: vi.fn(),
  },
}));

import { Preferences } from "@capacitor/preferences";
import { umpireService } from "@/services/umpireService";
import { useOfflineUmpireSync } from "@/hooks/useOfflineUmpireSync";
import type { QueuedUmpireAction } from "@/lib/umpire/offlineQueue";

const QUEUE_KEY = "umpire_offline_queue_v1";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

function matchState(id: string, score: number): BwfMatchState {
  return {
    id,
    status: "playing",
    category: "MS",
    bestOfSets: 3,
    t1: { p1Name: "Player A", score, games: 0 },
    t2: { p1Name: "Player B", score: 0, games: 0 },
    serverTeam: 1,
    serverPlayerIndex: 0,
    receiverPlayerIndex: 0,
    t1LastServedBy: 0,
    t2LastServedBy: 0,
    endsSwapped: false,
    pointLog: [],
    setsHistory: [],
  } as BwfMatchState;
}

function queuedAction(
  id: string,
  matchId: string,
  ownerId: string,
  score: number,
): QueuedUmpireAction {
  return {
    id,
    matchId,
    ownerId,
    timestamp: Date.now(),
    matchState: matchState(matchId, score),
  };
}

function seedQueue(items: QueuedUmpireAction[]) {
  nativeState.preferences.set(QUEUE_KEY, JSON.stringify(items));
}

function readQueue(): QueuedUmpireAction[] {
  return JSON.parse(nativeState.preferences.get(QUEUE_KEY) ?? "[]") as QueuedUmpireAction[];
}

describe("offline umpire sync integration", () => {
  beforeEach(() => {
    nativeState.preferences.clear();
    nativeState.appStateListeners.length = 0;
    vi.clearAllMocks();
    setOnline(false);
  });

  it("persists and coalesces production snapshots without disturbing another owner", async () => {
    seedQueue([queuedAction("other", "match-1", "umpire-2", 7)]);
    const { result } = renderHook(() => useOfflineUmpireSync("umpire-1"));

    await waitFor(() => expect(result.current.queuedCount).toBe(0));

    await act(async () => {
      await result.current.queueMatchStateUpdate("match-1", matchState("match-1", 10));
      await result.current.queueMatchStateUpdate("match-1", matchState("match-1", 11));
    });

    const persisted = readQueue();
    expect(persisted).toHaveLength(2);
    expect(persisted.find((item) => item.ownerId === "umpire-2")?.id).toBe("other");
    expect(persisted.find((item) => item.ownerId === "umpire-1")?.matchState.t1.score).toBe(11);
    expect(result.current.queuedCount).toBe(1);
    expect(result.current.syncStatus).toBe("saved-locally");
  });

  it("acknowledges only the current owner's successfully flushed snapshots", async () => {
    seedQueue([
      queuedAction("mine", "match-1", "umpire-1", 12),
      queuedAction("other", "match-1", "umpire-2", 8),
    ]);
    vi.mocked(umpireService.upsertLiveMatch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useOfflineUmpireSync("umpire-1"));

    await waitFor(() => expect(result.current.queuedCount).toBe(1));
    await act(async () => result.current.flushOfflineQueue());

    expect(umpireService.upsertLiveMatch).toHaveBeenCalledTimes(1);
    expect(umpireService.upsertLiveMatch).toHaveBeenCalledWith(
      "match-1",
      expect.objectContaining({ t1: expect.objectContaining({ score: 12 }) }),
    );
    expect(readQueue().map((item) => item.id)).toEqual(["other"]);
    expect(result.current.queuedCount).toBe(0);
    expect(result.current.syncStatus).toBe("confirmed");
  });

  it("keeps failed snapshots and retries them successfully", async () => {
    seedQueue([queuedAction("retry-me", "match-1", "umpire-1", 13)]);
    vi.mocked(umpireService.upsertLiveMatch)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useOfflineUmpireSync("umpire-1"));

    await waitFor(() => expect(result.current.queuedCount).toBe(1));
    await act(async () => result.current.flushOfflineQueue());

    expect(readQueue().map((item) => item.id)).toEqual(["retry-me"]);
    expect(result.current.syncStatus).toBe("error");

    await act(async () => result.current.flushOfflineQueue());

    expect(umpireService.upsertLiveMatch).toHaveBeenCalledTimes(2);
    expect(nativeState.preferences.has(QUEUE_KEY)).toBe(false);
    expect(result.current.syncStatus).toBe("confirmed");
  });

  it("preserves a newer snapshot queued while an older snapshot is in flight", async () => {
    seedQueue([queuedAction("old", "match-1", "umpire-1", 14)]);
    let releaseWrite: (() => void) | undefined;
    vi.mocked(umpireService.upsertLiveMatch).mockImplementation(
      () => new Promise<void>((resolve) => { releaseWrite = resolve; }),
    );
    const { result } = renderHook(() => useOfflineUmpireSync("umpire-1"));

    await waitFor(() => expect(result.current.queuedCount).toBe(1));
    let flushPromise: Promise<void> | undefined;
    act(() => {
      flushPromise = result.current.flushOfflineQueue();
    });
    await waitFor(() => expect(umpireService.upsertLiveMatch).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.queueMatchStateUpdate("match-1", matchState("match-1", 15));
    });
    await act(async () => {
      releaseWrite?.();
      await flushPromise;
    });

    const remaining = readQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe("old");
    expect(remaining[0].matchState.t1.score).toBe(15);
    expect(result.current.queuedCount).toBe(1);
  });

  it("flushes persisted snapshots when connectivity returns", async () => {
    seedQueue([queuedAction("online", "match-1", "umpire-1", 16)]);
    vi.mocked(umpireService.upsertLiveMatch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useOfflineUmpireSync("umpire-1"));

    await waitFor(() => expect(result.current.isOffline).toBe(true));
    setOnline(true);
    act(() => window.dispatchEvent(new Event("online")));

    await waitFor(() => expect(result.current.syncStatus).toBe("confirmed"));
    expect(result.current.isOffline).toBe(false);
    expect(nativeState.preferences.has(QUEUE_KEY)).toBe(false);
  });

  it("flushes persisted snapshots when the native app resumes online", async () => {
    seedQueue([queuedAction("resume", "match-1", "umpire-1", 17)]);
    setOnline(true);
    vi.mocked(umpireService.upsertLiveMatch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useOfflineUmpireSync("umpire-1"));

    await waitFor(() => expect(nativeState.appStateListeners).toHaveLength(1));
    act(() => nativeState.appStateListeners[0]({ isActive: true }));

    await waitFor(() => expect(result.current.syncStatus).toBe("confirmed"));
    expect(umpireService.upsertLiveMatch).toHaveBeenCalledTimes(1);
    expect(nativeState.preferences.has(QUEUE_KEY)).toBe(false);
  });

  it("persists queue mutations through the Capacitor Preferences boundary", async () => {
    const { result } = renderHook(() => useOfflineUmpireSync("umpire-1"));

    await act(async () => {
      await result.current.queueMatchStateUpdate("match-1", matchState("match-1", 18));
    });

    expect(Preferences.set).toHaveBeenCalledWith(expect.objectContaining({ key: QUEUE_KEY }));
    await act(async () => result.current.clearMatchFromQueue("match-1"));
    expect(Preferences.remove).toHaveBeenCalledWith({ key: QUEUE_KEY });
  });
});
