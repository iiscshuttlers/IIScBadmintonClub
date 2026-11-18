import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useAnyTournamentLive } from "@/hooks/queries/useAnyTournamentLive";
import { useTournamentDetail } from "@/hooks/queries/useTournamentQueries";
import { LiveScoreTicker } from "@/components/match/LiveScoreTicker";
import { tournamentPath } from "@/lib/tournamentRoutes";

/**
 * Cricbuzz-style "live now" strip on Home: one score ticker per tournament
 * with a match on court. Renders nothing when no tournament match is live.
 */

function TournamentTicker({ tournamentId }: { tournamentId: string }) {
  const { data: t } = useTournamentDetail(tournamentId);
  const name = t?.name ?? "Tournament";
  return (
    <LiveScoreTicker
      tournamentId={tournamentId}
      label={`Live scores, ${name}`}
      heading={
        <Link
          href={tournamentPath(tournamentId, "live")}
          className="inline-flex items-center gap-1.5 min-h-[32px] text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 motion-safe:animate-pulse" aria-hidden />
            Live now
          </span>
          <span className="text-muted-foreground" aria-hidden>·</span>
          <span className="truncate normal-case tracking-normal">{name}</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
        </Link>
      }
    />
  );
}

export function HomeLiveStrip() {
  const { tournamentIds } = useAnyTournamentLive();
  if (tournamentIds.length === 0) return null;
  return (
    <div className="pt-3">
      {tournamentIds.map((id) => (
        <TournamentTicker key={id} tournamentId={id} />
      ))}
    </div>
  );
}
