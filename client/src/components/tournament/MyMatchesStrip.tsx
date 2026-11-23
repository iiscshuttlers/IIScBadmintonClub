import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Swords, Clock, Radio, CalendarPlus, Route } from "lucide-react";
import { toast } from "sonner";
import { fetchMyTournamentMatches, fetchEloStakesContext } from "@/services/tournamentService";
import { matchesToEvents, shareIcs } from "@/lib/calendarExport";
import { PathToFinalDialog } from "@/components/tournament/PathToFinalDialog";
import { computeStakes, formatRange, DEFAULT_ELO_CONFIG, type Stakes } from "@/lib/eloStakes";
import { matchOutcome } from "@/lib/matchView";
import { SidesVs } from "@/components/match/MatchPrimitives";
import { categoryTextClass as catColor } from "@/lib/categoryColors";

const LIVE_STATUSES = new Set(["in_progress", "playing", "live", "ongoing"]);
/** Finished matches: played out, or decided by walkover. */
const isFinished = (status: string) => status === "completed" || status === "walkover";

/** Winning side as an index into [team1, team2]; null until completed or walkover. */
function winnerIndex(m: { status: string; winner_side?: number | null }): 0 | 1 | null {
  const o = matchOutcome(m);
  return o.t1Won ? 0 : o.t2Won ? 1 : null;
}

/**
 * Compact "My Matches" strip — the current player's tournament matches ordered
 * live → upcoming → completed, so players instantly see when they're playing.
 * Tournament matches only. With `upcomingOnly` (the Tournaments hub) finished
 * matches are left to /my-matches and the strip shrinks to one line when
 * nothing is coming up.
 */
