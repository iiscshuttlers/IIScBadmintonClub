import { registerPlugin } from "@capacitor/core";

export interface GeofencePlugin {
  setupGymkhanaGeofence(options?: {
    lat?: number;
    lng?: number;
    radius?: number;
  }): Promise<void>;
}

export const Geofence = registerPlugin<GeofencePlugin>("Geofence");
