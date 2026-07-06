import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Search, CheckCircle2, Clock, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { MatchCard } from "./MatchCard";
import { shareMatch } from "@/lib/shareMatch";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import confetti from "canvas-confetti";
import { useHashTab } from "@/hooks/useHashTab";

import { useAppMode } from "@/contexts/AppModeContext";

export function MyMatchesTab() {
  const { profile, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kudosState, setKudosState] = useState<Record<string, boolean>>({});
  
  // Sub-tab — synced to URL hash for back/forward support
  const SUB_TABS = ["all", "friendly-accepted", "friendly-requested", "tournament"] as const;
  const [subTab, setSubTab] = useHashTab(SUB_TABS, "all");
  const [searchQuery, setSearchQuery] = useState("");


  useEffect(() => {
    if (!profile?.id) return;

    const fetchMyMatches = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          player1:players!player1_id(id, full_name, avatar_url, elo_rating, singles_elo, doubles_elo, mixed_elo, gender),
          player2:players!player2_id(id, full_name, avatar_url, elo_rating, singles_elo, doubles_elo, mixed_elo, gender),
          partner1:players!team1_partner_id(id, full_name, avatar_url, elo_rating, singles_elo, doubles_elo, mixed_elo, gender),
          partner2:players!team2_partner_id(id, full_name, avatar_url, elo_rating, singles_elo, doubles_elo, mixed_elo, gender),
          submitter:players!submitted_by(id, full_name)
        `)
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id},team1_partner_id.eq.${profile.id},team2_partner_id.eq.${profile.id},submitted_by.eq.${profile.id}`)
        .not("status", "eq", "rejected")
        .order("date", { ascending: false });

      if (!error && data) {
        setMatches(data);
      }
      setLoading(false);
    };

    fetchMyMatches();
    
    const sub = supabase.channel("my_matches_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => fetchMyMatches())
      .subscribe();
      
    return () => { supabase.removeChannel(sub); };
  }, [profile?.id]);

  const filteredMatches = useMemo(() => {
    let result = matches;
    
    // Sub-tab filter
    if (subTab === "friendly-requested") {
      result = result.filter(m => m.is_friendly !== false && m.status === "pending");
    } else if (subTab === "friendly-accepted") {
      result = result.filter(m => m.is_friendly !== false && m.status === "confirmed");
    } else if (subTab === "tournament") {
      result = result.filter(m => m.is_friendly === false);
    } else {
      // all
      result = result.filter(m => m.status === "confirmed");
    }
    
    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => {
        const p1 = m.player1?.full_name?.toLowerCase() || "";
        const p2 = m.player2?.full_name?.toLowerCase() || "";
        const p3 = m.partner1?.full_name?.toLowerCase() || "";
        const p4 = m.partner2?.full_name?.toLowerCase() || "";
        return p1.includes(q) || p2.includes(q) || p3.includes(q) || p4.includes(q);
      });
    }
    
    return result;
  }, [matches, subTab, searchQuery]);

  const isKudosed = (m: any) => {
    if (kudosState.hasOwnProperty(m.id)) return kudosState[m.id];
    return (
      (Array.isArray(m.kudos_users) &&
        profile?.id &&
        m.kudos_users.includes(profile.id)) ||
      !!localStorage.getItem(`liked_${m.id}`)
    );
  };

  const handleKudos = async (match: any) => {
    const storageKey = `liked_${match.id}`;
    const isCurrentlyLiked = isKudosed(match);

    if (!isCurrentlyLiked) {
      localStorage.setItem(storageKey, "1");
      setKudosState((prev) => ({ ...prev, [match.id]: true }));
      toast.success("Match liked! ❤️");
    } else {
      localStorage.removeItem(storageKey);
      setKudosState((prev) => ({ ...prev, [match.id]: false }));
      toast.success("Like removed");
    }

    if (profile?.id) {
      supabase
        .rpc("toggle_match_kudos", { p_match_id: match.id })
        .then(({ error }) => {
          if (error) console.warn("Failed to sync likes live:", error);
        });
    }
  };

  const handleAction = async (matchId: string, action: "confirm" | "reject" | "withdraw") => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {
        console.warn("Haptics failed", e);
      }
    }
    
    if (action === "confirm") {
      const { data, error } = await supabase.rpc("accept_friendly_match", { match_uuid: matchId, confirmer_id: profile.id });
      if (error) toast.error("Failed to accept: " + error.message);
      else if (data && data.confirmed === false) {
        // Recorded, but the match still needs more players to accept (doubles)
        toast.success(`Accepted! ${data.accepted} of ${data.required} players have agreed.`);
      } else {
        toast.success("Match confirmed!");
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#10b981", "#3b82f6", "#f59e0b"]
        });
        if (Capacitor.isNativePlatform()) {
          try {
            await Haptics.impact({ style: ImpactStyle.Heavy });
          } catch (e) {}
        }
      }
    } else if (action === "reject") {
      const { error } = await supabase.rpc("reject_friendly_match", {
        match_uuid: matchId,
        rejecter_id: profile.id,
      });
      if (error) toast.error("Failed to reject match: " + error.message);
      else toast.success("Match rejected.");
    } else if (action === "withdraw") {
      const { error } = await supabase.from("matches").delete().eq("id", matchId);
      if (error) toast.error("Failed to withdraw match: " + error.message);
      else toast.success("Match withdrawn.");
    }
  };

  if (!profile) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mt-6">
        <h3 className="text-xl font-black text-foreground dark:text-foreground mb-2">Sign in Required</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">You must be signed in to view your personal match history and pending requests.</p>
        <button
          onClick={() => {
            sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
            setLocation("/join");
          }}
          className="px-6 py-3 bg-primary hover:bg-primary text-primary-foreground font-bold rounded-xl transition shadow-lg shadow-primary/20"
        >
          Sign In
        </button>
      </div>
    );
  }

  const { mode } = useAppMode();

  return (
    <div className="w-full max-w-3xl mx-auto pb-12">
      {/* Controls */}
      <div className={`sticky ${mode === "personal" ? "top-0 lg:top-0" : "top-[56px] lg:top-[72px]"} z-30 bg-slate-50 dark:bg-slate-950 -mx-4 px-4 py-2 mb-2`}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm border border-slate-200 dark:border-slate-800">
        
        {/* Tabs - 3 Rows */}
        <div className="flex flex-col gap-2 mb-3">
          
          {/* Row 1: All */}
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl">
            <button 
              onClick={() => setSubTab("all")}
              className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-colors ${subTab === "all" ? "bg-white dark:bg-slate-700 shadow-sm text-foreground dark:text-foreground" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}
            >
              All
            </button>
          </div>

          {/* Row 2: Friendly | Tournament */}
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl">
            <button 
              onClick={() => setSubTab("friendly-accepted")}
              className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-colors relative ${subTab.startsWith("friendly") ? "bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-primary" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}
            >
              Friendly
              {matches.some((m: any) => m.is_friendly !== false && m.status === "pending" && m.submitted_by !== profile.id) && (
                <span className="absolute top-1 right-1 sm:right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
            <button 
              onClick={() => setSubTab("tournament")}
              className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-colors relative ${subTab === "tournament" ? "bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}
            >
              Tournament
            </button>
          </div>

          {/* Row 3: Requested | Accepted (Only visible if Friendly is selected) */}
          {subTab.startsWith("friendly") && (
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <button 
                onClick={() => setSubTab("friendly-requested")}
                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-colors relative ${subTab === "friendly-requested" ? "bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}
              >
                Requested
                {matches.some((m: any) => m.is_friendly !== false && m.status === "pending" && m.submitted_by !== profile.id) && (
                  <span className="absolute top-1 right-1 sm:right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
              <button 
                onClick={() => setSubTab("friendly-accepted")}
                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-colors relative ${subTab === "friendly-accepted" ? "bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-primary" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}
              >
                Accepted
              </button>
            </div>
          )}

        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search opponents, partners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground dark:text-foreground"
            />
          </div>
        </div>
      </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-12" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-16" />
                <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-xl w-24" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-black text-foreground dark:text-foreground mb-2">No Matches Found</h3>
          <p className="text-muted-foreground text-sm">You don't have any {subTab !== "all" ? subTab === "friendly-requested" ? "requested" : "accepted" : ""} matches matching your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map(match => {
            const isPending = match.status === "pending";
            const iAmSubmitter = match.submitted_by === profile.id;
            const isDoubles = !!(match.team1_partner_id || match.team2_partner_id);
            const requiredAccepts = isDoubles ? 3 : 2;
            const acceptedCount = 1 + (Array.isArray(match.confirmed_by) ? match.confirmed_by.length : 0);
            const iAmParticipant = [match.player1_id, match.player2_id, match.team1_partner_id, match.team2_partner_id].includes(profile.id);
            const iAlreadyAccepted = Array.isArray(match.confirmed_by) && match.confirmed_by.includes(profile.id);
            const needsMyAction = isPending && iAmParticipant && !iAmSubmitter && !iAlreadyAccepted;

            return (
              <MatchCard
                key={match.id}
                match={match}
                currentUser={profile}
                isLiveNow={false}
                isMatchOfTheDay={false}
                upsetDiff={0}
                isKudosed={isKudosed(match)}
                kudosCount={
                  Array.isArray(match.kudos_users)
                    ? match.kudos_users.length +
                      (kudosState[match.id] === true && !match.kudos_users.includes(profile?.id) ? 1 : 0) +
                      (kudosState[match.id] === false && match.kudos_users.includes(profile?.id) ? -1 : 0)
                    : (match.kudos_count || 0) + (kudosState[match.id] === true ? 1 : 0)
                }
                onKudos={() => handleKudos(match)}
                onShare={() => shareMatch(match)}
                index={0}
              >
                {/* Actions Row */}
                <div className="flex flex-col items-center gap-2 mt-2 text-center">
                  {isPending ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider rounded-lg">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 dark:bg-primary/30 text-primary dark:text-primary text-xs font-black uppercase tracking-wider rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                    </span>
                  )}

                  {isAdmin && match.submitter?.full_name && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground dark:text-muted-foreground">
                      <Send className="w-3 h-3 shrink-0" /> Submitted by: <span className="font-bold text-muted-foreground dark:text-slate-300">{match.submitter.full_name}</span>
                    </span>
                  )}

                  {needsMyAction && (
                    <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
                      {isDoubles && (
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {acceptedCount}/{requiredAccepts} accepted
                        </p>
                      )}
                      <div className="flex gap-2 w-full sm:w-auto justify-center">
                        <button onClick={() => handleAction(match.id, "reject")} className="flex-1 sm:flex-none px-4 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-xl transition-colors">
                          Reject
                        </button>
                        <button onClick={() => handleAction(match.id, "confirm")} className="flex-1 sm:flex-none px-6 py-2 bg-primary hover:bg-primary text-primary-foreground text-sm font-bold rounded-xl shadow-lg shadow-primary/20 transition-colors">
                          Accept Match
                        </button>
                      </div>
                    </div>
                  )}
                  {isPending && !needsMyAction && (iAmSubmitter || iAlreadyAccepted) && (
                    <div className="flex flex-col items-center gap-2 mt-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">
                        {isDoubles ? `Waiting for players — ${acceptedCount}/${requiredAccepts} accepted` : "Waiting for opponent"}
                      </p>
                      {iAmSubmitter && (
                        <button
                          onClick={() => {
                            if (typeof (window as any).Capacitor !== "undefined") {
                              handleAction(match.id, "withdraw");
                            } else if (window.confirm("Are you sure you want to withdraw this match request?")) {
                              handleAction(match.id, "withdraw");
                            }
                          }}
                          className="px-4 py-1.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors"
                        >
                          Withdraw Request
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </MatchCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
