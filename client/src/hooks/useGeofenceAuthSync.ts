import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import type { Session } from "@supabase/supabase-js";
import { Geofence } from "@/lib/geofence";

/**
 * The Gymkhana geofence's ENTER/EXIT transitions are handled by a native
 * BroadcastReceiver that can run even when the app process is dead, so it
 * can't reach the JS Supabase client directly. Instead we hand it a copy of
 * the current session (player id + access token) to store natively, so it
 * can relay presence events on its own. Re-synced whenever the session
 * changes (login, logout, token refresh).
 */
export function useGeofenceAuthSync(session: Session | null) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return;

    if (session?.user?.id && session.access_token && session.refresh_token) {
      Geofence.setAuthContext({
        playerId: session.user.id,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        supabaseUrl,
        anonKey,
      }).catch((e) => console.log("Geofence auth sync failed:", e));
    } else {
      Geofence.clearAuthContext().catch(() => {});
    }
  }, [session?.user?.id, session?.access_token]);
}
