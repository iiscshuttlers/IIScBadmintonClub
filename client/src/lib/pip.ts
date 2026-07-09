import { registerPlugin } from "@capacitor/core";

export interface PipPlugin {
  enterPipMode(options?: { width?: number; height?: number }): Promise<void>;
}

export const Pip = registerPlugin<PipPlugin>("Pip");
