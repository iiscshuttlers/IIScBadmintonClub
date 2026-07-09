import { registerPlugin } from "@capacitor/core";

export interface WidgetManagerPlugin {
  updateWidget(options: {
    title?: string;
    team1?: string;
    score1?: string;
    team2?: string;
    score2?: string;
    upcoming?: string;
  }): Promise<void>;
}

export const WidgetManager = registerPlugin<WidgetManagerPlugin>("WidgetManager");
