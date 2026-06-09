import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type SavedAccount = {
  id: string;
  email?: string;
  name: string;
  session: Session;
};

const SAVED_ACCOUNTS_KEY = "iisc_saved_accounts";

function readSavedAccounts(): SavedAccount[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedAccount[]) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function useNavigationAuth() {
  const {
    session,
    profile,
    isAdmin,
    isInitializing,
    signOut: globalSignOut,
  } = useAuth();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [pendingActionCount, setPendingActionCount] = useState(0);

  useEffect(() => {
    const accounts = readSavedAccounts();

    if (session?.user) {
      // Save current account
      const quickName = session.user.email?.split("@")[0] ?? "Player";
      const name = profile?.full_name?.split(" ")[0] ?? quickName;

      const account = {
        id: session.user.id,
        email: session.user.email,
        name,
        session,
      };
      const existingIndex = accounts.findIndex(
        (item) => item.id === session.user.id,
      );

      if (existingIndex >= 0) {
        accounts[existingIndex] = account;
      } else {
        accounts.push(account);
      }

      writeSavedAccounts(accounts);
      setSavedAccounts(accounts.filter((item) => item.id !== session.user.id));
    } else {
      setSavedAccounts(accounts);
    }
  }, [session, profile]);

  useEffect(() => {
    if (!profile?.id) {
      setPendingActionCount(0);
      return;
    }

    const fetchPending = async () => {
      try {
        const { count } = await supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .neq("submitted_by", profile.id)
          .or(
            `player1_id.eq.${profile.id},player2_id.eq.${profile.id},team1_partner_id.eq.${profile.id},team2_partner_id.eq.${profile.id}`,
          );

        if (count != null) {
          setPendingActionCount(count);
        }
      } catch {
        // silent
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  const signOut = async () => {
    writeSavedAccounts([]);
    setSavedAccounts([]);
    await globalSignOut();
  };

  const switchAccount = async (account: SavedAccount) => {
    await supabase.auth.setSession(account.session);
    window.location.reload();
  };

  const userName =
    profile?.full_name?.split(" ")[0] ??
    session?.user?.email?.split("@")[0] ??
    "Player";

  return {
    authLoading: isInitializing,
    isAdmin,
    isLoggedIn: !!session,
    myPlayerId: profile?.id ?? null,
    savedAccounts,
    signOut,
    switchAccount,
    userName: session ? userName : "",
    pendingActionCount,
  };
}
