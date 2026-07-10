import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface PinnedMatchData {
  id: string;
  score: string;
  teams: string;
}

export interface FloatingScorePlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  startService(options: { matches: PinnedMatchData[] }): Promise<void>;
  updateScore(options: { matches: PinnedMatchData[] }): Promise<void>;
  stopService(): Promise<void>;
  addListener(
    eventName: 'floatingScoreClosed',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>;
}

const FloatingScore = registerPlugin<FloatingScorePlugin>('FloatingScore');

export default FloatingScore;
