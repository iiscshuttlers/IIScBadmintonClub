import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { useOpenMatchViews } from "@/hooks/queries/useMatchViews";
import { buildCourtQueues, compareCourtQueue, courtLabel, type MatchView } from "@/lib/matchView";
import { MatchScorecard } from "@/components/match/MatchPrimitives";

/**
 * #17 Spectator-facing "Up Next on Court" for a tournament.
 * Read-only companion to the admin OrderOfPlayPanel. Built on the shared WP6
 * match model: the queue order is `buildCourtQueues` (same order as the
 * "up next" push alerts), cards are `MatchScorecard`, and the data comes from
 * the ["tournament_matches", id, "open-views"] query that RealtimeProvider
 * already invalidates — no extra realtime channel. Renders nothing when there
 * are no live or court-assigned matches (e.g. a finished/archived tournament).
 */

/** Upcoming matches shown per court after the live one(s). */
const UPCOMING_PER_COURT = 3;

interface CourtCard {
  key: string;
  title: string;
  playing: MatchView[];
  upcoming: MatchView[];
}

export function UpNextPanel({ tournamentId }: { tournamentId: string }) {
  const { views } = useOpenMatchViews(tournamentId);

  const cards = useMemo<CourtCard[]>(() => {
    const out: CourtCard[] = buildCourtQueues(views).map((q) => ({
      key: q.court,
      title: courtLabel(q.court),
      playing: q.playing,
      upcoming: [q.next, ...q.following].filter((v): v is MatchView => !!v).slice(0, UPCOMING_PER_COURT),
    }));
    // Live matches without a court are still on the order of play.
    const courtlessLive = views.filter((v) => v.state === "live" && !v.court).sort(compareCourtQueue);
    if (courtlessLive.length > 0) {
      out.push({ key: "__order_of_play", title: "Order of play", playing: courtlessLive, upcoming: [] });
    }
    return out;
  }, [views]);

  if (cards.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1.5 h-6 bg-gradient-to-b from-success to-success rounded-full" />
        <h2 className="text-2xl font-black text-foreground">Up Next</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <section
            key={c.key}
            aria-label={c.title}
            className="rounded-2xl border border-border bg-card/60 p-4 min-w-0"
          >
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="text-sm font-black text-foreground">{c.title}</h3>
            </div>

            {c.playing.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Playing</p>
                {c.playing.map((v) => (
                  <MatchScorecard key={v.id} view={v} showCourt={false} />
                ))}
              </div>
            )}

            {c.upcoming.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Next</p>
                {c.upcoming.map((v) => (
                  <MatchScorecard key={v.id} view={v} showCourt={false} />
                ))}
              </div>
            ) : (
              c.playing.length === 0 && <p className="text-xs text-muted-foreground">No matches queued.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
