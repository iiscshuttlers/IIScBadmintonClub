import { registerPlugin, PluginListenerHandle } from "@capacitor/core";

export interface MotionData {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  intensity: "idle" | "walking" | "running" | "smash_sprint";
}

export interface PlayerMotionPlugin {
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  addListener(
    eventName: "onMotionUpdate",
    listenerFunc: (data: MotionData) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

export const PlayerMotion = registerPlugin<PlayerMotionPlugin>("PlayerMotion");
