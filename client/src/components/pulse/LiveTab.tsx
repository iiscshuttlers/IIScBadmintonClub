import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Activity,
  Trophy,
  Search,
  ChevronDown,
  Clock,
  UserCheck,
  LayoutList,
  Users,
  Tv2,
  ListChecks,
  FileText,
  Calendar
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useFeedMatches } from "@/hooks/useFeedMatches";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { LiveScoreSection } from "@/components/events/LiveScoreSection";
import { LiveBracketsSection } from "@/components/events/LiveBracketsSection";
import { LiveStandingsSection } from "@/components/events/LiveStandingsSection";
import { LivePlayersSection } from "@/components/events/LivePlayersSection";
import { PollsSection } from "@/components/feed/PollsSection";
import { LiveMatchSchedule } from "@/components/events/LiveMatchSchedule";
import { TournamentDetailsTab } from "@/components/pulse/TournamentDetailsTab";
import { MatchSection } from "@/components/pulse/MatchSection";
import { MatchCard } from "@/components/feed/MatchCard";
import { UmpireTab } from "@/components/umpire/UmpireTab";
import { MatchPredictionCard } from "@/components/feed/MatchPredictions";
import { shareMatch } from "@/lib/shareMatch";
import ErrorBoundary from "@/components/ErrorBoundary";

