import { useState, useEffect, useRef } from "react";
import { useLiveSiteData } from "@/hooks/useMatches";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { UmpireEngine } from "./UmpireEngine";
import { BwfMatchState, MatchEditState } from "@/types/umpire";
import { Play, Tv2, AlertTriangle, Swords, Lock, CalendarX } from "lucide-react";
import { useUmpireStore } from "@/store/umpireStore";
import { fetchSiteData } from "@/lib/siteData";
import { BeautifulScoreDisplay } from "@/components/feed/BeautifulScoreDisplay";
import { UmpireTournamentTab, type TournamentMatchForUmpire } from "./UmpireTournamentTab";

const SETUP_STORAGE_KEY = "umpire_setup_matches_v1";

export function UmpireTab({ tournamentOnly = false }: { tournamentOnly?: boolean }) {
  const { session, isUmpire, profile } = useAuth();
  // Only master_admin and umpire roles can run tournament matches
  const hasElevatedRole = isUmpire && (
    profile?.role === 'master_admin' || profile?.role === 'umpire'
  );
  const [hasActiveTournament, setHasActiveTournament] = useState(false);
  // canRunTournament = elevated role + active tournament exists
  const canRunTournament = hasElevatedRole && hasActiveTournament;
  const [activeMatches, setActiveMatches] = useState<(BwfMatchState | MatchEditState | TournamentMatchForUmpire)[]>(() => {
    // Restore any setup-state matches from localStorage on first render
    try {
      const saved = localStorage.getItem(SETUP_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(() => {
    // Restore last active tab index
    try {
      const saved = localStorage.getItem(SETUP_STORAGE_KEY);
      const matches = saved ? JSON.parse(saved) : [];
      return matches.length > 0 ? 0 : -1;
    } catch {
      return -1;
    }
  });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const resetUmpireStore = useUmpireStore((s) => s.reset);

  // Auto-select the first match if we just loaded some and none was selected
  useEffect(() => {
    if (activeMatches.length > 0 && activeMatchIndex === -1 && activeMatches.length === 1) {
      setActiveMatchIndex(0);
    }
  }, [activeMatches.length, activeMatchIndex]);

  // Persist setup-state matches to localStorage whenever they change
  useEffect(() => {
    try {
      // Only save BwfMatchState entries (friendly setup matches), not tournament matches
      const toSave = activeMatches.filter((m): m is BwfMatchState => 
        !('match_code' in m) && (m as BwfMatchState).status === 'setup'
      );
      if (toSave.length > 0) {
        localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(toSave));
      } else {
        // Clear storage once matches progress past setup
        localStorage.removeItem(SETUP_STORAGE_KEY);
      }
    } catch {}
  }, [activeMatches]);

  // Check if there's an active tournament
  useEffect(() => {
    supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .then(({ count }) => setHasActiveTournament((count ?? 0) > 0));
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const key = sessionStorage.getItem("umpire_takeover_key");
    if (!key) return;
    sessionStorage.removeItem("umpire_takeover_key");
    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .maybeSingle()
      .then(({ data }) => {
        const m = data?.value?.[key] as BwfMatchState | undefined;
        if (m && m.status && m.status !== "setup") {
          setActiveMatches((prev) => [...prev, m]);
        }
      });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;

    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'object') {
          const myMatches = Object.values(data.value).filter(
            (m: any) => m && m.umpireId === session.user.id
          ) as BwfMatchState[];
          
          if (myMatches.length > 0) {
            setActiveMatches((prev) => {
              const existingIds = new Set(prev.map(p => (p as any).id));
              const newMatches = myMatches.filter(m => !existingIds.has(m.id));
              return [...prev, ...newMatches];
            });
          }
        }
      });

    fetchSiteData<{ maintenanceMode?: boolean }>("club_settings", "settings.json").then(data => {
      if (data?.maintenanceMode) {
        setMaintenanceMode(true);
      }
    });

    // The realtime subscription handles remote takeover requests or external updates
    const sub = supabase
      .channel("umpire_tab_matches")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_data",
          filter: "key=eq.live_matches",
        },
        (payload) => {
          const newValue = (payload.new as Record<string, unknown>)?.value as Record<string, BwfMatchState>;
          if (newValue) {
            setActiveMatches((prev) => {
              return prev.map(m => {
                const matchId = (m as any).id;
                // Update match if it exists in DB, otherwise leave it (could be local setup state)
                return newValue[matchId] && newValue[matchId].umpireId === session.user.id 
                  ? newValue[matchId] 
                  : m;
              });
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [session?.user?.id]);

  if (!session) return null;

  const removeMatch = (indexToRemove: number) => {
    setActiveMatches((prev) => {
      const newMatches = prev.filter((_, i) => i !== indexToRemove);
      if (newMatches.length === 0) {
        setActiveMatchIndex(-1);
        try { localStorage.removeItem(SETUP_STORAGE_KEY); } catch {}
      } else if (activeMatchIndex === indexToRemove) {
        setActiveMatchIndex(Math.max(0, indexToRemove - 1));
      } else if (activeMatchIndex > indexToRemove) {
        setActiveMatchIndex(activeMatchIndex - 1);
      }
      return newMatches;
    });
    resetUmpireStore();
  };

  const startMatch = (m: any) => {
    setActiveMatches(prev => {
      setActiveMatchIndex(prev.length);
      return [...prev, m];
    });
  };

  const showNewMatch = activeMatches.length === 0 || activeMatchIndex === -1;
  const currentMatch = activeMatches[activeMatchIndex];
  const isTournamentMatch = currentMatch && 'id' in currentMatch && 'match_code' in currentMatch;

  return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-4 space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar border-b border-slate-800 pb-2">
        {activeMatches.map((m, idx) => {
          let mLabel = `Match ${idx + 1}`;
          if ('category' in m) {
            const num = ('match_code' in m && m.match_code) ? m.match_code : ('matchNumber' in m && m.matchNumber) ? m.matchNumber : `${idx + 1}`;
            mLabel = `${m.category} ${num}`;
          }
          return (
            <button
              key={('id' in m ? m.id : idx)}
              onClick={() => setActiveMatchIndex(idx)}
              className={`whitespace-nowrap px-4 py-2 rounded-t-xl text-sm font-bold transition-all border-b-2 ${
                activeMatchIndex === idx
                  ? "bg-slate-800 border-primary text-primary"
                  : "bg-slate-900/50 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-2">
                {mLabel}
                <div 
                  onClick={(e) => { e.stopPropagation(); removeMatch(idx); }}
                  className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-700 text-slate-500 hover:text-rose-400 transition"
                >
                  <span className="text-xs">×</span>
                </div>
              </div>
            </button>
          );
        })}
        <button
          onClick={() => setActiveMatchIndex(-1)}
          className={`whitespace-nowrap px-4 py-2 rounded-t-xl text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            showNewMatch
              ? "bg-slate-800 border-primary text-primary"
              : "bg-slate-900/50 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <span className="text-lg leading-none">+</span> New Match
        </button>
      </div>

      {!showNewMatch && currentMatch && (
        <div className="relative border border-slate-700 rounded-[2rem] overflow-hidden bg-slate-900 shadow-xl">
          <UmpireEngine
            key={('id' in currentMatch ? currentMatch.id : activeMatchIndex)}
            userId={session.user.id}
            userEmail={session.user.email!}
            userName={session.user.user_metadata?.full_name || "Guest"}
            isTournamentUmpire={canRunTournament}
            initialMatchState={isTournamentMatch ? null : currentMatch as BwfMatchState | MatchEditState}
            tournamentMatch={isTournamentMatch ? currentMatch as TournamentMatchForUmpire : undefined}
            onClose={() => removeMatch(activeMatchIndex)}
          />
        </div>
      )}

      {showNewMatch && (
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800">
            <h2 className="text-xl font-black text-foreground mb-5">Start New Match</h2>
            <div className="mb-6 flex gap-3">
              <button
                onClick={() => startMatch({
                  id: crypto.randomUUID(),
                  is_edit_mode: false,
                })}
                className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center gap-2"
              >
                <Swords className="w-5 h-5" /> Start Friendly Match
              </button>
            </div>
            
            {hasActiveTournament && canRunTournament && (
              <>
                <h2 className="text-xl font-black text-foreground mb-5">Tournament Matches</h2>
                <UmpireTournamentTab onStartMatch={startMatch} />
              </>
            )}

            {/* Show reason why tournament umpiring is unavailable */}
            {!canRunTournament && (
              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-4 flex gap-3 items-start">
                {!hasActiveTournament ? (
                  <>
                    <CalendarX className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-300">No Active Tournament</p>
                      <p className="text-xs text-slate-500 mt-0.5">Tournament umpiring is only available when an official tournament is in progress. Check back when one is scheduled.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-300">Umpire Access Required</p>
                      <p className="text-xs text-slate-500 mt-0.5">Tournament match umpiring requires the <span className="text-amber-400 font-semibold">Umpire</span> or <span className="text-amber-400 font-semibold">Admin</span> role. Contact an admin to get access.</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {hasActiveTournament && canRunTournament && (
            <RecentUmpireMatches
              isTournament={true}
              onEdit={startMatch}
            />
          )}
        </div>
      )}
    </div>
  );
}

type RecentMatch = {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  team1_partner_id: string | null;
  team2_partner_id: string | null;
  winner_id: string | null;
  score: string;
  sets_history: string[] | null;
  round: string;
  is_friendly: boolean | null;
  category: string;
  created_at: string;
  player1: { full_name: string; gender?: string | null } | null;
  player2: { full_name: string; gender?: string | null } | null;
  partner1: { full_name: string; gender?: string | null } | null;
  partner2: { full_name: string; gender?: string | null } | null;
  team1_label?: string;
  team2_label?: string;
};

function RecentUmpireMatches({ onEdit, isTournament }: { onEdit: (m: MatchEditState) => void, isTournament: boolean }) {
  const { profile, isAdmin } = useAuth();
  const [recent, setRecent] = useState<RecentMatch[]>([]);

  const [filterFormat, setFilterFormat] = useState<string>("ALL");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const fetchRecent = async () => {
      let data;
      if (isTournament) {
        let query = supabase
          .from("tournament_matches")
          .select("id, player1_id, player2_id, team1_partner_id:player3_id, team2_partner_id:player4_id, winner_id, score, sets_history, round:round_name, category, created_at:scored_at, team1_label, team2_label, player1:players!player1_id(full_name, gender), player2:players!player2_id(full_name, gender), partner1:players!tournament_matches_player3_id_fkey(full_name, gender), partner2:players!tournament_matches_player4_id_fkey(full_name, gender)")
          .eq("status", "completed")
          .order("scored_at", { ascending: false });
        if (isAdmin) {
          query = query.limit(50);
        } else {
          const fifteenMinsAgo = new Date(Date.now() - 900000).toISOString();
          query = query.eq("scored_by", profile.id).gte("scored_at", fifteenMinsAgo).limit(10);
        }
        const res = await query;
        if (res.error) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }
        data = res.data?.map(m => ({ ...m, is_friendly: false, is_tournament_match: true }));
      } else {
        let query = supabase
          .from("matches")
          .select("*, player1:players!player1_id(full_name, gender), player2:players!player2_id(full_name, gender), partner1:players!team1_partner_id(full_name, gender), partner2:players!team2_partner_id(full_name, gender)")
          .eq("is_friendly", true)
          .order("created_at", { ascending: false });
        if (isAdmin) {
          query = query.limit(50);
        } else {
          const fifteenMinsAgo = new Date(Date.now() - 900000).toISOString();
          query = query.eq("submitted_by", profile.id).gte("created_at", fifteenMinsAgo).limit(10);
        }
        const res = await query;
        if (res.error) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }
        data = res.data;
      }
      if (data) setRecent(data as any);
    };
    fetchRecent();
    intervalRef.current = setInterval(fetchRecent, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [profile?.id, isAdmin, isTournament]);

  if (recent.length === 0) return null;

  return (
    <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-xl font-black text-foreground">Recent Submissions (Editable for 15m)</h3>
        <div className="flex bg-slate-800 p-1 rounded-xl w-fit overflow-x-auto hide-scrollbar">
          {["ALL", "MS", "WS", "MD", "WD", "XD"].map(f => (
            <button
              key={f}
              onClick={() => setFilterFormat(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all ${
                filterFormat === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-primary-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {recent.filter(m => {
          if (filterFormat === "ALL") return true;
          const p1g = m.player1?.gender?.toLowerCase();
          const p2g = m.player2?.gender?.toLowerCase();
          const p3g = m.partner1?.gender?.toLowerCase();
          const p4g = m.partner2?.gender?.toLowerCase();

          let matchFormat = m.category;
          if (m.category === "Doubles") {
            const t1HasM = p1g === "male" || p3g === "male";
            const t1HasF = p1g === "female" || p3g === "female";
            const t2HasM = p2g === "male" || p4g === "male";
            const t2HasF = p2g === "female" || p4g === "female";
            
            if (t1HasM && t1HasF && t2HasM && t2HasF) matchFormat = "XD";
            else if (p1g === "male" && p3g === "male" && p2g === "male" && p4g === "male") matchFormat = "MD";
            else if (p1g === "female" && p3g === "female" && p2g === "female" && p4g === "female") matchFormat = "WD";
          } else if (m.category === "Singles") {
            if (p1g === "male" && p2g === "male") matchFormat = "MS";
            else if (p1g === "female" && p2g === "female") matchFormat = "WS";
          }
          return matchFormat === filterFormat;
        }).map(m => {
          const team1Won = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
          const team2Won = m.winner_id === m.player2_id || m.winner_id === m.team2_partner_id;
          
          const p1g = m.player1?.gender?.toLowerCase();
          const p2g = m.player2?.gender?.toLowerCase();
          const p3g = m.partner1?.gender?.toLowerCase();
          const p4g = m.partner2?.gender?.toLowerCase();

          let matchFormat = m.category;
          if (m.category === "Doubles") {
            const t1HasM = p1g === "male" || p3g === "male";
            const t1HasF = p1g === "female" || p3g === "female";
            const t2HasM = p2g === "male" || p4g === "male";
            const t2HasF = p2g === "female" || p4g === "female";
            
            if (t1HasM && t1HasF && t2HasM && t2HasF) matchFormat = "XD";
            else if (p1g === "male" && p3g === "male" && p2g === "male" && p4g === "male") matchFormat = "MD";
            else if (p1g === "female" && p3g === "female" && p2g === "female" && p4g === "female") matchFormat = "WD";
          } else if (m.category === "Singles") {
            if (p1g === "male" && p2g === "male") matchFormat = "MS";
            else if (p1g === "female" && p2g === "female") matchFormat = "WS";
          }

          return (
            <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-800 rounded-xl gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-slate-300 font-bold text-sm flex items-center gap-2 flex-wrap">
                  <span className={team1Won ? "text-amber-400" : ""}>
                    {m.player1?.full_name ? `${m.player1.full_name} ${m.partner1 ? `& ${m.partner1.full_name}` : ""}` : m.team1_label}
                  </span>
                  <span className="text-[10px] font-black uppercase text-rose-500 shrink-0">vs</span>
                  <span className={team2Won ? "text-amber-400" : ""}>
                    {m.player2?.full_name ? `${m.player2.full_name} ${m.partner2 ? `& ${m.partner2.full_name}` : ""}` : m.team2_label}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {matchFormat && (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-800/50">
                      {matchFormat}
                    </span>
                  )}
                  <BeautifulScoreDisplay score={m.score} />
                </div>
              </div>
              <button 
                onClick={() => onEdit({ ...m, is_edit_mode: true } as MatchEditState)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-foreground text-xs font-bold rounded-lg transition-colors shrink-0"
              >
                Edit Score
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
