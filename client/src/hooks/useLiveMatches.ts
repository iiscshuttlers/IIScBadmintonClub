import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { BwfMatchState } from "@/types/umpire";

export function useLiveMatches() {
  const [liveMatchIds, setLiveMatchIds] = useState<Set<string>>(new Set());
  const [hasLiveMatches, setHasLiveMatches] = useState(false);

  useEffect(() => {
    const parseLiveData = (val: Record<string, BwfMatchState>) => {
      const ids = new Set<string>();
      let anyLive = false;
      if (val && typeof val === 'object') {
        Object.values(val).forEach((m) => {
          if (m && (m.status === "playing" || (m.status === "setup" && m.t1?.p1Id && m.t2?.p1Id))) {
            anyLive = true;
            if (!m.isFriendly) {
              [m.t1?.p1Id, m.t1?.p2Id, m.t2?.p1Id, m.t2?.p2Id]
                .filter(Boolean)
                .forEach((id: string) => ids.add(id));
            }
          }
        });
      }
      setLiveMatchIds(ids);
      setHasLiveMatches(anyLive);
    };

    const fetchLive = async () => {
      const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").maybeSingle();
      if (data?.value) parseLiveData(data.value as unknown as Record<string, BwfMatchState>);
    };

    fetchLive();

    const handleOnline = () => fetchLive();
    window.addEventListener("online", handleOnline);

    const sub = supabase.channel("feed_live_matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
        (payload) => parseLiveData((payload.new as { value?: Record<string, BwfMatchState> })?.value || {}))
      .subscribe();

    return () => { 
      supabase.removeChannel(sub); 
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return { liveMatchIds, hasLiveMatches };
}