export function LiveTab() {
  const { session, profile: ownProfile, isUmpire, isAdmin } = useAuth();
  const { liveMatchIds, hasLiveMatches } = useLiveMatches();

  const getInitialParam = (param: string, defaultVal: string) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param) || defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<any>(() => getInitialParam("tab", "matches"));

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", activeSubTab);
      window.history.replaceState(null, "", url.toString());
    } catch { /* ignore */ }
  }, [activeSubTab]);
  const [activeTournament, setActiveTournament] = useState<any | null>(null);
  useEffect(() => {
    supabase.from("tournaments").select("*").eq("status", "active").limit(1).then(({ data }) => {
      if (data && data.length > 0) setActiveTournament(data[0]);
    });
  }, []);
  const activeTournamentId = activeTournament?.id;

  const [feedView, setFeedView] = useState<"my" | "tournament">("tournament");

  // Dynamic URL syncing for Tournament Matches
  const [matchStatus, setMatchStatus] = useState<string>(() => getInitialParam("m_status", "upcoming"));
  const [matchCat, setMatchCat] = useState<string>(() => getInitialParam("m_cat", "ALL"));

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("m_status", matchStatus);
      url.searchParams.set("m_cat", matchCat);
      window.history.replaceState(null, "", url.toString());
    } catch { /* ignore */ }
  }, [matchStatus, matchCat]);

  const {
    loading,
    matches,
    displayMatches,
    limitCount,
    setLimitCount,
    courtUtil,
    matchOfTheDayId,
    weeklyRecap,
    categoryFilter,
    setCategoryFilter,
    timeFilter,
    setTimeFilter,
    tournamentFilter,
    setTournamentFilter,
    searchQuery,
    setSearchQuery
  } = useFeedMatches(ownProfile, 2000);

  const { matches: myAllMatches } = usePlayerMatches(ownProfile?.id);

  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});
  const [revealedMatchIds, setRevealedMatchIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!ownProfile?.id) return;
    const loadPicks = async () => {
      const { data: myVotes } = await supabase
        .from("live_match_votes")
        .select("live_match_id, pick")
        .eq("user_id", ownProfile.id);
      if (myVotes) {
        const p: Record<string, 1 | 2> = {};
        myVotes.forEach(v => { p[v.live_match_id] = v.pick as 1 | 2; });
        setPicks(p);
      }
      const { data: siteData } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "poll_revealed_matches")
        .single();
      if (siteData?.value) {
        setRevealedMatchIds(siteData.value as Record<string, boolean>);
      }
    };
    loadPicks();
  }, [ownProfile?.id]);

  const handlePick = async (matchId: string, team: 1 | 2) => {
    if (!ownProfile?.id) return;
    setPicks(prev => ({ ...prev, [matchId]: team }));
    await supabase.from("live_match_votes").upsert({
      live_match_id: matchId,
      user_id: ownProfile.id,
      pick: team
    }, { onConflict: 'live_match_id,user_id' });
  };

  const handleToggleReveal = async (matchId: string) => {
    if (!isAdmin) return;
    const isRevealed = !!revealedMatchIds[matchId];
    const nextState = { ...revealedMatchIds, [matchId]: !isRevealed };
    setRevealedMatchIds(nextState);
    await supabase.from("site_data").upsert({ key: "poll_revealed_matches", value: nextState }, { onConflict: "key" });
  };

  const [tournaments, setTournaments] = useState<{ id: string, name: string }[]>([]);
  useEffect(() => {
    supabase
      .from("tournaments")
      .select("id, name")
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setTournaments(data);
      });
  }, []);

  const [kudosState, setKudosState] = useState<Record<string, boolean>>({});

  const renderSkeleton = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm animate-pulse"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="flex items-center gap-3">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
          <div className="h-3 w-1/3 mx-auto bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );

  if (!activeTournamentId && !hasLiveMatches) {
    return (
      <div className="container mx-auto px-4 max-w-3xl mt-8 pb-10">
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
          <div className="w-24 h-24 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Trophy className="w-10 h-10 text-slate-300 dark:text-muted-foreground" />
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">
            No Live Tournament
          </h3>
          <p className="text-muted-foreground font-medium max-w-sm mx-auto">
            There is no active live tournament at the moment. Check the Events tab for upcoming tournaments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-3xl mt-8 pb-10">
      {activeTournament && (
        <div className="text-center mb-6 mt-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white" style={{ fontFamily: "Playfair Display, serif" }}>
            {activeTournament.name}
          </h1>
          {activeTournament.subtitle && (
            <p className="text-sm text-muted-foreground mt-1 font-medium">{activeTournament.subtitle}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pb-2 mb-6">
        {[
          { id: "details", label: "Details", icon: FileText },
          { id: "matches", label: "Matches", icon: Activity },
          { id: "polls", label: "Polls", icon: ListChecks },
          { id: "schedule", label: "Schedule", icon: Calendar },
          { id: "brackets", label: "Brackets", icon: LayoutList },
          ...((isUmpire || isAdmin) ? [{ id: "umpire", label: "Umpire", icon: Tv2 }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 ${
              activeSubTab === tab.id
                ? "bg-red-500 text-white shadow-md ring-2 ring-red-500/20 scale-105"
                : "bg-slate-200 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4 mb-[1px]" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* 0. Details */}
      {!loading && activeSubTab === "details" && activeTournament && (
        <div className="mb-6">
          <TournamentDetailsTab tournament={activeTournament} playerName={ownProfile?.full_name || null} />
        </div>
      )}

      {/* 1. Matches (Scores & Log merged) */}
      {!loading && activeSubTab === "matches" && (
        <div className="mb-6">
          <div className="-mx-4 sm:mx-0 mb-6">
            <LiveScoreSection />
          </div>
          <div className="flex bg-slate-100/80 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6 shadow-sm">
            <button
              onClick={() => setFeedView("my")}
              className={`flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
                feedView === "my"
                  ? "bg-white dark:bg-slate-800 text-violet-500 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Activity className="w-4 h-4" /> My Matches
            </button>
            <button
              onClick={() => setFeedView("tournament")}
              className={`flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
                feedView === "tournament"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Trophy className="w-4 h-4" /> Tournament Matches
            </button>
          </div>

          <div className="mb-3 relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search matches, players, formats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-foreground text-sm font-bold rounded-2xl pl-11 pr-4 py-3 outline-none border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex w-full sm:flex-1 relative">
              <select
                value={tournamentFilter}
                onChange={(e) => setTournamentFilter(e.target.value)}
                className="appearance-none bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-sm font-bold rounded-xl pl-3 pr-8 py-2 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer w-full"
              >
                <option value="all">All Tournaments</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto sm:pl-4 sm:border-l sm:border-slate-200 dark:sm:border-slate-700">
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="appearance-none w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-sm font-bold rounded-xl pl-3 pr-8 py-2 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer min-w-0"
                >
                  <option value="all">All Categories</option>
                  <option value="singles">Singles</option>
                  <option value="doubles">Doubles</option>
                  <option value="mixed">Mixed Doubles</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="appearance-none w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-sm font-bold rounded-xl pl-3 pr-8 py-2 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer min-w-0"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {loading ? (
            renderSkeleton()
          ) : displayMatches.length > 0 ? (
            <div className="space-y-4">
              {(() => {
                const upcomingMatches: any[] = [];
                const completedMatches: any[] = [];
                let myMatchesList = [...myAllMatches];

                if (searchQuery.trim()) {
                  const q = searchQuery.toLowerCase().trim();
                  myMatchesList = myMatchesList.filter((m: any) => {
                    const p1Name = m.player1?.full_name?.toLowerCase() || "";
                    const p2Name = m.player2?.full_name?.toLowerCase() || "";
                    const p3Name = m.player3?.full_name?.toLowerCase() || m.partner1?.full_name?.toLowerCase() || "";
                    const p4Name = m.player4?.full_name?.toLowerCase() || m.partner2?.full_name?.toLowerCase() || "";
                    const t1Label = m.team1_label?.toLowerCase() || "";
                    const t2Label = m.team2_label?.toLowerCase() || "";
                    const mId = m.id?.toLowerCase() || "";
                    const mNumber = m.match_number?.toString().toLowerCase() || "";
                    const mFormat = m.format?.toLowerCase() || "";
                    const mCategory = m.category?.toLowerCase() || "";
                    return (p1Name.includes(q) || p2Name.includes(q) || p3Name.includes(q) || p4Name.includes(q) || t1Label.includes(q) || t2Label.includes(q) || mId.includes(q) || mNumber.includes(q) || mFormat.includes(q) || mCategory.includes(q));
                  });
                }

                displayMatches.forEach(match => {
                  const isLiveNow = !match.is_friendly &&
                    (liveMatchIds.has(match.player1_id) || liveMatchIds.has(match.player2_id) ||
                      (match.team1_partner_id && liveMatchIds.has(match.team1_partner_id)) ||
                      (match.team2_partner_id && liveMatchIds.has(match.team2_partner_id)));
                  
                  if (isLiveNow) {
                    // Handled by LiveScoreSection, exclude from here
                  } else if (match.status === 'scheduled') {
                    upcomingMatches.push(match);
                  } else {
                    completedMatches.push(match);
                  }
                });

                myMatchesList.sort((a, b) => {
                  const getRank = (m: any) => {
                    if (m.status === 'scheduled') return 0;
                    if (m.status === 'in_progress') return 0;
                    if (m.status === 'pending') return 1;
                    return 2; 
                  };
                  const rankA = getRank(a);
                  const rankB = getRank(b);
                  if (rankA !== rankB) return rankA - rankB;
                  
                  if (rankA === 0) { 
                    if (!a.scheduled_at && !b.scheduled_at) return 0;
                    if (!a.scheduled_at) return 1;
                    if (!b.scheduled_at) return -1;
                    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
                  }
                  
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });
                
                upcomingMatches.sort((a, b) => {
                  if (!a.scheduled_at && !b.scheduled_at) return 0;
                  if (!a.scheduled_at) return 1;
                  if (!b.scheduled_at) return -1;
                  return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
                });

                const renderCard = (match: any, i: number) => {
                  const p1 = match.player1;
                  const p2 = match.player2;
                  const isP1Winner = match.winner_id === p1?.id;

                  let upsetDiff = 0;
                  if (
                    match.elo_change_p1 !== undefined &&
                    match.elo_change_p2 !== undefined &&
                    p1 && p2
                  ) {
                    const eloDiff = p1.elo_rating - p2.elo_rating;
                    if (
                      (isP1Winner && eloDiff < -150) ||
                      (!isP1Winner && eloDiff > 150)
                    ) {
                      upsetDiff = Math.abs(eloDiff);
                    }
                  }

                  const isMatchOfTheDay = match.id === matchOfTheDayId;
                  const isLiveNow = !match.is_friendly &&
                    (liveMatchIds.has(match.player1_id) || liveMatchIds.has(match.player2_id) ||
                      (match.team1_partner_id && liveMatchIds.has(match.team1_partner_id)) ||
                      (match.team2_partner_id && liveMatchIds.has(match.team2_partner_id)));

                  const isKudosed = (m: any) => {
                    if (kudosState.hasOwnProperty(m.id)) return kudosState[m.id];
                    return (
                      (Array.isArray(m.kudos_users) &&
                        session?.user?.id &&
                        m.kudos_users.includes(session.user.id)) ||
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

                    if (session?.user?.id) {
                      supabase
                        .rpc("toggle_match_kudos", { p_match_id: match.id })
                        .then(({ error }) => {
                          if (error)
                            console.warn("Failed to sync kudos live:", error);
                        });

                      if (!isCurrentlyLiked) {
                        const giverName = ownProfile?.full_name ?? "Someone";
                        supabase.functions
                          .invoke("notify-kudos", {
                            body: { match_id: match.id, giver_name: giverName },
                          })
                          .catch(() => { });
                      }
                    }
                  };

                  const handleShare = (match: any) => shareMatch(match);
                  
                  const isLikedLocally = kudosState[match.id] ?? !!localStorage.getItem(`liked_${match.id}`);
                  const baseCount = Array.isArray(match.kudos_users) ? match.kudos_users.length : 0;
                  const isIncludedInBackend = Array.isArray(match.kudos_users) && match.kudos_users.includes(session?.user?.id);
                  let finalKudosCount = baseCount;
                  
                  if (isLikedLocally && !isIncludedInBackend) {
                    finalKudosCount += 1;
                  } else if (!isLikedLocally && isIncludedInBackend) {
                    finalKudosCount -= 1;
                  }

                  return (
                    <ErrorBoundary key={`eb-${match.id}`}>
                      <MatchCard
                        key={match.id}
                        match={match}
                        currentUser={session?.user}
                        isLiveNow={isLiveNow}
                        isMatchOfTheDay={isMatchOfTheDay}
                        upsetDiff={upsetDiff}
                        isKudosed={isLikedLocally || isIncludedInBackend}
                        kudosCount={finalKudosCount}
                        onKudos={() => handleKudos(match)}
                        onShare={() => handleShare(match)}
                        index={i}
                      >
                        {match.match_code && (
                          <div className="mt-1 pt-1 border-t border-slate-100/50 dark:border-slate-800/50">
                            <MatchPredictionCard
                              compact
                              matchId={match.match_code}
                              t1Ids={[]}
                              t2Ids={[]}
                              t1Label={match.team1_label ?? "TBD"}
                              t2Label={match.team2_label ?? "TBD"}
                              hasStarted={isLiveNow || match.status === 'completed' || match.status === 'walkover'}
                              myPick={picks[match.match_code]}
                              profileId={ownProfile?.id}
                              onPick={(team) => handlePick(match.match_code, team)}
                              isResultsRevealed={isLiveNow || !!revealedMatchIds[match.match_code]}
                              isAdmin={isAdmin}
                              onToggleRevealResults={() => handleToggleReveal(match.match_code)}
                            />
                          </div>
                        )}
                      </MatchCard>
                    </ErrorBoundary>
                  );
                };

                return (
                  <>
                    {feedView === "my" ? (
                      <MatchSection 
                        title="My Matches" 
                        icon={<Activity className="w-5 h-5 text-violet-500" />} 
                        matches={myMatchesList} 
                        defaultExpanded={true} 
                        renderMatchCard={renderCard}
                      />
                    ) : (
                      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300 mb-6">
                        <div className="flex border-b border-slate-100 dark:border-slate-800">
                          {["upcoming", "completed"].map(status => (
                            <button
                              key={status}
                              onClick={() => setMatchStatus(status)}
                              className={`flex-1 py-4 text-sm font-black capitalize transition-colors ${
                                matchStatus === status 
                                  ? "text-primary border-b-2 border-primary bg-slate-50/50 dark:bg-slate-800/50" 
                                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                              }`}
                            >
                              {status} Matches 
                              <span className="ml-2 text-xs text-muted-foreground opacity-70">
                                ({status === "upcoming" ? upcomingMatches.length : completedMatches.length})
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="p-4 sm:p-5">
                          <div className="mb-5 bg-slate-100/50 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1">
                              {["ALL", "MS", "MD", "XD", "WS", "WD"].map(cat => (
                                <button
                                  key={cat}
                                  onClick={() => setMatchCat(cat)}
                                  className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-black transition-all ${
                                    matchCat === cat
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            {(() => {
                               const list = matchStatus === "upcoming" ? upcomingMatches : completedMatches;
                               const filteredList = list.filter(m => {
                                 if (matchCat === "ALL") return true;
                                 const c = (m.match_code || m.matchNumber || "").toUpperCase();
                                 if (c.startsWith(matchCat)) return true;
                                 const cat = (m.category || "").toUpperCase();
                                 if (matchCat === "MS" && (cat.includes("MEN'S SINGLES") || cat === "MS" || cat === "SINGLES")) return true;
                                 if (matchCat === "MD" && (cat.includes("MEN'S DOUBLES") || cat === "MD" || cat === "DOUBLES")) return true;
                                 if (matchCat === "WS" && (cat.includes("WOMEN'S SINGLES") || cat === "WS")) return true;
                                 if (matchCat === "WD" && (cat.includes("WOMEN'S DOUBLES") || cat === "WD")) return true;
                                 if (matchCat === "XD" && (cat.includes("MIXED") || cat === "XD")) return true;
                                 return false;
                               });
                               
                               if (filteredList.length === 0) return <div className="text-center py-12 text-sm font-bold text-slate-400">No matches found in this section.</div>;
                               return filteredList.map((m, i) => renderCard(m, i));
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {matches.length >= limitCount && (
                <div className="flex justify-center mt-6 pt-4 pb-8">
                  <button
                    onClick={() => setLimitCount((prev) => prev + 50)}
                    className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300 rounded-full font-bold text-sm transition shadow-sm hover:shadow-md"
                  >
                    Load More Matches
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
              <div className="w-24 h-24 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Trophy className="w-10 h-10 text-slate-300 dark:text-muted-foreground" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">
                No matches yet
              </h3>
              <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                No matches found matching your filters.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeSubTab === "schedule" && activeTournamentId && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="font-black text-lg mb-4 text-slate-800 dark:text-foreground">Match Schedule</h2>
          <LiveMatchSchedule tournamentId={activeTournamentId} playerName={ownProfile?.full_name || null} />
        </div>
      )}

      {/* 3. Polls */}
      {!loading && activeSubTab === "polls" && (
        <div className="mb-6">
          <PollsSection />
        </div>
      )}

      {/* 4. Brackets */}
      {!loading && activeSubTab === "brackets" && activeTournamentId && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="font-black text-lg mb-4">Live Brackets</h2>
          <LiveBracketsSection tournamentId={activeTournamentId} showBrackets={true} />
        </div>
      )}



      {(isUmpire || isAdmin) && activeSubTab === "umpire" && (
        <div className="mb-6">
          <UmpireTab />
        </div>
      )}



    </div>
  );
}
