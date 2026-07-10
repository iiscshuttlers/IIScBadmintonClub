import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export interface PipPlugin {
  enterPipMode(options?: { width?: number; height?: number }): Promise<void>;
  addListener(
    eventName: "pipModeChanged",
    listenerFunc: (data: { isInPipMode: boolean }) => void,
  ): Promise<PluginListenerHandle>;
}

export const Pip = registerPlugin<PipPlugin>("Pip");
