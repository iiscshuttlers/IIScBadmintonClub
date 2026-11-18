import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Bell, Clock, MapPin } from "lucide-react";
import { courtLabel, type MatchView } from "@/lib/matchView";
import { matchPath } from "@/lib/tournamentRoutes";
import { MatchTimes } from "@/components/match/MatchPrimitives";
import { ShareResultButton } from "@/components/match/ShareResultButton";
import { MatchReminderModal } from "@/components/pulse/MatchReminderModal";
import { useAuth } from "@/contexts/AuthContext";

/** Game-by-game table (BWF scorecard style); the game winner's score is bold. */
export function GamesTable({ view }: { view: MatchView }) {
  if (view.games.length === 0) return null;
  const live = view.state === "live";
  return (
    <table className="w-full text-sm mt-4">
      <caption className="sr-only">Score by game</caption>
      <thead>
        <tr className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          <th scope="col" className="text-left py-1 font-black">Game</th>
          <th scope="col" className="text-right py-1 font-black truncate max-w-[8rem]">{view.sides[0].label}</th>
          <th scope="col" className="text-right py-1 font-black truncate max-w-[8rem]">{view.sides[1].label}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {view.games.map((g, i) => {
          const inProgress = live && i === view.games.length - 1;
          const w1 = !inProgress && g.side1 > g.side2;
          const w2 = !inProgress && g.side2 > g.side1;
          return (
            <tr key={i}>
              <th scope="row" className="text-left py-1.5 font-semibold">
                Game {i + 1}
                {inProgress && <span className="ml-2 text-[11px] font-black text-red-600 dark:text-red-400">In progress</span>}
              </th>
              <td className={`text-right py-1.5 font-mono tabular-nums ${w1 ? "font-black" : "text-muted-foreground"}`}>{g.side1}</td>
              <td className={`text-right py-1.5 font-mono tabular-nums ${w2 ? "font-black" : "text-muted-foreground"}`}>{g.side2}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function MatchSummaryTab({
  view,
  tournamentName,
  next,
}: {
  view: MatchView;
  tournamentName: string;
  next: { id: string; round_name: string } | null;
}) {
  const { session, profile } = useAuth();
  const [reminderOpen, setReminderOpen] = useState(false);
  const winner = view.sides.find((s) => s.isWinner) ?? null;
  const upcoming = view.state === "scheduled" || view.state === "unscheduled";
  const userId: string | undefined = session?.user?.id;

  return (
    <div>
      <GamesTable view={view} />

      <dl className="mt-5 grid grid-cols-1 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Court</dt>
          <dd>{view.court ? courtLabel(view.court) : "Court not assigned"}</dd>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-muted-foreground mt-0.5" aria-hidden />
          <dt className="sr-only">Times</dt>
          <dd>
            <MatchTimes view={view} />
          </dd>
        </div>
      </dl>

      {next && (
        <Link
          href={matchPath(view.tournamentId, next.id)}
          className="mt-5 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 min-h-[44px] text-sm font-bold hover:border-primary transition-colors"
        >
          <span>
            {winner ? `${winner.label} advances to` : "Winner advances to"} {next.round_name}
          </span>
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      )}

      <div className="mt-5 flex flex-wrap gap-2 empty:hidden">
        <ShareResultButton view={view} tournamentName={tournamentName} />
        {upcoming && userId && (
          <button
            type="button"
            onClick={() => setReminderOpen(true)}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-black hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Bell className="w-4 h-4" aria-hidden /> Remind me
          </button>
        )}
      </div>

      {userId && (
        <MatchReminderModal
          isOpen={reminderOpen}
          onClose={() => setReminderOpen(false)}
          matchId={view.id}
          userId={userId}
          initialGlobalMins={(profile as { default_match_reminder_mins?: number | null } | null)?.default_match_reminder_mins}
        />
      )}
    </div>
  );
}
