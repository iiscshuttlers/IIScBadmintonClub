import { describe, expect, it } from "vitest";
import {
  enqueueLatestSnapshot,
  parseOfflineQueue,
  removeAcknowledgedSnapshots,
  removeSnapshotsForMatch,
  UNATTRIBUTED_OFFLINE_QUEUE_OWNER,
  type QueuedUmpireAction,
} from "./offlineQueue";

const action = (id: string, matchId: string, timestamp: number): QueuedUmpireAction => ({
  id,
  matchId,
  ownerId: "umpire-1",
  timestamp,
  matchState: { id: matchId } as QueuedUmpireAction["matchState"],
});

describe("offline umpire queue", () => {
  it("keeps only the latest snapshot for a match", () => {
    const queue = enqueueLatestSnapshot(
      [action("old", "match-1", 1), action("other", "match-2", 1)],
      action("new", "match-1", 2),
    );
    expect(queue.map((item) => item.id)).toEqual(["other", "new"]);
  });

  it("preserves a newer snapshot queued during an in-flight flush", () => {
    const current = [action("new", "match-1", 2), action("other", "match-2", 1)];
    const remaining = removeAcknowledgedSnapshots(current, new Set(["old", "other"]));
    expect(remaining.map((item) => item.id)).toEqual(["new"]);
  });

  it("rejects malformed data and quarantines a legacy entry without an owner", () => {
    expect(parseOfflineQueue("not-json")).toEqual([]);
    const legacy = { id: "legacy", matchId: "m", timestamp: 1, matchState: { id: "m" } };
    expect(parseOfflineQueue(JSON.stringify([legacy]))[0].ownerId).toBe(UNATTRIBUTED_OFFLINE_QUEUE_OWNER);
  });

  it("removes all snapshots for a quarantined or resolved match", () => {
    const current = [
      action("s1", "match-1", 1),
      action("s2", "match-2", 2),
      action("s3", "match-1", 3),
    ];
    const remaining = removeSnapshotsForMatch(current, "match-1");
    expect(remaining.map((item) => item.id)).toEqual(["s2"]);
  });

  it("does not delete another umpire's snapshot on a shared device", () => {
    const otherOwner = { ...action("other-owner", "match-1", 2), ownerId: "umpire-2" };
    const remaining = removeSnapshotsForMatch(
      [action("mine", "match-1", 1), otherOwner],
      "match-1",
      "umpire-1",
    );
    expect(remaining).toEqual([otherOwner]);
  });
});

