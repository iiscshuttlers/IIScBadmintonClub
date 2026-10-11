import { useState, useEffect, useRef } from "react";
import { useLiveSiteData } from "@/hooks/useMatches";
import { resolveTeamName } from "@/lib/teamNames";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { UmpireEngine } from "./UmpireEngine";
import { BwfMatchState, MatchEditState } from "@/types/umpire";
import { Play, Tv2, AlertTriangle, Swords, Lock, CalendarX, ChevronDown, ChevronUp, Clock, Hash, Search, Filter, CheckCircle2, User, Trophy } from "lucide-react";
import { format } from "date-fns";
import { useUmpireStore } from "@/store/umpireStore";
import { fetchSiteData } from "@/lib/siteData";
import { BeautifulScoreDisplay } from "@/components/feed/BeautifulScoreDisplay";
import { UmpireTournamentTab, type TournamentMatchForUmpire } from "./UmpireTournamentTab";
import { toast } from "sonner";
import { recoverMatchFromTournamentRow, splitSets } from "@/lib/umpire/resumeRecovery";
import { RecentMatchCard, type RecentMatchData } from "./RecentMatchCard";

const SETUP_STORAGE_KEY = "umpire_setup_matches_v1";

export function UmpireTab({ tournamentOnly = false }: { tournamentOnly?: boolean }) {
  const { session, isUmpire, profile } = useAuth();
  // Only master_admin, admin, and umpire roles can run tournament matches
  const hasElevatedRole = isUmpire && (
    profile?.role === 'master_admin' || profile?.role === 'admin' || profile?.role === 'umpire'
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

  /**
   * Overlay the bracket's current team labels onto a resumed live-match
   * snapshot. Only names and the player ids behind them are touched — scores,
   * games, serve state, point log and status are taken from the snapshot
   * untouched, so resuming can never alter the state of a match in play.
   */
  const withFreshTeamNames = (liveState: any, bracketRow: any) => {
    if (!liveState || !bracketRow) return liveState;

    const splitTeam = (label: string | null | undefined): string[] =>
      (label ?? "").split(/[&,]/).map((s: string) => s.trim()).filter(Boolean);

    const applySide = (
      side: any,
      label: string | null | undefined,
      p1Id: string | null | undefined,
      p2Id: string | null | undefined,
    ) => {
      const names = splitTeam(label);
      if (!names.length) return side; // nothing usable in the bracket — keep the snapshot
      return {
        ...side,
        p1Name: names[0] ?? side?.p1Name,
        // Only fill p2 for a genuine doubles pairing; never invent one.
        ...(names.length > 1 ? { p2Name: names[1] } : {}),
        ...(p1Id ? { p1Id } : {}),
        ...(p2Id ? { p2Id } : {}),
        teamName: label ?? side?.teamName,
      };
    };

    return {
      ...liveState,
      t1: applySide(liveState.t1, bracketRow.team1_label, bracketRow.player1_id, bracketRow.player3_id),
      t2: applySide(liveState.t2, bracketRow.team2_label, bracketRow.player2_id, bracketRow.player4_id),
    };
  };

  const startMatch = async (m: any) => {
    try { localStorage.removeItem(SETUP_STORAGE_KEY); } catch {}
    resetUmpireStore();

    if (m.status === "in_progress" && m.match_code) {
      const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").maybeSingle();
      const liveState = (data?.value && typeof data.value === 'object')
        ? (data.value as Record<string, any>)[m.id]
        : undefined;

      if (liveState) {
        setActiveMatches(prev => {
          setActiveMatchIndex(prev.length);
          // The snapshot froze the team names at the moment the match started,
          // so a participant fixed up afterwards (a partner supplied late, a
          // typo corrected) never showed here. Re-apply the current bracket
          // labels while keeping every bit of scoring state from the snapshot.
          return [...prev, withFreshTeamNames(liveState, m)];
        });
        return;
      }

      // The row says the match is in progress but its live snapshot is gone.
      // Resuming used to fall through to the pre-fill path below and silently
      // restart the match at 0-0, throwing away every game already played.
      // The tournament row still holds the score and completed sets, so
      // recover from that instead.
      const { data: row } = await supabase
        .from("tournament_matches")
        .select("score, sets_history")
        .eq("id", m.id)
        .maybeSingle();

      const { completed, current } = splitSets(row ?? { score: null, sets_history: null });
      if (completed.length > 0 || current[0] > 0 || current[1] > 0) {
        const recovered = recoverMatchFromTournamentRow(
          m,
          row ?? { score: null, sets_history: null },
          {
            id: session!.user.id,
            name: profile?.full_name || session!.user.email?.split("@")[0] || "Umpire",
          },
        );
        setActiveMatches(prev => {
          setActiveMatchIndex(prev.length);
          return [...prev, recovered];
        });
        toast(
          `Recovered ${completed.length > 0 ? completed.join(", ") + " | " : ""}${current[0]}-${current[1]}. ` +
          "The point log and serve order could not be restored — check who is serving before continuing.",
          { duration: 10000, icon: "⚠️" },
        );
        return;
      }
    }

    setActiveMatches(prev => {
      // If this match is already in activeMatches, switch to it
      const existingIdx = prev.findIndex(item => ('id' in item && 'id' in m && item.id === m.id));
      if (existingIdx !== -1) {
        // Replace existing with the newly passed state (e.g. edit state) and switch tab
        const updated = [...prev];
        updated[existingIdx] = m;
        setActiveMatchIndex(existingIdx);
        return updated;
      }
      setActiveMatchIndex(prev.length);
      return [...prev, m];
    });
  };

  const showNewMatch = activeMatches.length === 0 || activeMatchIndex === -1;
  const currentMatch = activeMatches[activeMatchIndex];
  const isEditMatch = Boolean(currentMatch && 'is_edit_mode' in currentMatch && (currentMatch as any).is_edit_mode);
  const isTournamentMatch = !isEditMatch && Boolean(currentMatch && 'id' in currentMatch && 'match_code' in currentMatch);


  return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-4 space-y-6">
      {/* Tabs - Only show when there are in-progress or queued active matches */}
      {activeMatches.length > 0 && (
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
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                  activeMatchIndex === idx
                    ? "bg-primary text-slate-950 border-primary shadow-sm shadow-primary/20"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{mLabel}</span>
                  <div 
                    onClick={(e) => { e.stopPropagation(); removeMatch(idx); }}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/20 text-current transition"
                  >
                    <span className="text-xs">×</span>
                  </div>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => {
              try { localStorage.removeItem(SETUP_STORAGE_KEY); } catch {}
              resetUmpireStore();
              setActiveMatchIndex(-1);
            }}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 ${
              showNewMatch
                ? "bg-slate-800 border-slate-700 text-white shadow-xs"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <span className="text-sm leading-none">+</span> New Match
          </button>
        </div>
      )}

      {!showNewMatch && currentMatch && (
        <div className="relative border border-slate-700 rounded-[2rem] overflow-hidden bg-slate-900 shadow-xl">
          <UmpireEngine
            key={('id' in currentMatch ? currentMatch.id : activeMatchIndex)}
            userId={session.user.id}
            userEmail={session.user.email!}
            userName={profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "Guest"}
            isTournamentUmpire={canRunTournament}
            initialMatchState={isTournamentMatch ? null : currentMatch as BwfMatchState | MatchEditState}
            tournamentMatch={isTournamentMatch ? currentMatch as TournamentMatchForUmpire : undefined}
            onClose={() => removeMatch(activeMatchIndex)}
          />
        </div>
      )}

      {showNewMatch && (
        <div className="space-y-6">
          {/* Umpire Hub Compact Header & Actions */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-wider">
                    <Swords className="w-3 h-3" />
                    Umpire Desk
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Start or Officiate Match
                  </h2>
                </div>
                <p className="text-xs text-slate-400">
                  Launch a friendly scrimmage with BWF scoring rules or pick assigned tournament matches.
                </p>
              </div>

              {/* Start Friendly Match Button */}
              <div className="shrink-0">
                <button
                  onClick={() => startMatch({
                    id: crypto.randomUUID(),
                    is_edit_mode: false,
                  })}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5 text-slate-950" />
                  Start Friendly Match
                </button>
              </div>
            </div>

            {/* Tournament Matches Section */}
            {hasActiveTournament && canRunTournament && (
              <div className="mt-4 pt-3.5 border-t border-slate-800/80">
                <div className="flex items-center gap-2 mb-2.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">Tournament Matches</h3>
                </div>
                <UmpireTournamentTab onStartMatch={startMatch} />
              </div>
            )}

            {/* Informative banner when tournament umpiring is unavailable */}
            {!canRunTournament && (
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 flex gap-3 items-start">
                {!hasActiveTournament ? (
                  <>
                    <CalendarX className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-300">No Active Tournament Scheduled</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Official tournament fixtures and line-ups appear automatically when a tournament is underway. You can always score friendly matches above.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-300">Umpire Role Required for Tournament Fixtures</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        You are currently signed in without the official Umpire or Admin credential. Contact the club desk to unlock tournament scorekeeping.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recent Submissions Log */}
          {hasActiveTournament && canRunTournament ? (
            <RecentUmpireMatches
              isTournament={true}
              onEdit={startMatch}
            />
          ) : (
            <RecentUmpireMatches
              isTournament={false}
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
  match_code?: string | null;
};

function RecentUmpireMatches({ onEdit, isTournament }: { onEdit: (m: MatchEditState) => void, isTournament: boolean }) {
  const { profile, isAdmin } = useAuth();
  const [recent, setRecent] = useState<RecentMatchData[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  const [filterFormat, setFilterFormat] = useState<string>("ALL");
  const [filterScoredByMe, setFilterScoredByMe] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState<number>(8);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const fetchRecent = async () => {
      let data: any[] = [];
      if (isTournament) {
        let query = supabase
          .from("tournament_matches")
          .select(`
            id, 
            match_code, 
            rubber_label,
            rubber_order,
            court_number,
            player1_id, 
            player2_id, 
            team1_partner_id:player3_id, 
            team2_partner_id:player4_id, 
            winner_id, 
            winner_side,
            score, 
            sets_history, 
            round:round_name, 
            category, 
            created_at:scored_at,
            scored_at, 
            scored_by,
            team1_label, 
            team2_label, 
            player1:players!player1_id(full_name, gender), 
            player2:players!player2_id(full_name, gender), 
            partner1:players!player3_id(full_name, gender), 
            partner2:players!player4_id(full_name, gender),
            tie:tournament_ties(
              id,
              tie_code,
              team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name),
              team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)
            )
          `)
          .eq("status", "completed")
          .order("scored_at", { ascending: false });

        if (isAdmin) {
          query = query.limit(500);
        } else {
          query = query.limit(100);
        }
        const res = await query;
        if (res.error) {
          console.error("Failed to load tournament submissions:", res.error);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }
        data = res.data?.map(m => ({ ...m, is_friendly: false, is_tournament_match: true })) || [];
      } else {
        let query = supabase
          .from("matches")
          .select("*, player1:players!player1_id(full_name, gender), player2:players!player2_id(full_name, gender), partner1:players!team1_partner_id(full_name, gender), partner2:players!team2_partner_id(full_name, gender)")
          .in("status", ["confirmed", "pending"])
          .order("created_at", { ascending: false });

        if (isAdmin) {
          query = query.limit(500);
        } else {
          query = query.limit(100);
        }
        const res = await query;
        if (res.error) {
          console.error("Failed to load friendly match submissions:", res.error);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }
        data = res.data || [];
      }
      if (data) setRecent(data as any);
    };

    fetchRecent();
    intervalRef.current = setInterval(fetchRecent, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [profile?.id, isAdmin, isTournament]);

  if (recent.length === 0) return null;

  // Filter pipeline
  const filteredMatches = recent.filter(m => {
    const isByeMatch = m.team1_label === "BYE" || m.team2_label === "BYE" || m.score === "BYE" || (m.team1_label || "").toUpperCase().includes("BYE") || (m.team2_label || "").toUpperCase().includes("BYE");
    if (isByeMatch) return false;

    // Filter by Scored By Me
    if (filterScoredByMe && profile?.id && m.scored_by !== profile.id) {
      return false;
    }

    // Resolve Category
    const p1g = m.player1?.gender?.toLowerCase();
    const p2g = m.player2?.gender?.toLowerCase();
    const p3g = m.partner1?.gender?.toLowerCase();
    const p4g = m.partner2?.gender?.toLowerCase();

    let matchFormat = (m.category || "").toUpperCase();
    if (matchFormat === "DOUBLES" || (!matchFormat && (m.partner1 || m.partner2))) {
      const t1HasM = p1g === "male" || p3g === "male";
      const t1HasF = p1g === "female" || p3g === "female";
      const t2HasM = p2g === "male" || p4g === "male";
      const t2HasF = p2g === "female" || p4g === "female";
      if (t1HasM && t1HasF && t2HasM && t2HasF) matchFormat = "XD";
      else if (p1g === "female" && p3g === "female") matchFormat = "WD";
      else matchFormat = "MD";
    } else if (matchFormat === "SINGLES" || !matchFormat) {
      if (p1g === "female" || p2g === "female") matchFormat = "WS";
      else matchFormat = "MS";
    }

    if (filterFormat !== "ALL" && matchFormat !== filterFormat) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const p1Name = m.player1?.full_name?.toLowerCase() || "";
      const p2Name = m.player2?.full_name?.toLowerCase() || "";
      const p3Name = m.partner1?.full_name?.toLowerCase() || "";
      const p4Name = m.partner2?.full_name?.toLowerCase() || "";
      const t1Label = m.team1_label?.toLowerCase() || "";
      const t2Label = m.team2_label?.toLowerCase() || "";
      const mCode = m.match_code?.toLowerCase() || "";
      const teamAName = m.tie?.team_a?.name?.toLowerCase() || "";
      const teamBName = m.tie?.team_b?.name?.toLowerCase() || "";

      if (
        !p1Name.includes(q) && 
        !p2Name.includes(q) && 
        !p3Name.includes(q) && 
        !p4Name.includes(q) && 
        !t1Label.includes(q) && 
        !t2Label.includes(q) &&
        !mCode.includes(q) &&
        !teamAName.includes(q) &&
        !teamBName.includes(q)
      ) {
        return false;
      }
    }

    return true;
  });

  const displayedMatches = filteredMatches.slice(0, visibleCount);

  return (
    <div className="bg-slate-900 rounded-[2rem] p-5 sm:p-6 shadow-xl border border-slate-800 space-y-4">
      {/* Header Bar */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
              Recent Submissions
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
                {filteredMatches.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live score submissions with a 10-minute edit grace period and scorecard review.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="p-1.5 rounded-full hover:bg-slate-800 transition text-slate-400">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (Kept accessible when expanded) */}
      {isExpanded && (
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search player, team, code, rubber..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/60 text-white text-xs rounded-xl border border-slate-800 pl-9 pr-3 py-2 outline-none focus:border-primary transition"
              />
            </div>

            {/* Filter Toggle: All vs Scored By Me */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterScoredByMe(!filterScoredByMe)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  filterScoredByMe
                    ? "bg-primary text-slate-950 border-primary font-black shadow-xs"
                    : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>My Submissions Only</span>
              </button>

              {/* Category Pills */}
              <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto hide-scrollbar">
                {["ALL", "MS", "WS", "MD", "WD", "XD"].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterFormat(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-black whitespace-nowrap transition-all ${
                      filterFormat === f 
                        ? "bg-primary text-slate-950 shadow-xs" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Grid */}
          {filteredMatches.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
              <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">No submissions matching criteria</p>
              <p className="text-xs text-slate-500 mt-1">Try resetting category or search filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 pt-1">
              {displayedMatches.map(m => (
                <RecentMatchCard
                  key={m.id}
                  match={m}
                  isAdmin={isAdmin}
                  currentUserId={profile?.id}
                  onEdit={onEdit}
                />
              ))}

              {/* Load More Button if results exceed initial page */}
              {filteredMatches.length > visibleCount && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => prev + 8)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                  >
                    Load More Submissions ({filteredMatches.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
