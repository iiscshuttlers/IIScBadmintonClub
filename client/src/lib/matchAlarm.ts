import { registerPlugin } from "@capacitor/core";

export interface MatchAlarmPlugin {
  scheduleAlarm(options: {
    id: string;
    triggerAtMillis: number;
    title?: string;
    message?: string;
  }): Promise<void>;
  
  cancelAlarm(options: {
    id: string;
  }): Promise<void>;
}

export const MatchAlarm = registerPlugin<MatchAlarmPlugin>("MatchAlarm");