export function MyMatchesStrip({
  myPlayerId,
  limit = 4,
  upcomingOnly = false,
  className = "",
}: {
  myPlayerId: string | null | undefined;
  limit?: number;
  upcomingOnly?: boolean;
  className?: string;
}) {
  const [myMatches, setMyMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!myPlayerId) {
      setMyMatches([]);
      return;
    }
    let cancelled = false;
    fetchMyTournamentMatches(myPlayerId)
      .then((data) => {
        if (!cancelled) setMyMatches(data || []);
      })
      .catch((err) => {
        console.error("Failed to load my tournament matches", err);
      });
    return () => {
      cancelled = true;
    };
  }, [myPlayerId]);

  const sortedMyMatches = useMemo(() => {
    const rank = (m: any) => (LIVE_STATUSES.has(m.status) ? 0 : isFinished(m.status) ? 2 : 1);
    return [...myMatches]
      .filter((m) => !upcomingOnly || !isFinished(m.status))
      .sort((a, b) => {
        const ra = rank(a),
          rb = rank(b);
        if (ra !== rb) return ra - rb;
        const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return ra === 2 ? tb - ta : ta - tb;
      })
      .slice(0, limit);
  }, [myMatches, limit, upcomingOnly]);

  // Elo stakes for upcoming ranked matches with both sides decided.
  const [stakes, setStakes] = useState<Record<string, Stakes>>({});
  const [pathFor, setPathFor] = useState<{ tournamentId: string; category: string } | null>(null);
  useEffect(() => {
    if (!myPlayerId) return;
    const ranked = myMatches.filter(
      (m) => !isFinished(m.status) && !LIVE_STATUSES.has(m.status) && m.tournaments?.counts_for_elo !== false && m.player1_id && m.player2_id,
    );
    if (ranked.length === 0) {
      setStakes({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ids = Array.from(new Set(ranked.flatMap((m) => [m.player1_id, m.player2_id, m.player3_id, m.player4_id]).filter(Boolean))) as string[];
        const { players, completedCount, eloConfig } = await fetchEloStakesContext(myPlayerId, ids);
        if (cancelled) return;
        const cfg = {
          kNewbie: Number(eloConfig.k_factor_newbie) || DEFAULT_ELO_CONFIG.kNewbie,
          kExperienced: Number(eloConfig.k_factor_experienced) || DEFAULT_ELO_CONFIG.kExperienced,
          tournamentMultiplier: Number(eloConfig.tournament_multiplier) || DEFAULT_ELO_CONFIG.tournamentMultiplier,
        };
        const elo = new Map((players ?? []).map((p: any) => [p.id, p.elo_rating ?? p.tournament_elo ?? 1200]));
        const e = (id?: string | null) => (id ? elo.get(id) ?? 1200 : null);
        const out: Record<string, Stakes> = {};
        for (const m of ranked) {
          const onSide1 = m.player1_id === myPlayerId || m.player3_id === myPlayerId;
          const me = myPlayerId;
          const partner = onSide1 ? (m.player1_id === me ? m.player3_id : m.player1_id) : m.player2_id === me ? m.player4_id : m.player2_id;
          const opps = (onSide1 ? [m.player2_id, m.player4_id] : [m.player1_id, m.player3_id]).filter(Boolean);
          out[m.id] = computeStakes(e(me)!, e(partner), opps.map((o: string) => e(o)!), completedCount, cfg);
        }
        setStakes(out);
      } catch (err) {
        console.error("Failed to compute elo stakes", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myMatches, myPlayerId]);

  const calendarEvents = useMemo(() => matchesToEvents(myMatches), [myMatches]);

  const addToCalendar = async () => {
    try {
      await shareIcs(calendarEvents, "my-matches", "My IISc Shuttlers matches");
    } catch (e: any) {
      if (e?.message?.toLowerCase?.().includes("cancel")) return; // share sheet dismissed
      toast.error("Couldn't create the calendar file.");
    }
  };

  if (!myPlayerId || myMatches.length === 0) return null;

  // Hub view with nothing coming up: one line pointing at past results.
  if (sortedMyMatches.length === 0) {
    return (
      <div className={`flex items-center justify-between gap-2 flex-wrap ${className}`}>
        <span className="flex items-center gap-1.5 text-xs font-black text-primary uppercase tracking-wider">
          <Swords className="w-3.5 h-3.5" aria-hidden="true" /> My Matches
        </span>
        <span className="text-xs text-muted-foreground">
          No upcoming matches ·{" "}
          <Link href="/my-matches" className="font-bold text-primary hover:underline">
            Past results →
          </Link>
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-black text-primary uppercase tracking-wider">
          <Swords className="w-3.5 h-3.5" /> My Matches
        </span>
        <div className="flex items-center gap-3">
          {calendarEvents.length > 0 && (
            <button
              type="button"
              onClick={addToCalendar}
              aria-label={`Add ${calendarEvents.length} upcoming match${calendarEvents.length === 1 ? "" : "es"} to your calendar`}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline font-bold"
            >
              <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
            </button>
          )}
          <Link href="/my-matches">
            <span className="text-[11px] text-primary hover:underline font-bold cursor-pointer">View all →</span>
          </Link>
        </div>
      </div>
      <div className="space-y-2">
        {sortedMyMatches.map((m) => {
          const isLive = LIVE_STATUSES.has(m.status);
          const isDone = isFinished(m.status);
          return (
            <Link key={m.id} href="/my-matches">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/60 border border-border-strong/60 hover:border-primary/40 transition-colors cursor-pointer">
                <div className="shrink-0">
                  {isLive ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-live/20 text-live text-[9px] font-black uppercase">
                      <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
                    </span>
                  ) : isDone ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-faint/40 text-soft text-[9px] font-black uppercase">Done</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md bg-success/20 text-success text-[9px] font-black uppercase">Upcoming</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">
                    <SidesVs sides={[m.team1_label || "TBD", m.team2_label || "TBD"]} winner={winnerIndex(m)} />
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] truncate">
                      <span className={`font-black ${catColor(m.category)}`}>{m.category}</span>
                      <span className="text-muted-foreground">
                        {m.round_name ? ` · ${m.round_name}` : ""}
                        {m.court_number ? ` · Court ${m.court_number}` : ""}
                      </span>
                    </p>
                    {isDone ? (
                      <span className="shrink-0 text-[11px] font-black text-success whitespace-nowrap tabular-nums">{m.score || "Final"}</span>
                    ) : m.scheduled_at ? (
                      <span className="shrink-0 flex items-center gap-1 text-[10px] text-info font-bold whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {new Date(m.scheduled_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : null}
                  </div>
                  {!isDone && m.tournament_id && m.category && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPathFor({ tournamentId: m.tournament_id, category: m.category });
                      }}
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                    >
                      <Route className="w-3 h-3" /> Path to the final
                    </button>
                  )}
                  {!isDone && !isLive && stakes[m.id] && (
                    <p className="text-[10px] font-bold tabular-nums text-muted-foreground" title="Estimated Elo change (range covers 2- and 3-game results)">
                      Elo ≈ win <span className="text-success">{formatRange(stakes[m.id].win)}</span> · lose{" "}
                      <span className="text-danger">{formatRange(stakes[m.id].lose)}</span>
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {pathFor && myPlayerId && (
        <PathToFinalDialog
          open
          onClose={() => setPathFor(null)}
          tournamentId={pathFor.tournamentId}
          category={pathFor.category}
          playerId={myPlayerId}
        />
      )}
    </div>
  );
}
