import type { BwfMatchState } from "@/types/umpire";

export interface QueuedUmpireAction {
  id: string;
  matchId: string;
  ownerId: string;
  timestamp: number;
  matchState: BwfMatchState;
}

/** Queue owner used for snapshots written before owner attribution existed. */
export const UNATTRIBUTED_OFFLINE_QUEUE_OWNER = "__unattributed__";

export function parseOfflineQueue(value: string | null): QueuedUmpireAction[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): QueuedUmpireAction[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<QueuedUmpireAction>;
      const isValid = typeof candidate.id === "string" &&
        typeof candidate.matchId === "string" &&
        typeof candidate.timestamp === "number" &&
        !!candidate.matchState && typeof candidate.matchState === "object";
      if (!isValid) return [];
      const ownerId = typeof candidate.ownerId === "string" && candidate.ownerId.trim()
        ? candidate.ownerId
        : UNATTRIBUTED_OFFLINE_QUEUE_OWNER;
      return [{ ...candidate, ownerId } as QueuedUmpireAction];
    });
  } catch {
    return [];
  }
}

export function enqueueLatestSnapshot(queue: QueuedUmpireAction[], action: QueuedUmpireAction): QueuedUmpireAction[] {
  return [...queue.filter((item) => item.matchId !== action.matchId || item.ownerId !== action.ownerId), action];
}

/** Remove only acknowledged operations so a newer snapshot queued mid-sync survives. */
export function removeAcknowledgedSnapshots(
  queue: QueuedUmpireAction[],
  acknowledgedIds: ReadonlySet<string>,
): QueuedUmpireAction[] {
  return queue.filter((item) => !acknowledgedIds.has(item.id));
}

/** Clear all queued snapshots for a match once resolved or quarantined */
export function removeSnapshotsForMatch(
  queue: QueuedUmpireAction[],
  matchId: string,
  ownerId?: string,
): QueuedUmpireAction[] {
  return queue.filter((item) => item.matchId !== matchId || (ownerId !== undefined && item.ownerId !== ownerId));
}

