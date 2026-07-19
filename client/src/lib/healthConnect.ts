import { registerPlugin } from "@capacitor/core";

export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  installHealthConnect(): Promise<void>;
  openHealthConnectSettings(): Promise<void>;
  requestHealthPermissions(): Promise<{ granted: boolean }>;
  getHeartRateForTimeRange(options: { startTime: string; endTime: string }): Promise<{ samples: { time: string; bpm: number }[] }>;
  getStepsForTimeRange(options: { startTime: string; endTime: string }): Promise<{ steps: number }>;
  getCaloriesForTimeRange(options: { startTime: string; endTime: string }): Promise<{ calories: number }>;
  getHrvForTimeRange(options: { startTime: string; endTime: string }): Promise<{ samples: { time: string; rmssd: number }[] }>;
  getRestingHeartRate(options: { before: string }): Promise<{ bpm: number | null }>;
  getSpo2ForTimeRange(options: { startTime: string; endTime: string }): Promise<{ samples: { time: string; percentage: number }[] }>;
  getSleepForDateRange(options: { startTime: string; endTime: string }): Promise<{ sessions: { startTime: string; endTime: string; totalMinutes: number; deepMinutes: number; remMinutes: number; lightMinutes: number; awakeMinutes: number }[] }>;
}

const HealthConnect = registerPlugin<HealthConnectPlugin>("HealthConnect");

export default HealthConnect;
