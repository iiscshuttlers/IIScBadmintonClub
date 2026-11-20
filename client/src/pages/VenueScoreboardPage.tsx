import { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Maximize2, Minimize2, ArrowLeft, WifiOff, RefreshCw, LayoutGrid, Monitor } from "lucide-react";
import { useOpenMatchViews } from "@/hooks/queries/useMatchViews";
import { useTournamentRoute } from "@/hooks/queries/useTournamentRoute";
import { buildCourtQueues, courtLabel, type MatchView } from "@/lib/matchView";
import { useMatchPresence } from "@/hooks/queries/useCheckins";
import { SpectatorChip } from "@/components/checkin/CheckinBits";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isVenueDataStale, venueTournamentUrl } from "@/lib/venueDisplay";

export default function VenueScoreboardPage() {
  const { id: tournamentId = "" } = useParams<{ id: string }>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<string | "all">("all");
  const [clock, setClock] = useState(() => Date.now());

  const tournamentQuery = useTournamentRoute(tournamentId);
  const tournament = tournamentQuery.kind === "ready" ? tournamentQuery.tournament : null;

  usePageMeta({
    title: tournament ? `${tournament.name} · Venue Scoreboard` : "Venue Scoreboard",
    description: "Live venue scoreboard for badminton hall displays",
  });

  const open = useOpenMatchViews(tournamentId);
  const queues = useMemo(() => buildCourtQueues(open.views), [open.views]);
  // "Both sides here" for each court's next match. A flag only, no names.
  const presence = useMatchPresence(tournamentId);

  const availableCourts = useMemo(() => {
    return Array.from(new Set(queues.map((q) => q.court))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [queues]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      setFullscreenError(false);
      document.documentElement.requestFullscreen().catch(() => setFullscreenError(true));
    } else {
      document.exitFullscreen().catch(() => setFullscreenError(true));
    }
  };

  const displayedQueues = useMemo(() => {
    if (selectedCourt === "all") return queues;
    return queues.filter((q) => q.court === selectedCourt);
  }, [queues, selectedCourt]);

  const lastConfirmed = open.updatedAt
    ? new Date(open.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;
  const stale = isVenueDataStale(open.updatedAt, clock);
  const publicUrl = venueTournamentUrl(tournamentId);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top venue header bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link
            href={`/tournaments/${tournamentId}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden /> Exit Venue
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <h1 className="text-lg md:text-xl font-black text-white tracking-wide truncate max-w-md">
            {tournament?.name ?? "Tournament Venue Scoreboard"}
          </h1>
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-black uppercase tracking-wider">
            Venue Live
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Court selector */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedCourt("all")}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedCourt === "all" ? "bg-primary text-primary-foreground font-black" : "text-slate-300 hover:text-white"
              }`}
            >
              All Courts
            </button>
            {availableCourts.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCourt(c)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCourt === c ? "bg-primary text-primary-foreground font-black" : "text-slate-300 hover:text-white"
                }`}
              >
                {courtLabel(c)}
              </button>
            ))}
          </div>

          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Connectivity & freshness banner */}
      {(!open.online || open.refreshFailed || stale) && (
        <div
          role="status"
          className="flex items-center justify-between px-6 py-2.5 bg-amber-950 border-b border-amber-800 text-amber-200 text-xs font-bold"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400" aria-hidden />
            <span>
              {!open.online
                ? `Network disconnected. Scores confirmed at ${lastConfirmed ?? "—"}.`
                : open.refreshFailed
                  ? `Couldn't refresh live scores. Showing state confirmed at ${lastConfirmed ?? "—"}.`
                  : `Scores may be stale. Last server confirmation was ${lastConfirmed ?? "—"}.`}
            </span>
          </div>
          <button
            onClick={() => open.retry()}
            className="inline-flex items-center gap-1 underline font-black"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect
          </button>
        </div>
      )}
      {fullscreenError && (
        <p role="status" className="px-6 py-2 bg-slate-900 text-amber-300 text-xs font-bold">
          Fullscreen was not allowed by this browser. The scoreboard remains available in the current window.
        </p>
      )}

      {/* Main Scoreboard Display Area */}
      <section aria-label="Venue courts" className="flex-1 p-6 overflow-y-auto">
        {displayedQueues.length === 0 ? (
          <div className="h-full min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
            <Monitor className="w-16 h-16 text-slate-700 dark:text-slate-500 mb-4" />
            <h2 className="text-2xl font-black text-slate-300">No Matches Currently On Court</h2>
            <p className="text-slate-500 mt-2 max-w-sm">
              When an umpire or tournament desk starts a match on a court, it will immediately display here in high contrast.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${
              displayedQueues.length === 1
                ? "grid-cols-1 max-w-4xl mx-auto"
                : displayedQueues.length === 2
                ? "grid-cols-1 lg:grid-cols-2"
                : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            }`}
          >
            {displayedQueues.map((q) => (
              <VenueCourtCard key={q.court} court={q.court} playing={q.playing[0] ?? null} next={q.next} nextReady={q.next ? presence[q.next.id] : undefined} />
            ))}
          </div>
        )}
      </section>

      {/* Footer ticker info */}
      <footer className="px-6 py-3 bg-slate-900/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div>
          <span>Last server confirmation: {lastConfirmed ?? "Syncing..."}</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={publicUrl} className="underline underline-offset-2" aria-label="Open the public tournament page">
            Public tournament
          </a>
          <span>· IISc Shuttlers Venue Display</span>
        </div>
      </footer>
    </div>
  );
}

function VenueCourtCard({
  court,
  playing,
  next,
  nextReady,
}: {
  court: string;
  playing: MatchView | null;
  next: MatchView | null;
  /** Both sides here (undefined: no check-in data for this match). */
  nextReady?: boolean;
}) {
  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* Court Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/60">
        <h2 className="text-2xl font-black text-white tracking-wider">{courtLabel(court)}</h2>
        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            playing
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          {playing ? "LIVE ON COURT" : "COURT FREE"}
        </span>
      </div>

      {/* Current Live Match */}
      <div className="flex-1 p-6 flex flex-col justify-between space-y-6">
        {playing ? (
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">
              <span>{playing.discipline ?? playing.categoryLabel} · {playing.roundName}</span>
              {playing.games.length > 0 && (
                <span>Game {playing.games.length}</span>
              )}
            </div>

            {/* Scoreboard rows */}
            <div className="space-y-4">
              <VenuePlayerRow
                label={playing.sides[0].label}
                games={playing.games.map((g) => g.side1)}
                isWinner={playing.sides[0].isWinner}
              />
              <div className="h-px bg-slate-800" />
              <VenuePlayerRow
                label={playing.sides[1].label}
                games={playing.games.map((g) => g.side2)}
                isWinner={playing.sides[1].isWinner}
              />
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 font-bold">
            No match currently in progress
          </div>
        )}

        {/* Up Next Preview */}
        {next && (
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Up Next on this court
              </p>
              {nextReady !== undefined && <SpectatorChip ready={nextReady} />}
            </div>
            <p className="text-sm font-bold text-slate-200 truncate">
              {next.sides[0].label} vs {next.sides[1].label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {next.discipline ?? next.categoryLabel} · {next.roundName}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VenuePlayerRow({
  label,
  games,
  isWinner,
}: {
  label: string;
  games: number[];
  isWinner: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-xl md:text-2xl font-black truncate ${isWinner ? "text-primary" : "text-white"}`}>
        {label}
      </span>
      <div className="flex items-center gap-3 shrink-0 tabular-nums font-mono">
        {games.length === 0 ? (
          <span className="text-2xl font-black text-slate-500">0</span>
        ) : (
          games.map((pts, i) => (
            <span
              key={i}
              className={`text-2xl md:text-3xl font-black px-2.5 py-1 rounded-xl ${
                i === games.length - 1
                  ? "bg-primary text-primary-foreground font-black ring-2 ring-primary/40"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {pts}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

