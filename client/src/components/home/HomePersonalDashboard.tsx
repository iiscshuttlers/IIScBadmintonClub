import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Trophy, Swords, Calendar, ArrowRight, UserCheck, Flame, Clock, Radio, Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { useMyTournamentRoles } from "@/hooks/useMyTournamentRoles";
import { useLiveScoresFor } from "@/hooks/useLiveScoresFor";
import { FeaturedTournamentHero } from "@/components/tournament/FeaturedTournamentHero";
import { getTournaments } from "@/lib/tournaments";
import { Button } from "@/components/ui/button";

export function HomePersonalDashboard() {
  const [, setLocation] = useLocation();
  const { session, profile } = useAuth();
  const { myPlayerId, userName } = useNavigationAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    getTournaments()
      .then((data) => setTournaments(data || []))
      .catch(() => {});
  }, []);

  const { matches, pendingMatches, loading: matchesLoading } = usePlayerMatches(myPlayerId || undefined);
  const { myRoles } = useMyTournamentRoles(session?.user?.id, tournaments);

  const activeTournaments = useMemo(() => tournaments.filter((t) => t.status === "active"), [tournaments]);
  const activeIds = useMemo(() => activeTournaments.map((t) => t.id), [activeTournaments]);
  const liveScores = useLiveScoresFor(activeIds);

  const featuredTournament = useMemo(() => {
    return activeTournaments[0] || tournaments.find((t) => t.status === "draft" || t.status === "upcoming") || null;
  }, [activeTournaments, tournaments]);

  const featuredLiveScore = useMemo(() => {
    if (!featuredTournament) return undefined;
    return liveScores.get(featuredTournament.id);
  }, [featuredTournament, liveScores]);

  if (!session?.user?.id) return null;

  // Filter user's upcoming & recent matches
  const recentMatch = matches.length > 0 ? matches[0] : null;
  // myRoles is a Map<tournamentId, MyRole> — Object.entries() on a Map is always [],
  // so iterate its values. A user is "enrolled" if registered, officiating, or creator.
  const activeRoles = Array.from(myRoles.values()).filter(
    (r) => r.registration === "approved" || r.registration === "pending" || r.roles.size > 0 || r.isCreator
  );

  return (
    <div className="mb-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900 to-slate-950 border border-primary/30 shadow-xl backdrop-blur-md text-white">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm">
            🏸
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black leading-tight text-white flex items-center gap-2">
              Welcome back, {userName || "Player"}!
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                Dashboard
              </span>
            </h2>
            <p className="text-xs text-slate-400">Your personal matches, tournaments & club status</p>
          </div>
        </div>

        {myPlayerId && (
          <div className="flex items-center gap-2">
            <Link href={`/player/${myPlayerId}/personal`}>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-slate-950 font-bold text-xs hover:bg-primary/90 transition-all shadow-sm">
                Personal Space <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Grid of personal highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5">
        {/* Card 1: Next / Pending Match */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 text-primary">
              <Swords className="w-3.5 h-3.5" /> Next / Pending
            </span>
            {pendingMatches.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-black animate-pulse">
                Action Required
              </span>
            )}
          </div>
          {pendingMatches.length > 0 ? (
            <div>
              <p className="text-xs font-black text-white truncate">
                Pending score confirmation
              </p>
              <Link href={`/player/${myPlayerId}/personal`}>
                <span className="text-[11px] text-primary hover:underline font-bold mt-1 inline-block cursor-pointer">
                  Review {pendingMatches.length} pending match →
                </span>
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-slate-200">No pending matches</p>
              <Link href="/club">
                <span className="text-[11px] text-slate-400 hover:text-white font-medium mt-1 inline-block cursor-pointer">
                  Find hitting partners in Club →
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Card 2: Your Tournaments */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 text-amber-400">
              <Trophy className="w-3.5 h-3.5" /> Your Tournaments
            </span>
            <span className="text-[10px] font-bold text-slate-400">{activeRoles.length} enrolled</span>
          </div>
          {activeRoles.length > 0 ? (
            <div>
              <p className="text-xs font-bold text-white truncate">
                Registered in {activeRoles.length} tournament{activeRoles.length > 1 ? "s" : ""}
              </p>
              <Link href="/tournaments">
                <span className="text-[11px] text-primary hover:underline font-bold mt-1 inline-block cursor-pointer">
                  View your tournament brackets →
                </span>
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-slate-200">No active registrations</p>
              <Link href="/tournaments">
                <span className="text-[11px] text-primary hover:underline font-bold mt-1 inline-block cursor-pointer">
                  Explore open tournaments →
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Card 3: Recent Record */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 text-emerald-400">
              <Flame className="w-3.5 h-3.5" /> Recent Match
            </span>
            <span className="text-[10px] font-bold text-slate-400">{matches.length} played</span>
          </div>
          {recentMatch ? (
            <div>
              <p className="text-xs font-bold text-white truncate">
                {recentMatch.player1_id === myPlayerId
                  ? (recentMatch.player2?.full_name ? `vs ${recentMatch.player2.full_name}` : "Club Match")
                  : (recentMatch.player1?.full_name ? `vs ${recentMatch.player1.full_name}` : "Club Match")}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {recentMatch.match_score || "Finished"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-slate-200">No matches recorded yet</p>
              <Link href="/tournaments">
                <span className="text-[11px] text-slate-400 hover:text-white font-medium mt-1 inline-block cursor-pointer">
                  Ready to compete? →
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Featured Tournament Card */}
      {featuredTournament && (
        <div className="pt-3.5">
          <FeaturedTournamentHero
            tournament={featuredTournament}
            liveScore={featuredLiveScore}
            onOpen={() => setLocation(`/events/${featuredTournament.slug || featuredTournament.id}`)}
          />
        </div>
      )}
    </div>
  );
}
