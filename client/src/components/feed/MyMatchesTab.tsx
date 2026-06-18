import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Search, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { MatchCard } from "./MatchCard";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import confetti from "canvas-confetti";
import { useHashTab } from "@/hooks/useHashTab";

export function MyMatchesTab() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kudosState, setKudosState] = useState<Record<string, boolean>>({});
  
  // Sub-tab — synced to URL hash for back/forward support
  const SUB_TABS = ["all", "requested", "accepted"] as const;
  const [subTab, setSubTab] = useHashTab(SUB_TABS, "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    if (!profile?.id) return;

    const fetchMyMatches = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          player1:players!player1_id(id, full_name, avatar_url),
          player2:players!player2_id(id, full_name, avatar_url),
          partner1:players!team1_partner_id(id, full_name, avatar_url),
          partner2:players!team2_partner_id(id, full_name, avatar_url)
        `)
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id},team1_partner_id.eq.${profile.id},team2_partner_id.eq.${profile.id},submitted_by.eq.${profile.id}`)
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
    
    // Sub-tab filter — "requested" = pending matches, "accepted" = confirmed
    if (subTab === "requested") result = result.filter(m => m.status === "pending");
    if (subTab === "accepted") result = result.filter(m => m.status === "confirmed");
    
    // Category filter
    if (categoryFilter !== "All") {
      result = result.filter(m => m.category && m.category.includes(categoryFilter));
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
  }, [matches, subTab, searchQuery, categoryFilter]);

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

  const handleAction = async (matchId: string, action: "confirm" | "reject") => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {
        console.warn("Haptics failed", e);
      }
    }
    
    if (action === "confirm") {
      const { error } = await supabase.rpc("confirm_friendly_match", { match_uuid: matchId });
      if (error) toast.error("Failed to confirm: " + error.message);
      else {
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
    } else {
      const { error } = await supabase.from("matches").delete().eq("id", matchId);
      if (error) toast.error("Failed to reject match");
      else toast.success("Match rejected and removed.");
    }
  };

  if (!profile) {
    return (
      <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mt-6">
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Sign in Required</h3>
        <p className="text-slate-500 mb-6 max-w-sm mx-auto">You must be signed in to view your personal match history and pending requests.</p>
        <button
          onClick={() => {
            sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
            setLocation("/join");
          }}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-500/20"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto pb-12">
      {/* Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 mb-6 sticky top-[72px] z-20">
        
        {/* Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl mb-4">
          <button 
            onClick={() => setSubTab("all")}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${subTab === "all" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            All Matches
          </button>
          <button 
            onClick={() => setSubTab("requested")}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors relative ${subTab === "requested" ? "bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            Requested
            {matches.some(m => m.status === "pending" && m.submitted_by !== profile.id) && (
              <span className="absolute top-2 right-4 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>
          <button 
            onClick={() => setSubTab("accepted")}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${subTab === "accepted" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            Accepted
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search opponent name..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white"
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="All">All Formats</option>
            <option value="Singles">Singles</option>
            <option value="Doubles">Doubles</option>
            <option value="Mixed Doubles">Mixed Doubles</option>
            <option value="Hybrid">Hybrid</option>
          </select>
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
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">No Matches Found</h3>
          <p className="text-slate-500 text-sm">You don't have any {subTab !== "all" ? subTab === "requested" ? "requested" : "accepted" : ""} matches matching your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map(match => {
            const isPending = match.status === "pending";
            const iAmSubmitter = match.submitted_by === profile.id;
            const needsMyAction = isPending && !iAmSubmitter;

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
                index={0}
              >
                {/* Actions Row */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    {isPending ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider rounded-lg">
                        <Clock className="w-3.5 h-3.5" /> Pending
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                      </span>
                    )}
                  </div>

                  {needsMyAction && (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleAction(match.id, "reject")} className="flex-1 sm:flex-none px-4 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-xl transition-colors">
                        Reject
                      </button>
                      <button onClick={() => handleAction(match.id, "confirm")} className="flex-1 sm:flex-none px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-colors">
                        Accept Match
                      </button>
                    </div>
                  )}
                  {isPending && iAmSubmitter && (
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-right">
                      Waiting for opponent
                    </p>
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
