import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const ACTIVITY_EVENTS = [
  "mousemove",
  "keypress",
  "click",
  "scroll",
  "touchstart",
] as const;
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

export function useInactivityLogout() {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.auth.signOut();
        sessionStorage.setItem("logout_reason", "inactivity");
        window.location.href = `${import.meta.env.BASE_URL}join`;
      }, INACTIVITY_LIMIT_MS);
    };

    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, resetTimer, { passive: true }),
    );
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((name) =>
        window.removeEventListener(name, resetTimer),
      );
    };
  }, []);
}
