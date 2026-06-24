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
  const [profileLoading, setProfileLoading] = useState(true);
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

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (!error && data) {
        setProfile(data as PlayerProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.warn("Failed to fetch profile in AuthProvider", err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;

    if (session?.user?.id) {
      setProfileLoading(true);
      fetchProfile(session.user.id);
    } else {
      setProfile(null);
      setProfileLoading(false);
    }
  }, [session, sessionLoading]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = `${import.meta.env.BASE_URL}join`;
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  };


  // Global App Badge & Realtime Notifications for pending matches
  useMatchNotifications(profile?.id);

  const isInitializing = sessionLoading || (!!session && profileLoading);

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

  const updateRole = async (playerId: string, role: string) => {
    const { error } = await supabase
      .from("players")
      .update({ role })
      .eq("id", playerId);
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
