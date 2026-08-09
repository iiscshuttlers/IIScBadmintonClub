import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isMasterAdminEmail } from "@/lib/admin";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useGeofenceAuthSync } from "@/hooks/useGeofenceAuthSync";
import { toast } from "sonner";
import { Badge } from "@capawesome/capacitor-badge";
import { useMatchNotifications } from "@/hooks/useMatchNotifications";

import type { PlayerRow } from "@/types";

export type PlayerProfile = PlayerRow;

export type ViewAsRole = 'master_admin' | 'admin' | 'umpire' | 'player';

export interface AuthContextType {
  session: Session | null;
  user: Session["user"] | null;
  profile: PlayerProfile | null;
  isAdmin: boolean;
  isMainAdmin: boolean;
  isMasterAdmin: boolean; // always true for real master_admin regardless of viewAsRole
  isUmpire: boolean;
  isInitializing: boolean; // True while resolving session OR fetching profile
  viewAsRole: ViewAsRole | null;
  setViewAsRole: (role: ViewAsRole | null) => void;
  updateRole: (playerId: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const VIEW_AS_KEY = "iisc_view_as_role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSupabaseSession();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [fetchedUserId, setFetchedUserId] = useState<string | null>(null);
  const [viewAsRole, setViewAsRoleState] = useState<ViewAsRole | null>(() => {
    try { return (localStorage.getItem(VIEW_AS_KEY) as ViewAsRole) || null; } catch { return null; }
  });

  const setViewAsRole = (role: ViewAsRole | null) => {
    setViewAsRoleState(role);
    try {
      if (role) localStorage.setItem(VIEW_AS_KEY, role);
      else localStorage.removeItem(VIEW_AS_KEY);
    } catch {}
  };

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      // Check if user still exists on the server (handles deleted users while JWT is still valid locally)
      const { error: authError } = await supabase.auth.getUser();
      if (authError && (authError.status === 404 || authError.status === 400 || authError.message.toLowerCase().includes("user not found"))) {
        await supabase.auth.signOut();
        setProfile(null);
        setFetchedUserId(null);
        return;
      }

      let { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!data && email) {
        const res = await supabase
          .from("players")
          .select("*")
          .eq("email", email)
          .maybeSingle();
        if (res.data) {
          data = res.data;
          error = res.error;
        }
      }

      if (!error && data) {
        setProfile(data as unknown as PlayerRow);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.warn("Failed to fetch profile in AuthProvider", err);
      setProfile(null);
    } finally {
      setFetchedUserId(userId);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;

    if (session?.user?.id) {
      fetchProfile(session.user.id, session.user.email);
    } else {
      setProfile(null);
      setFetchedUserId(null);
    }
  }, [session?.user?.id, sessionLoading]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = `${import.meta.env.BASE_URL}join`;
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id, session.user.email);
    }
  };


  // Global App Badge & Realtime Notifications for pending matches
  useMatchNotifications(profile?.id);

  const isInitializing = sessionLoading || (!!session && fetchedUserId !== session?.user?.id);

  const playerRole = profile?.role ?? 'player';
  const isTrulyMainAdmin = playerRole === 'master_admin' || isMasterAdminEmail(session?.user?.email);
  // When viewing as a different role, derive permissions from that role instead
  const isMainAdmin = isTrulyMainAdmin && !viewAsRole;
  const isAdmin = isTrulyMainAdmin
    ? (!viewAsRole || viewAsRole === 'master_admin' || viewAsRole === 'admin')
    : (playerRole === 'admin');
  const isUmpire = isTrulyMainAdmin
    ? (!viewAsRole || viewAsRole === 'master_admin' || viewAsRole === 'admin' || viewAsRole === 'umpire')
    : (isAdmin || playerRole === 'umpire');

  usePushNotifications(profile?.id);
  useGeofenceAuthSync(session);

  const updateRole = async (playerId: string, role: string) => {
    const { error } = await supabase.rpc('set_player_role', { p_id: playerId, p_role: role });
    if (error) throw new Error(`Failed to update role: ${error.message}`);
    if (session?.user?.id === playerId) {
      await refreshProfile();
    }
  };


  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        isMainAdmin,
        isMasterAdmin: isTrulyMainAdmin,
        isUmpire,
        isInitializing,
        viewAsRole: isTrulyMainAdmin ? viewAsRole : null,
        setViewAsRole: isTrulyMainAdmin ? setViewAsRole : () => {},
        updateRole,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
