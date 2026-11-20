import { useState, useEffect } from "react";
import { playerService } from "@/services/playerService";
import { 
  BellOff, 
  Loader2, 
  Trash2, 
  Trophy, 
  User, 
  Bell, 
  VolumeX, 
  Volume2, 
  Moon, 
  Clock, 
  Settings2 
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { subscriptionService, type TournamentSubscription, type PlayerSubscription } from "@/services/subscriptionService";
import { PLAYER_PUBLIC_COLUMNS } from "@/lib/playerColumns";

export default function SubscriptionsPage() {
  const { session, profile, refreshProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [tournamentSubs, setTournamentSubs] = useState<TournamentSubscription[]>([]);
  const [playerSubs, setPlayerSubs] = useState<PlayerSubscription[]>([]);
  const [matchSubs, setMatchSubs] = useState<any[]>([]);

  // Quiet Hours local form state
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [savingQuiet, setSavingQuiet] = useState(false);

  useEffect(() => {
    if (profile) {
      setQuietEnabled(!!(profile as any).quiet_hours_enabled);
      setQuietStart((profile as any).quiet_hours_start || "22:00");
      setQuietEnd((profile as any).quiet_hours_end || "07:00");
    }
  }, [profile]);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadSubscriptions();
  }, [session?.user?.id]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const [tourRes, playerRes, matchRes] = await Promise.all([
        subscriptionService.fetchTournamentSubscriptions(session!.user.id),
        subscriptionService.fetchPlayerSubscriptions(session!.user.id),
        subscriptionService.fetchMatchSubscriptionRows(session!.user.id),
      ]);

      setTournamentSubs(tourRes || []);
      setPlayerSubs(playerRes || []);
      setMatchSubs(matchRes || []);
    } catch (e: any) {
      console.warn("Error loading subscriptions", e);
      toast.error("Failed to load some subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTournamentMute = async (sub: TournamentSubscription) => {
    const newMuted = !sub.is_muted;
    try {
      await subscriptionService.updateTournamentSubscription(session!.user.id, sub.tournament_id, {
        is_muted: newMuted,
      });
      setTournamentSubs((prev) =>
        prev.map((s) => (s.tournament_id === sub.tournament_id ? { ...s, is_muted: newMuted } : s))
      );
      toast.success(newMuted ? "Tournament notifications muted" : "Tournament notifications unmuted");
    } catch {
      toast.error("Failed to update mute state");
    }
  };

  const handleToggleTournamentPref = async (
    sub: TournamentSubscription,
    key: "notify_match_call" | "notify_schedule_change" | "notify_result"
  ) => {
    const newVal = !sub[key];
    try {
      await subscriptionService.updateTournamentSubscription(session!.user.id, sub.tournament_id, {
        [key]: newVal,
      });
      setTournamentSubs((prev) =>
        prev.map((s) => (s.tournament_id === sub.tournament_id ? { ...s, [key]: newVal } : s))
      );
    } catch {
      toast.error("Failed to update preference");
    }
  };

  const removeTournamentSub = async (tournamentId: string) => {
    try {
      await subscriptionService.unfollowTournament(session!.user.id, tournamentId);
      toast.success("Tournament unfollowed");
      setTournamentSubs((s) => s.filter((t) => t.tournament_id !== tournamentId));
    } catch {
      toast.error("Failed to unfollow tournament");
    }
  };

  const handleTogglePlayerMute = async (sub: PlayerSubscription) => {
    const newMuted = !sub.is_muted;
    try {
      await subscriptionService.updatePlayerSubscription(session!.user.id, sub.player_id, {
        is_muted: newMuted,
      });
      setPlayerSubs((prev) =>
        prev.map((s) => (s.player_id === sub.player_id ? { ...s, is_muted: newMuted } : s))
      );
      toast.success(newMuted ? "Player notifications muted" : "Player notifications unmuted");
    } catch {
      toast.error("Failed to update mute state");
    }
  };

  const handleTogglePlayerPref = async (
    sub: PlayerSubscription,
    key: "notify_match_call" | "notify_schedule_change" | "notify_result"
  ) => {
    const newVal = !sub[key];
    try {
      await subscriptionService.updatePlayerSubscription(session!.user.id, sub.player_id, {
        [key]: newVal,
      });
      setPlayerSubs((prev) =>
        prev.map((s) => (s.player_id === sub.player_id ? { ...s, [key]: newVal } : s))
      );
    } catch {
      toast.error("Failed to update preference");
    }
  };

  const removePlayerSub = async (playerId: string) => {
    try {
      await subscriptionService.unfollowPlayer(session!.user.id, playerId);
      toast.success("Player subscription removed");
      setPlayerSubs((s) => s.filter((p) => p.player_id !== playerId));
    } catch {
      toast.error("Failed to remove player subscription");
    }
  };

  const removeMatchSub = async (matchId: string) => {
    try {
      await subscriptionService.removeMatchSubscription(session!.user.id, matchId);
      toast.success("Match alert removed");
      setMatchSubs((s) => s.filter((m) => m.match_id !== matchId));
    } catch {
      toast.error("Failed to remove alert");
    }
  };

  const saveQuietHours = async () => {
    if (!profile?.id) return;
    setSavingQuiet(true);
    try {
      await playerService.updateQuietHours(profile.id, {
        quiet_hours_enabled: quietEnabled,
        quiet_hours_start: quietStart,
        quiet_hours_end: quietEnd,
      } as any);
      toast.success("Quiet hours saved");
      if (refreshProfile) await refreshProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to save quiet hours");
    } finally {
      setSavingQuiet(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      <PageHeader
        compact
        align="left"
        title="My Subscriptions &amp; Alerts"
        subtitle="Manage followed tournaments, players, match calls, and quiet hours"
        onBack={() => window.history.back()}
      />
      <div className="max-w-2xl mx-auto space-y-8 px-4 lg:px-8 pb-16 pt-4">

        {/* Quiet Hours Card */}
        <section className="bg-card rounded-3xl p-5 border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-info/15 text-info">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-foreground">Quiet Hours</h3>
                <p className="text-xs text-muted-foreground">Mute push notifications during sleep / rest</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={quietEnabled}
                onChange={(e) => setQuietEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-foreground after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-foreground after:border-border-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {quietEnabled && (
            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-muted-foreground">From:</span>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-border bg-muted text-foreground font-bold"
                />
                <span className="font-bold text-muted-foreground ml-2">To:</span>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-border bg-muted text-foreground font-bold"
                />
              </div>

              <button
                onClick={saveQuietHours}
                disabled={savingQuiet}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold transition shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {savingQuiet ? "Saving..." : "Save Times"}
              </button>
            </div>
          )}
        </section>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* Section 1: Tournament Subscriptions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Followed Tournaments ({tournamentSubs.length})
                </h2>
                <Link href="/tournaments">
                  <span className="text-xs font-bold text-primary hover:underline cursor-pointer">
                    Browse All Tournaments
                  </span>
                </Link>
              </div>

              {tournamentSubs.length === 0 ? (
                <div className="text-center py-8 bg-card rounded-3xl border border-border border-dashed">
                  <BellOff className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    You haven't followed any tournaments yet.
                  </p>
                  <Link href="/tournaments">
                    <button className="mt-3 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow">
                      Explore Tournaments
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {tournamentSubs.map((sub) => (
                    <div
                      key={sub.tournament_id}
                      className={`p-4 bg-card rounded-2xl shadow-sm border transition-all ${
                        sub.is_muted
                          ? "border-border opacity-60"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/tournaments/${sub.tournament_id}`}>
                            <h3 className="font-black text-sm text-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-2">
                              <span>{sub.tournaments?.name || "Tournament"}</span>
                              {sub.is_muted && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground font-bold">
                                  Muted
                                </span>
                              )}
                            </h3>
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {sub.tournaments?.venue || "Campus Courts"} · Status: {sub.tournaments?.status || "active"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleTournamentMute(sub)}
                            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition"
                            title={sub.is_muted ? "Unmute alerts" : "Mute alerts"}
                          >
                            {sub.is_muted ? <VolumeX className="w-4 h-4 text-warning" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => removeTournamentSub(sub.tournament_id)}
                            className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-full transition"
                            title="Unfollow Tournament"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Event Toggles */}
                      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="text-muted-foreground mr-1">Alerts:</span>
                        <button
                          onClick={() => handleToggleTournamentPref(sub, "notify_match_call")}
                          className={`px-2.5 py-1 rounded-lg border transition ${
                            sub.notify_match_call
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted text-muted-foreground border-border line-through"
                          }`}
                        >
                          Court Calls
                        </button>
                        <button
                          onClick={() => handleToggleTournamentPref(sub, "notify_schedule_change")}
                          className={`px-2.5 py-1 rounded-lg border transition ${
                            sub.notify_schedule_change
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted text-muted-foreground border-border line-through"
                          }`}
                        >
                          Schedule Changes
                        </button>
                        <button
                          onClick={() => handleToggleTournamentPref(sub, "notify_result")}
                          className={`px-2.5 py-1 rounded-lg border transition ${
                            sub.notify_result
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted text-muted-foreground border-border line-through"
                          }`}
                        >
                          Results
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 2: Player Subscriptions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Player Subscriptions ({playerSubs.length})
                </h2>
                <Link href="/pulse#directory" className="text-xs font-bold text-primary hover:underline">
                  Player Directory
                </Link>
              </div>

              {playerSubs.length === 0 ? (
                <div className="text-center py-8 bg-card rounded-3xl border border-border border-dashed">
                  <BellOff className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    You haven't subscribed to any players yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {playerSubs.map((sub) => (
                    <div
                      key={sub.player_id}
                      className={`p-4 bg-card rounded-2xl shadow-sm border transition-all ${
                        sub.is_muted
                          ? "border-border opacity-60"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/player/${sub.player_id}`}>
                            <h3 className="font-black text-sm text-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-2">
                              <span>{sub.players?.full_name || "Unknown Player"}</span>
                              {sub.is_muted && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground font-bold">
                                  Muted
                                </span>
                              )}
                            </h3>
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {sub.players?.department || "Department"} · {sub.notify_before_mins} mins pre-match reminder
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTogglePlayerMute(sub)}
                            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition"
                            title={sub.is_muted ? "Unmute alerts" : "Mute alerts"}
                          >
                            {sub.is_muted ? <VolumeX className="w-4 h-4 text-warning" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => removePlayerSub(sub.player_id)}
                            className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-full transition"
                            title="Remove Subscription"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Event Toggles */}
                      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="text-muted-foreground mr-1">Alerts:</span>
                        <button
                          onClick={() => handleTogglePlayerPref(sub, "notify_match_call")}
                          className={`px-2.5 py-1 rounded-lg border transition ${
                            sub.notify_match_call
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted text-muted-foreground border-border line-through"
                          }`}
                        >
                          Court Calls
                        </button>
                        <button
                          onClick={() => handleTogglePlayerPref(sub, "notify_schedule_change")}
                          className={`px-2.5 py-1 rounded-lg border transition ${
                            sub.notify_schedule_change
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted text-muted-foreground border-border line-through"
                          }`}
                        >
                          Schedule Changes
                        </button>
                        <button
                          onClick={() => handleTogglePlayerPref(sub, "notify_result")}
                          className={`px-2.5 py-1 rounded-lg border transition ${
                            sub.notify_result
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted text-muted-foreground border-border line-through"
                          }`}
                        >
                          Results
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: Match Alerts */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Match Alerts ({matchSubs.length})
              </h2>
              {matchSubs.length === 0 ? (
                <div className="text-center py-8 bg-card rounded-3xl border border-border border-dashed">
                  <BellOff className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    You haven't set any specific match alerts.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchSubs.map((sub) => {
                    const m = sub.tournament_matches;
                    const labelKnown = (l?: string | null) => !!l && l.trim() && l.trim().toUpperCase() !== "TBD";
                    const hasTeams = labelKnown(m?.team1_label) || labelKnown(m?.team2_label);
                    const title = hasTeams
                      ? `${m?.team1_label || "TBD"} vs ${m?.team2_label || "TBD"}`
                      : [m?.round_name, m?.match_code].filter(Boolean).join(" · ") || "Upcoming match";
                    const link = m?.tournament_id
                      ? `/tournaments/${m.tournament_id}/matches/${sub.match_id}`
                      : `/match/${sub.match_id}`;

                    return (
                      <div
                        key={sub.match_id}
                        className="flex items-center justify-between p-4 bg-card rounded-2xl shadow-sm border border-border"
                      >
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              {m?.category}
                            </span>
                            {m?.scheduled_at && (
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {new Date(m.scheduled_at).toLocaleDateString()} {new Date(m.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                          <Link href={link}>
                            <h3 className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer truncate">
                              {title}
                            </h3>
                          </Link>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Alert: {sub.notify_before_mins} mins before start
                          </p>
                        </div>
                        <button
                          onClick={() => removeMatchSub(sub.match_id)}
                          className="p-2 shrink-0 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-full transition-colors"
                          title="Remove Alert"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
