import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Badge } from "@capawesome/capacitor-badge";

export interface PlayerProfile {
  id: string;
  user_id: string;
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
  followers?: string[];
  following?: string[];
  buddies?: string[];
  buddy_requests?: string[];
}

export interface AuthContextType {
  session: Session | null;
  user: Session["user"] | null;
  profile: PlayerProfile | null;
  isAdmin: boolean;
  isMainAdmin: boolean;
  isUmpire: boolean;
  isInitializing: boolean; // True while resolving session OR fetching profile
  userRoles: { id: string; role: string }[];
  updateRole: (playerId: string, role: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSupabaseSession();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", userId)
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

  const [userRoles, setUserRoles] = useState<{ id: string; role: string }[]>(
    [],
  );

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data } = await supabase
          .from("site_data")
          .select("value")
          .eq("key", "roles")
          .maybeSingle();
        if (data?.value && Array.isArray(data.value)) {
          setUserRoles(data.value);
        }
      } catch (err) {
        console.warn("Failed to fetch roles", err);
      }
    };
    fetchRoles();
  }, [session]);

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
              await PushNotifications.removeAllDeliveredNotifications();
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

  const isMainAdmin = session?.user?.email
    ? isAdminEmail(session.user.email)
    : false;
  const assignedRole = profile
    ? userRoles.find((r) => r.id === profile.id)?.role
    : null;
  const isAdmin = isMainAdmin || assignedRole === "admin";
  const isUmpire = isAdmin || assignedRole === "umpire";

  usePushNotifications(profile?.user_id, profile?.id);

  const updateRole = async (playerId: string, role: string | null) => {
    let newRoles = [...userRoles];
    if (role === null) {
      newRoles = newRoles.filter((r) => r.id !== playerId);
    } else {
      const idx = newRoles.findIndex((r) => r.id === playerId);
      if (idx > -1) {
        newRoles[idx].role = role;
      } else {
        newRoles.push({ id: playerId, role });
      }
    }
    await supabase
      .from("site_data")
      .update({ value: newRoles })
      .eq("key", "roles");
    setUserRoles(newRoles);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        isMainAdmin,
        isUmpire,
        isInitializing,
        userRoles,
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
