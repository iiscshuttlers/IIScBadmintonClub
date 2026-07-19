import { registerPlugin, PluginListenerHandle } from "@capacitor/core";

export interface MotionData {
  timestampMs?: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
  intensity: "idle" | "walking" | "running" | "smash_sprint";
  
  hasGyro?: boolean;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
  rotationRate?: number;
  
  swingDetected?: boolean;
  swingType?: "smash" | "clear" | "drive" | "net_shot" | null;
}

export interface PlayerMotionPlugin {
  startTracking(): Promise<{ hasGyro: boolean }>;
  stopTracking(): Promise<void>;
  addListener(
    eventName: "onMotionUpdate",
    listenerFunc: (data: MotionData) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

export const PlayerMotion = registerPlugin<PlayerMotionPlugin>("PlayerMotion");
