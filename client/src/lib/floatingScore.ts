import { registerPlugin } from '@capacitor/core';

export interface FloatingScorePlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  startService(options: { score: string }): Promise<void>;
  updateScore(options: { score: string }): Promise<void>;
  stopService(): Promise<void>;
}

const FloatingScore = registerPlugin<FloatingScorePlugin>('FloatingScore');

export default FloatingScore;
