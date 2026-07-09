import { registerPlugin, PluginListenerHandle } from "@capacitor/core";

export interface UmpireBackgroundPlugin {
  startService(): Promise<void>;
  stopService(): Promise<void>;
  updateScore(options: { score: string; teams: string }): Promise<void>;
  addListener(
    eventName: "umpireAction",
    listenerFunc: (info: { team: number }) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

export const UmpireBackground = registerPlugin<UmpireBackgroundPlugin>("UmpireBackground");
