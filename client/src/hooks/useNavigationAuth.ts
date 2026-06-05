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
  const { session, profile, isAdmin, isInitializing, signOut: globalSignOut } = useAuth();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    const accounts = readSavedAccounts();
    
    if (session?.user) {
      // Save current account
      const quickName = session.user.email?.split("@")[0] ?? "Player";
      const name = profile?.full_name?.split(" ")[0] ?? quickName;
      
      const account = { id: session.user.id, email: session.user.email, name, session };
      const existingIndex = accounts.findIndex((item) => item.id === session.user.id);

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

  const signOut = async () => {
    if (session?.user?.id) {
      const accounts = readSavedAccounts().filter((item) => item.id !== session.user.id);
      writeSavedAccounts(accounts);
      setSavedAccounts(accounts);
    }
    await globalSignOut();
  };

  const switchAccount = async (account: SavedAccount) => {
    await supabase.auth.setSession(account.session);
    window.location.reload();
  };

  const userName = profile?.full_name?.split(" ")[0] 
    ?? session?.user?.email?.split("@")[0] 
    ?? "Player";

  return {
    authLoading: isInitializing,
    isAdmin,
    isLoggedIn: !!session,
    myPlayerId: profile?.id ?? null,
    savedAccounts,
    signOut,
    switchAccount,
    userName: session ? userName : "",
  };
}
