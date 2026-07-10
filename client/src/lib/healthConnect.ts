import { registerPlugin } from "@capacitor/core";

export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  getHeartRateForTimeRange(options: { startTime: string; endTime: string }): Promise<{ samples: { time: string; bpm: number }[] }>;
  getStepsForTimeRange(options: { startTime: string; endTime: string }): Promise<{ steps: number }>;
  getCaloriesForTimeRange(options: { startTime: string; endTime: string }): Promise<{ calories: number }>;
}

const HealthConnect = registerPlugin<HealthConnectPlugin>("HealthConnect");

export default HealthConnect;
