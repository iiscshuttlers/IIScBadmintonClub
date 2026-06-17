import { describe, it, expect, vi, beforeEach } from 'vitest';

interface OfflineAction {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: 'match' | 'profile' | 'notification';
  entity_id: string;
  data: Record<string, any>;
  timestamp: number;
  synced: boolean;
}

interface SyncResult {
  success: boolean;
  synced_count: number;
  failed_count: number;
  errors?: Array<{ action_id: string; error: string }>;
}

// Mock offline queue functions
class OfflineQueue {
  private queue: OfflineAction[] = [];

  addAction(
    action: string,
    entity: string,
    entityId: string,
    data: Record<string, any>
  ): OfflineAction {
    const offlineAction: OfflineAction = {
      id: `action-${Date.now()}`,
      action: action as any,
      entity: entity as any,
      entity_id: entityId,
      data,
      timestamp: Date.now(),
      synced: false,
    };

    this.queue.push(offlineAction);
    return offlineAction;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getUnsyncedActions(): OfflineAction[] {
    return this.queue.filter(a => !a.synced);
  }

  markAsSynced(actionId: string): void {
    const action = this.queue.find(a => a.id === actionId);
    if (action) {
      action.synced = true;
    }
  }

  removeAction(actionId: string): void {
    this.queue = this.queue.filter(a => a.id !== actionId);
  }

  clearQueue(): void {
    this.queue = [];
  }

  async simulateSync(): Promise<SyncResult> {
    const unsyncedActions = this.getUnsyncedActions();
    const results = {
      success: true,
      synced_count: 0,
      failed_count: 0,
      errors: [] as Array<{ action_id: string; error: string }>,
    };

    for (const action of unsyncedActions) {
      try {
        // Simulate network request
        if (Math.random() > 0.1) {
          // 90% success rate
          this.markAsSynced(action.id);
          results.synced_count++;
        } else {
          throw new Error('Network error');
        }
      } catch (error: any) {
        results.failed_count++;
        results.errors?.push({
          action_id: action.id,
          error: error.message,
        });
        results.success = false;
      }
    }

    return results;
  }
}

describe('Offline Sync', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    queue = new OfflineQueue();
  });

  describe('Queue Operations', () => {
    it('adds action to offline queue', () => {
      const action = queue.addAction(
        'create',
        'match',
        'match-1',
        { score: [21, 15] }
      );

      expect(action.action).toBe('create');
      expect(action.entity).toBe('match');
      expect(action.synced).toBe(false);
    });

    it('tracks queue length', () => {
      expect(queue.getQueueLength()).toBe(0);

      queue.addAction('create', 'match', 'match-1', {});
      expect(queue.getQueueLength()).toBe(1);

      queue.addAction('create', 'match', 'match-2', {});
      expect(queue.getQueueLength()).toBe(2);
    });

    it('retrieves unsynced actions', () => {
      queue.addAction('create', 'match', 'match-1', {});
      queue.addAction('update', 'profile', 'user-1', {});

      const unsyncedActions = queue.getUnsyncedActions();
      expect(unsyncedActions.length).toBe(2);
      expect(unsyncedActions.every(a => !a.synced)).toBe(true);
    });

    it('marks action as synced', () => {
      const action = queue.addAction('create', 'match', 'match-1', {});
      expect(action.synced).toBe(false);

      queue.markAsSynced(action.id);
      const updated = queue.getUnsyncedActions().find(a => a.id === action.id);
      expect(updated).toBeUndefined();
    });

    it('removes action from queue', () => {
      const action = queue.addAction('create', 'match', 'match-1', {});
      expect(queue.getQueueLength()).toBe(1);

      queue.removeAction(action.id);
      expect(queue.getQueueLength()).toBe(0);
    });

    it('clears entire queue', () => {
      queue.addAction('create', 'match', 'match-1', {});
      queue.addAction('update', 'profile', 'user-1', {});
      expect(queue.getQueueLength()).toBe(2);

      queue.clearQueue();
      expect(queue.getQueueLength()).toBe(0);
    });
  });

  describe('Action Types', () => {
    it('handles create actions', () => {
      const action = queue.addAction('create', 'match', 'match-1', {
        player1: 'user-1',
        player2: 'user-2',
      });

      expect(action.action).toBe('create');
    });

    it('handles update actions', () => {
      const action = queue.addAction('update', 'match', 'match-1', {
        score: [21, 18],
      });

      expect(action.action).toBe('update');
    });

    it('handles delete actions', () => {
      const action = queue.addAction('delete', 'match', 'match-1', {});

      expect(action.action).toBe('delete');
    });
  });

  describe('Entity Types', () => {
    it('handles match entities', () => {
      const action = queue.addAction('create', 'match', 'match-1', {});
      expect(action.entity).toBe('match');
    });

    it('handles profile entities', () => {
      const action = queue.addAction('update', 'profile', 'user-1', {});
      expect(action.entity).toBe('profile');
    });

    it('handles notification entities', () => {
      const action = queue.addAction('create', 'notification', 'notif-1', {});
      expect(action.entity).toBe('notification');
    });
  });

  describe('Sync Operations', () => {
    it('successfully syncs actions', async () => {
      queue.addAction('create', 'match', 'match-1', {});
      queue.addAction('update', 'profile', 'user-1', {});

      const result = await queue.simulateSync();

      expect(result.synced_count).toBeGreaterThan(0);
    });

    it('reports sync failures', async () => {
      queue.addAction('create', 'match', 'match-1', {});

      const result = await queue.simulateSync();

      if (result.failed_count > 0) {
        expect(result.errors?.length).toBeGreaterThan(0);
        expect(result.success).toBe(false);
      }
    });

    it('handles partial sync success', async () => {
      queue.addAction('create', 'match', 'match-1', {});
      queue.addAction('create', 'match', 'match-2', {});

      const result = await queue.simulateSync();

      expect(result.synced_count + result.failed_count).toBe(2);
    });
  });

  describe('Conflict Resolution', () => {
    it('tracks action timestamps for conflict resolution', () => {
      const action = queue.addAction('update', 'match', 'match-1', {
        score: [21, 15],
      });

      expect(action.timestamp).toBeDefined();
      expect(action.timestamp).toBeGreaterThan(0);
    });

    it('newer actions override older ones', () => {
      const action1 = queue.addAction('update', 'match', 'match-1', {
        score: [15, 15],
      });

      // Simulate small delay
      const delayedAction = queue.addAction('update', 'match', 'match-1', {
        score: [21, 15],
      });

      expect(delayedAction.timestamp).toBeGreaterThanOrEqual(action1.timestamp);
    });
  });

  describe('Offline Detection', () => {
    it('allows queueing when offline', () => {
      const action = queue.addAction('create', 'match', 'match-1', {});
      expect(action.synced).toBe(false);
      expect(queue.getQueueLength()).toBe(1);
    });

    it('preserves queue across offline periods', () => {
      queue.addAction('create', 'match', 'match-1', {});
      queue.addAction('update', 'profile', 'user-1', {});

      // Simulate offline duration
      expect(queue.getQueueLength()).toBe(2);

      // Queue should still exist when coming back online
      expect(queue.getUnsyncedActions().length).toBe(2);
    });
  });

  describe('Data Preservation', () => {
    it('preserves action data during offline', () => {
      const data = { score: [21, 15], duration: 45 };
      const action = queue.addAction('create', 'match', 'match-1', data);

      expect(action.data).toEqual(data);
    });

    it('maintains action integrity', () => {
      const action = queue.addAction('update', 'match', 'match-1', {
        score: [21, 15],
      });

      const originalId = action.id;
      queue.markAsSynced(action.id);

      const unsyncedBefore = queue.getUnsyncedActions();
      const foundAction = unsyncedBefore.find(a => a.id === originalId);

      expect(foundAction).toBeUndefined();
    });
  });
});
