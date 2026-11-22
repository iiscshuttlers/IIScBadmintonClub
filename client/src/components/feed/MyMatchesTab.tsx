import { useState, useEffect } from "react";
import { fetchMyTournamentMatchesForTab } from "@/services/tournamentService";
import { subscriptionService } from "@/services/subscriptionService";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Clock, MapPin, Trophy, ShieldAlert, Heart, ExternalLink, Activity } from "lucide-react";
import { MatchScoreDisplay } from "../tournament/MatchScoreDisplay";
import { BeautifulScoreDisplay } from "../feed/BeautifulScoreDisplay";
import { Link } from "wouter";

export function MyMatchesTab() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [followingMatches, setFollowingMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [tab, setTab] = useState<"playing" | "umpire" | "following">("playing");

  useEffect(() => {
    if (!profile?.id) return;

    const fetchMatches = async () => {
      setLoading(true);
      try {
        const data = await fetchMyTournamentMatchesForTab(profile.id);
        setMatches(data);
      } catch {
        /* intentional error handling */
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    const loadFollowing = async () => {
      setFollowingLoading(true);
      try {
        const followingList = Array.isArray(profile.following) ? profile.following : [];
        const res = await subscriptionService.fetchFollowingMatches(profile.id, followingList);
        setFollowingMatches(res.all);
      } catch (err) {
        console.warn("Failed to load following matches", err);
      } finally {
        setFollowingLoading(false);
      }
    };

    loadFollowing();
  }, [profile?.id, profile?.following]);

  if (!profile) {
    return null;
  }

  // Order within a tab: live first, then upcoming, then completed. (user req)
  const LIVE_STATUSES = new Set(["in_progress", "playing", "live", "ongoing"]);
  const phaseRank = (m: any) => (LIVE_STATUSES.has(m.status) ? 0 : m.status === "completed" || m.status === "walkover" ? 2 : 1);
  const byPhase = (a: any, b: any) => {
    const ra = phaseRank(a);
    const rb = phaseRank(b);
    if (ra !== rb) return ra - rb;
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    // completed: most recent first; live/upcoming: soonest first
    return ra === 2 ? tb - ta : ta - tb;
  };

  const isMyPlaying = (m: any) =>
    m.player1_id === profile.id || m.player2_id === profile.id || m.player3_id === profile.id || m.player4_id === profile.id;

  const playingMatches = matches.filter(isMyPlaying).sort(byPhase);
  const umpireMatches = matches.filter((m) => m.umpired_by === profile.id && !isMyPlaying(m)).sort(byPhase);
  const sortedFollowingMatches = [...followingMatches].sort(byPhase);

  const visibleMatches =
    tab === "playing"
      ? playingMatches
      : tab === "umpire"
      ? umpireMatches
      : sortedFollowingMatches;

  const isCurrentTabLoading = tab === "following" ? followingLoading : loading;

  return (
    <div className="w-full max-w-3xl mx-auto pb-12">
      {isCurrentTabLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-card rounded-2xl p-6 border border-border h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Playing / Umpire Duty / Following tabs */}
          <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
            {([
              { id: "playing", label: "Playing", count: playingMatches.length },
              { id: "umpire", label: "Umpire Duty", count: umpireMatches.length },
              { id: "following", label: "Following", count: sortedFollowingMatches.length },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-black transition whitespace-nowrap ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label} <span className="opacity-70">({t.count})</span>
              </button>
            ))}
          </div>

          {visibleMatches.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-3xl border border-border shadow-sm mt-2 px-4">
              {tab === "following" ? (
                <>
                  <Heart className="w-12 h-12 text-faint mx-auto mb-4" />
                  <h3 className="text-xl font-black text-foreground mb-2">No followed activity</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm">
                    You aren't following any players or tournaments with active fixtures. Follow tournaments or players in the directory to see their live and upcoming matches here.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Link href="/tournaments">
                      <button className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow">
                        Browse Tournaments
                      </button>
                    </Link>
                    <Link href="/players" className="px-4 py-2 text-xs font-bold border border-border rounded-xl hover:bg-muted">
                      Player Directory
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <Calendar className="w-12 h-12 text-faint mx-auto mb-4" />
                  <h3 className="text-xl font-black text-foreground mb-2">
                    {tab === "playing" ? "No matches yet" : "No umpire duties"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {tab === "playing"
                      ? "You do not have any tournament matches yet."
                      : "You're not assigned to umpire any matches."}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {visibleMatches.map((m: any) => {
                const isUmpire = m.umpired_by === profile.id;
                const isLive = LIVE_STATUSES.has(m.status);
                const matchLink = m.tournament_id
                  ? `/tournaments/${m.tournament_id}/matches/${m.id}`
                  : `/matches/${m.id}`;

                return (
                  <Link key={m.id} href={matchLink}>
                    <div
                      className={`block bg-card rounded-2xl p-4 border shadow-sm transition-all hover:border-primary/50 relative overflow-hidden cursor-pointer group mb-3 ${
                        isLive
                          ? "border-success/40 ring-2 ring-success/20"
                          : isUmpire
                          ? "border-warning/30"
                          : "border-border"
                      }`}
                    >
                      {isLive && (
                        <div className="absolute top-0 right-0 bg-success text-success-foreground text-[10px] font-black px-3 py-1 rounded-bl-xl flex items-center gap-1.5 z-10 animate-pulse">
                          <Activity className="w-3 h-3" />
                          LIVE ON COURT
                        </div>
                      )}

                      {!isLive && isUmpire && (
                        <div className="absolute top-0 right-0 bg-warning/10 text-warning text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1.5 z-10">
                          <ShieldAlert className="w-3 h-3" />
                          UMPIRE DUTY
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-3 mt-1">
                        <div className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                          {m.category} {m.round_name ? `- ${m.round_name}` : ""}
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground truncate">
                          {m.tournaments?.name}
                        </span>
                      </div>

                      <div className="mb-4">
                        <MatchScoreDisplay
                          sets_history={m.sets_history}
                          team1_label={m.team1_label || "TBD"}
                          team2_label={m.team2_label || "TBD"}
                          winner_side={m.winner_side}
                          status={m.status}
                        />
                        {(!m.sets_history || m.sets_history.length === 0) &&
                          m.status === "completed" &&
                          (m.score || m.match_score) && (
                            <div className="mt-2">
                              <BeautifulScoreDisplay score={m.match_score || m.score} />
                            </div>
                          )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground bg-background/50 p-3 rounded-xl border border-border">
                        <div className="flex flex-wrap items-center gap-4">
                          {m.scheduled_at && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-info" />
                              <span className="font-medium text-xs">
                                {new Date(m.scheduled_at).toLocaleString([], {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                          {m.court_number && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-danger" />
                              <span className="font-medium text-xs">Court {m.court_number}</span>
                            </div>
                          )}
                          {m.status === "completed" && (
                            <div className="flex items-center gap-1.5">
                              <Trophy className="w-4 h-4 text-gold" />
                              <span className="font-medium text-xs text-warning">
                                Completed
                              </span>
                            </div>
                          )}
                        </div>

                        <span className="text-xs font-bold text-primary group-hover:underline inline-flex items-center gap-1">
                          View Match <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
