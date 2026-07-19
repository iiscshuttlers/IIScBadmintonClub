import { registerPlugin } from "@capacitor/core";

export interface GeofencePlugin {
  setupGymkhanaGeofence(options?: {
    lat?: number;
    lng?: number;
    radius?: number;
  }): Promise<void>;
  setAuthContext(options: {
    playerId: string;
    accessToken: string;
    refreshToken?: string;
    supabaseUrl: string;
    anonKey: string;
  }): Promise<void>;
  clearAuthContext(): Promise<void>;
}

export const Geofence = registerPlugin<GeofencePlugin>("Geofence");
