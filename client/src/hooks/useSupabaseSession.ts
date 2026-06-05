import { useEffect, useState, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface SupabaseSessionResult {
  /** The current Supabase session, or null if signed out / not yet resolved. */
  session: Session | null;
  /**
   * True while the initial session check is in-flight.
   * Components should gate their auth-dependent renders behind this flag
   * to prevent the flash of a "not logged in" state.
   */
  loading: boolean;
}

/**
 * useSupabaseSession
 *
 * A single, race-condition-proof hook for reading the Supabase auth session.
 *
 * ### Why this hook exists
 * The naive pattern — calling both `getSession()` and `onAuthStateChange()` inside
 * a `useEffect` — causes a subtle race condition: `onAuthStateChange` fires an
 * `INITIAL_SESSION` event synchronously on mount, so the callback runs at the same
 * time as the `getSession()` promise resolves. Both calls trigger whatever logic
 * the component has wired up, leading to duplicate DB queries and, in the worst
 * case, an infinite loading spinner if the two async paths collide.
 *
 * ### How this hook fixes it
 * 1. `onAuthStateChange` is the **single source of truth**. It fires immediately
 *    with the cached session, so `loading` is cleared in the first microtask.
 * 2. A `hasResolved` ref ensures the session is set exactly once from the initial
 *    event — subsequent auth-change events (sign-in/out) still flow through, but
 *    they don't re-trigger "initializing" logic.
 * 3. `getSession()` is called as a **fallback only**, in case the auth listener
 *    does not fire (e.g. no cached session + Supabase not configured).
 * 4. A **5-second failsafe** clears `loading` unconditionally to prevent any
 *    permanent spinner, regardless of network conditions. (Reduced from 10s
 *    because the startup `validateStoredSession()` in supabase.ts already
 *    handles zombie sessions; if we're still stuck after 5s, something is very
 *    wrong and we should unblock the UI.)
 *
 * ### Usage
 * ```ts
 * const { session, loading } = useSupabaseSession();
 * if (loading) return <Spinner />;
 * if (!session) return <Redirect to="/join" />;
 * ```
 */
export function useSupabaseSession(): SupabaseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard: we only want to mark loading as done once for the initial event.
  const hasResolved = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Failsafe: if nothing resolves within 5s, clear the loading flag.
    const failsafe = setTimeout(() => {
      if (mounted && !hasResolved.current) {
        console.warn("[useSupabaseSession] Failsafe triggered — clearing loading state.");
        hasResolved.current = true;
        setLoading(false);
      }
    }, 5_000);

    const resolve = (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      if (!hasResolved.current) {
        hasResolved.current = true;
        setLoading(false);
        clearTimeout(failsafe);
      }
    };

    // Primary: onAuthStateChange fires INITIAL_SESSION immediately on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => resolve(s)
    );

    // Fallback: in case the listener never fires (misconfigured client, etc.)
    supabase.auth.getSession()
      .then(({ data }) => resolve(data.session))
      .catch(() => resolve(null));

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
