import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

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
}

export interface AuthContextType {
  session: Session | null;
  user: Session["user"] | null;
  profile: PlayerProfile | null;
  isAdmin: boolean;
  isInitializing: boolean; // True while resolving session OR fetching profile
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

  const isInitializing = sessionLoading || (!!session && profileLoading);
  const isAdmin = session?.user?.email ? isAdminEmail(session.user.email) : false;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        isInitializing,
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
