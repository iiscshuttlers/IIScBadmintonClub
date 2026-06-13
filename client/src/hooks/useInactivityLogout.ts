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
  // Disabled as per user request: "User log in should not expire in app"
  return;
}
