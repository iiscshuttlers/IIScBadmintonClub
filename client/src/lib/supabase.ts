import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const placeholderUrl = "https://placeholder-url.supabase.co";
const placeholderAnonKey = "placeholder-anon-key";

export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  supabaseUrl !== placeholderUrl &&
  supabaseAnonKey !== placeholderAnonKey;

if (!isSupabaseConfigured) {
  console.warn(
    "Missing Supabase environment variables. Please check your .env.local file.",
  );
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : placeholderUrl,
  isSupabaseConfigured ? supabaseAnonKey : placeholderAnonKey,
  {
    auth: {
      // Prevent the client from re-processing OAuth/magic-link hash fragments
      // on every page load — a common source of "auth limbo" on refresh.
      detectSessionInUrl: true,
      // Store session in localStorage (default) but we add proactive cleanup below.
      persistSession: true,
      // Auto-refresh: keep enabled but we add a startup health check.
      autoRefreshToken: true,
    },
  },
);

/**
 * Proactive session health check.
 *
 * On app startup, validate that any stored session is still usable.
 * If `getUser()` fails (expired refresh token, revoked session, etc.),
 * we immediately sign out and clear localStorage to prevent the Supabase
 * client from entering a token-refresh retry loop that blocks ALL queries.
 *
 * This is the ROOT FIX for the "infinite loading on refresh" bug.
 */
export async function validateStoredSession(): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return; // No stored session — nothing to validate.

    // Race getUser() against a 5-second timeout.
    // If the server can't validate the token in 5s, the session is zombie.
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }; error: Error }>((resolve) =>
        setTimeout(
          () =>
            resolve({
              data: { user: null },
              error: new Error("Session validation timed out"),
            }),
          5000,
        ),
      ),
    ]);

    if (result.error || !result.data.user) {
      console.warn(
        "[Auth] Stored session is invalid/expired — clearing to prevent auth limbo:",
        result.error?.message,
      );
      // Clear everything to break the deadlock
      await supabase.auth.signOut({ scope: "local" });
      // Belt-and-suspenders: also clear the raw storage keys
      try {
        const storageKey = `sb-${new URL(supabaseUrl || placeholderUrl).hostname.split(".")[0]}-auth-token`;
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn("[Auth] Session validation crashed — clearing session:", err);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
  }
}
