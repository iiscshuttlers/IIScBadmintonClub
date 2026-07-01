import { useState, useEffect } from "react";
import { useLiveSiteData } from "@/hooks/useMatches";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { UmpireEngine } from "./UmpireEngine";
import { BwfMatchState, MatchEditState } from "@/types/umpire";
import { Play, Tv2, AlertTriangle, Swords } from "lucide-react";
import { useUmpireStore } from "@/store/umpireStore";
import { fetchSiteData } from "@/lib/siteData";
import { BeautifulScoreDisplay } from "@/components/feed/BeautifulScoreDisplay";
import { UmpireTournamentTab, type TournamentMatchForUmpire } from "./UmpireTournamentTab";

export function UmpireTab({ tournamentOnly = false }: { tournamentOnly?: boolean }) {
  const { session, isUmpire } = useAuth();
  const [isUmpiring, setIsUmpiring] = useState(false);
  const [myLiveMatch, setMyLiveMatch] = useState<BwfMatchState | MatchEditState | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"friendly" | "tournament">(() => {
    if (tournamentOnly) return "tournament";
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "tournament" ? "tournament" : "friendly";
  });

  useEffect(() => {
    if (tournamentOnly) return;
    const params = new URLSearchParams(window.location.search);
    if (activeSubTab === "friendly") {
      params.delete("mode");
    } else {
      params.set("mode", "tournament");
    }
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", newUrl);
  }, [activeSubTab, tournamentOnly]);
  const [activeTournamentMatch, setActiveTournamentMatch] = useState<TournamentMatchForUmpire | null>(null);
  const resetUmpireStore = useUmpireStore((s) => s.reset);
  // Admin "take over" of another umpire's broadcast (key = original umpire's id)
  const [takeoverKey, setTakeoverKey] = useState<string | null>(null);
  const [takeoverMatch, setTakeoverMatch] = useState<BwfMatchState | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    const key = sessionStorage.getItem("umpire_takeover_key");
    if (!key) return;
    sessionStorage.removeItem("umpire_takeover_key");
    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .single()
      .then(({ data }) => {
        const m = data?.value?.[key] as BwfMatchState | undefined;
        if (m && m.status && m.status !== "setup") {
          setTakeoverKey(key);
          setTakeoverMatch(m);
        }
      });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;

    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .single()
      .then(({ data }) => {
        if (data?.value && data.value[session.user.id]) {
          setMyLiveMatch(data.value[session.user.id] as BwfMatchState);
        }
      });

    fetchSiteData<{ maintenanceMode?: boolean }>("club_settings", "settings.json").then(data => {
      if (data?.maintenanceMode) {
        setMaintenanceMode(true);
      }
    });

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
          const newValue = (payload.new as Record<string, unknown>)?.value;
          if (newValue) {
            setMyLiveMatch((newValue[session.user.id] as BwfMatchState) || null);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [session?.user?.id]);

  if (!session) return null;

  // Admin took over a running broadcast — drive it under the original umpire's key
  if (takeoverKey && takeoverMatch) {
    return (
      <div className="-mx-4 sm:mx-0 mb-6">
        <UmpireEngine
          userId={takeoverKey}
          userEmail={session.user.email!}
          userName={session.user.user_metadata?.full_name || "Guest"}
          isTournamentUmpire={isUmpire}
          initialMatchState={takeoverMatch}
          onClose={() => {
            setTakeoverKey(null);
            setTakeoverMatch(null);
          }}
        />
      </div>
    );
  }

  // Tournament match umpiring
  if (activeTournamentMatch) {
    return (
      <div className="-mx-4 sm:mx-0 mb-6">
        <UmpireEngine
          userId={session.user.id}
          userEmail={session.user.email!}
          userName={session.user.user_metadata?.full_name || "Guest"}
          isTournamentUmpire={isUmpire}
          initialMatchState={null}
          tournamentMatch={activeTournamentMatch}
          onClose={() => setActiveTournamentMatch(null)}
        />
      </div>
    );
  }

  if (isUmpiring || myLiveMatch) {
    return (
      <div className="-mx-4 sm:mx-0 mb-6">
        <UmpireEngine
          userId={session.user.id}
          userEmail={session.user.email!}
          userName={session.user.user_metadata?.full_name || "Guest"}
          isTournamentUmpire={isUmpire}
          initialMatchState={myLiveMatch}
          onClose={() => {
            setIsUmpiring(false);
            setMyLiveMatch(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-6">
      {/* Sub-tabs */}
      {!tournamentOnly && (
        <div className="flex gap-2 bg-slate-900 p-1 rounded-2xl w-fit mx-auto">
          <button
            onClick={() => setActiveSubTab("friendly")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeSubTab === "friendly" ? "bg-primary text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Tv2 className="w-4 h-4" /> Friendly
          </button>
          <button
            onClick={() => setActiveSubTab("tournament")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeSubTab === "tournament" ? "bg-primary text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Swords className="w-4 h-4" /> Tournament
          </button>
        </div>
      )}

      {activeSubTab === "friendly" && (
        <>
          <div className="flex flex-col items-center justify-center bg-slate-900 rounded-[2rem] p-12 shadow-xl border border-slate-800 gap-6 text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
              <Tv2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-foreground mb-2">Umpire Station</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {maintenanceMode
                  ? "Match logging is temporarily disabled due to system maintenance."
                  : "Start a new live broadcast. Your match will be visible to everyone in the Match Activity feed."}
              </p>
            </div>
            {maintenanceMode ? (
              <div className="bg-rose-900/40 text-rose-300 px-6 py-4 rounded-xl flex items-center gap-3 border border-rose-800">
                <AlertTriangle className="w-6 h-6" />
                <span className="font-bold">Maintenance Mode Active</span>
              </div>
            ) : (
              <button
                onClick={() => setIsUmpiring(true)}
                className="px-6 py-4 bg-primary hover:bg-primary text-foreground font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors text-lg"
              >
                <Play className="w-6 h-6 fill-white" /> Start Umpiring
              </button>
            )}
          </div>
          <RecentUmpireMatches
            isTournament={false}
            onEdit={(matchData) => {
              setMyLiveMatch(matchData);
              setIsUmpiring(true);
            }}
          />
        </>
      )}

      {activeSubTab === "tournament" && (
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800">
            <h2 className="text-xl font-black text-foreground mb-5">Tournament Matches</h2>
            <UmpireTournamentTab onStartMatch={(m) => { resetUmpireStore(); setActiveTournamentMatch(m); }} />
          </div>
          <RecentUmpireMatches
            isTournament={true}
            onEdit={(matchData) => {
              setMyLiveMatch(matchData);
              setIsUmpiring(true);
            }}
          />
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

  useEffect(() => {
    if (!profile?.id) return;
    const fetchRecent = async () => {
      let data;
      if (isTournament) {
        let query = supabase
          .from("tournament_matches")
          .select("id, player1_id, player2_id, team1_partner_id:player3_id, team2_partner_id:player4_id, winner_id, score, sets_history, round:round_name, category, created_at:scored_at, team1_label, team2_label, player1:players!player1_id(full_name, gender), player2:players!player2_id(full_name, gender), partner1:players!player3_id(full_name, gender), partner2:players!player4_id(full_name, gender)")
          .eq("status", "completed")
          .order("scored_at", { ascending: false });
        if (isAdmin) {
          query = query.limit(50);
        } else {
          const fifteenMinsAgo = new Date(Date.now() - 900000).toISOString();
          query = query.eq("scored_by", profile.id).gte("scored_at", fifteenMinsAgo).limit(10);
        }
        const res = await query;
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
        data = res.data;
      }
      if (data) setRecent(data as any);
    };
    fetchRecent();
    const interval = setInterval(fetchRecent, 30000);
    return () => clearInterval(interval);
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
                filterFormat === f ? "bg-primary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
