import { CalendarClock, ChevronRight, Clock3, MapPin, Swords, Trophy } from "lucide-react";
import { Link } from "wouter";
import { matchPath, tournamentPath } from "@/lib/tournamentRoutes";
import { type MyTournamentSummary } from "@/lib/homeRail";
import { courtLabel, type MatchView } from "@/lib/matchView";

function scheduleLabel(view: MatchView): string {
  if (view.state === "live") return "Playing now";
  if (!view.scheduledAt) return "Time not assigned";
  return `Scheduled ${new Date(view.scheduledAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function sideContext(view: MatchView, myPlayerId: string) {
  const mine = view.sides[0].playerIds.includes(myPlayerId) ? 0 : 1;
  return { own: view.sides[mine], opponent: view.sides[mine === 0 ? 1 : 0] };
}

function compactMatchLabel(view: MatchView) {
  const event = view.discipline ?? view.categoryLabel;
  return [event, view.roundName, view.court ? courtLabel(view.court) : null].filter(Boolean).join(" · ");
}

export function MyTournamentCard({
  summary,
  myPlayerId,
  tournamentNames,
}: {
  summary: MyTournamentSummary;
  myPlayerId: string;
  tournamentNames: Record<string, string>;
}) {
  const { primary, otherMatches } = summary;
  const sides = sideContext(primary, myPlayerId);
  const tournamentName = tournamentNames[primary.tournamentId] ?? "Tournament";
  const discipline = primary.discipline ?? null;

  return (
    <section aria-label="My tournament" className="mb-3 overflow-hidden rounded-2xl border border-primary/30 bg-slate-950 text-white shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-primary">My tournament</p>
          <h2 id="my-tournament-heading" className="text-base font-black">
            {primary.state === "live" ? "You’re on court" : "Your next match"}
          </h2>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${primary.state === "live" ? "bg-rose-500/20 text-rose-300" : "bg-sky-500/20 text-sky-300"}`}>
          {scheduleLabel(primary)}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Trophy className="h-3.5 w-3.5" aria-hidden /> {tournamentName}
          </p>
          <p className="mt-1 text-sm font-black">{compactMatchLabel(primary)}</p>
          <p className="mt-2 text-sm text-slate-200"><span className="font-bold text-white">Your side:</span> {sides.own.label}</p>
          <p className="text-sm text-slate-200"><span className="font-bold text-white">Opponents:</span> {sides.opponent.label}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden /> {scheduleLabel(primary)}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden /> {primary.court ? `Court ${primary.court}` : "Court not assigned"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
          <Link href={matchPath(primary.tournamentId, primary.id)} className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Swords className="h-4 w-4" aria-hidden /> Open match
          </Link>
          <Link href={tournamentPath(primary.tournamentId, "draw", { cat: discipline })} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 px-3 text-xs font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            View draw
          </Link>
          <Link href={tournamentPath(primary.tournamentId, "schedule", { cat: discipline, court: primary.court })} className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-white/20 px-3 text-xs font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <CalendarClock className="h-4 w-4" aria-hidden /> Schedule
          </Link>
        </div>

        {otherMatches.length > 0 && (
          <div className="border-t border-white/10 pt-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Other entries</p>
              <Link href="/my-matches" className="inline-flex min-h-[44px] items-center text-xs font-black text-primary underline underline-offset-2">
                See all {otherMatches.length + 1}
              </Link>
            </div>
            <ul className="space-y-1">
              {otherMatches.slice(0, 3).map((view) => (
                <li key={view.id}>
                  <Link href={matchPath(view.tournamentId, view.id)} className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-2 text-xs hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                    <span className="min-w-0 truncate font-bold">{compactMatchLabel(view)}</span>
                    <span className="flex shrink-0 items-center gap-1 text-slate-400">{scheduleLabel(view)} <ChevronRight className="h-3.5 w-3.5" aria-hidden /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
