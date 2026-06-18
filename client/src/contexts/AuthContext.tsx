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
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Badge } from "@capawesome/capacitor-badge";

export interface PlayerProfile {
  id: string;
  full_name: string;
  nickname: string | null;
  iisc_email: string | null;
  contact_number: string | null;
  department: string;
  joined_year: number | null;
  playing_level: string;
  playing_style: string;
  dominant_hand: string | null;
  favorite_shot: string | null;
  favorite_idol: string | null;
  quote: string | null;
  avatar_url: string;
  current_racket: string;
  racket_details: any;
  shoes: any;
  stats: any;
  nationality: string | null;
  home_state: string | null;
  height: string | null;
  years_playing: number | null;
  coach: string | null;
  bio: string | null;
  apparel: string | null;
  instagram: string | null;
  achievements: string[] | null;
  tournament_history: string[] | null;
  elo_rating?: number;
  status?: string;
  role?: 'master_admin' | 'admin' | 'umpire' | 'player';
  followers?: string[];
  following?: string[];
  buddies?: string[];
  buddy_requests?: string[];
}

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


  // Global App Badge logic for pending matches
  useEffect(() => {
    if (!profile?.id) return;

    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .neq("submitted_by", profile.id)
          .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id},team1_partner_id.eq.${profile.id},team2_partner_id.eq.${profile.id}`);

        if (!error && count !== null && Capacitor.isNativePlatform()) {
          try {
            if (count > 0) {
              await Badge.set({ count });
            } else {
              await Badge.clear();
            }
          } catch (e) {
            console.warn("Failed to set app badge", e);
          }
        }
      } catch (err) {
        // ignore
      }
    };

    fetchPendingCount();

    const channel = supabase
      .channel("realtime_matches")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `player2_id=eq.${profile.id}`,
        },
        async (payload) => {
          if (payload.new.status === "pending") {
            fetchPendingCount();
            try {
              // Fetch the opponent's name for a better notification
              const { data } = await supabase
                .from("players")
                .select("full_name")
                .eq("id", payload.new.player1_id)
                .single();
              const challengerName = data?.full_name || "Someone";
              
              let description = `${challengerName} just logged a match against you!`;
              let title = "🏸 New Match Request";

              if (payload.new.submitted_by && payload.new.submitted_by !== payload.new.player1_id && payload.new.submitted_by !== payload.new.player2_id) {
                 const { data: umpireData } = await supabase.from("players").select("full_name").eq("id", payload.new.submitted_by).single();
                 if (umpireData) {
                     title = "📺 Match Logged by Umpire";
                     description = `Umpire ${umpireData.full_name} logged your match: ${payload.new.match_score}`;
                 }
              }

              toast.info(title, {
                description,
                action: {
                  label: "View",
                  onClick: () =>
                    (window.location.href = `${import.meta.env.BASE_URL}feed/my-matches`),
                },
                duration: 10000,
              });
            } catch (err) {
              // Fallback
              toast.info("🏸 New Match Request", {
                description: "Someone just logged a match against you!",
              });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
        },
        (payload) => {
           fetchPendingCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "matches",
        },
        (payload) => {
           fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

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
