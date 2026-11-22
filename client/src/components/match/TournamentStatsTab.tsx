import { useMemo } from "react";
import { Link } from "wouter";
import { Loader2, RefreshCw } from "lucide-react";
import { useQueryState } from "@/hooks/useQueryState";
import { useDecidedMatchViews } from "@/hooks/queries/useMatchViews";
import { filterMatches } from "@/lib/matchView";
import { computeTournamentStats, type LeaderRow, type MatchRef } from "@/lib/tournamentStats";
import { DISCIPLINES, matchPath, parseDiscipline } from "@/lib/tournamentRoutes";
import { ChipStrip } from "@/components/match/ChipStrip";
import { SidesVs } from "@/components/match/MatchPrimitives";
import { usePlayerNames } from "@/hooks/queries/usePlayerNames";

/**
 * Tournament Stats (cricinfo series stats / FotMob top stats). Built only
 * from finished matches, so it updates live but never shows an in-progress
 * score as a record. Headed "So far" until the tournament ends (owner
 * decision 6, 14 Nov 2026).
 */

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-background/60 border border-border px-3 py-3">
      <p className="text-2xl font-black tabular-nums text-foreground leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function MatchList({ title, unit, items }: { title: string; unit: (v: number) => string; items: MatchRef[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</h3>
      <ol className="space-y-1.5">
        {items.map((m) => (
          <li key={m.id}>
            <Link
              href={matchPath(m.tournamentId, m.id)}
              className="flex items-start justify-between gap-3 rounded-xl px-3 py-2 min-h-[44px] bg-card border border-border hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="min-w-0">
                <span className="block text-sm break-words">
                  <SidesVs sides={m.sides} winner={m.winner} />
                </span>
                <span className="block text-xs text-muted-foreground">{m.detail}</span>
              </span>
              <span className="shrink-0 text-sm font-black tabular-nums">{unit(m.value)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Leaders({ title, unit, rows }: { title: string; unit: (v: number) => string; rows: LeaderRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</h3>
      <ol className="divide-y divide-border rounded-xl bg-card border border-border">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center justify-between gap-3 px-3 py-2 min-h-[44px]">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              {r.playerIds.length === 1 ? (
                <Link href={`/player/${r.playerIds[0]}`} className="text-sm font-semibold break-words hover:text-primary underline-offset-2 hover:underline">
                  {r.label}
                </Link>
              ) : (
                <span className="text-sm font-semibold break-words">{r.label}</span>
              )}
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-black tabular-nums">{unit(r.value)}</span>
              {r.note && <span className="block text-[11px] text-muted-foreground">{r.note}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TournamentStatsTab({ tournamentId, finished }: { tournamentId: string; finished: boolean }) {
  const [catRaw, setCat] = useQueryState<string>("cat", "ALL", true);
  const cat = parseDiscipline(catRaw);
  const data = useDecidedMatchViews(tournamentId);
  const views = useMemo(() => filterMatches(data.views, { discipline: cat }), [data.views, cat]);
  const rawStats = useMemo(() => computeTournamentStats(views), [views]);
  // Name single players by id (team labels can't be split reliably).
  const ids = useMemo(() => Array.from(new Set(data.views.flatMap((v) => v.sides.flatMap((s) => s.playerIds)))), [data.views]);
  const names = usePlayerNames(ids);
  const stats = useMemo(() => {
    const n = names.data;
    if (!n) return rawStats;
    const fix = (rows: LeaderRow[]) => rows.map((r) => (r.playerIds.length === 1 && n[r.playerIds[0]] ? { ...r, label: n[r.playerIds[0]] } : r));
    return { ...rawStats, mostWins: fix(rawStats.mostWins), bestGameWinPct: fix(rawStats.bestGameWinPct) };
  }, [rawStats, names.data]);

  if (data.status === "loading") {
    return (
      <div className="flex justify-center py-10" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Loading stats…</span>
      </div>
    );
  }
  if (data.status === "error") {
    return (
      <div role="alert" className="text-center py-10">
        <p className="font-black">Couldn't load stats</p>
        <button type="button" onClick={data.retry} className="mt-3 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-black">
          <RefreshCw className="w-4 h-4" aria-hidden /> Retry
        </button>
      </div>
    );
  }

  const header = finished
    ? "Final"
    : `So far · ${data.views.length}${data.total != null ? ` of ${data.total}` : ""} matches completed`;

  return (
    <section aria-label="Tournament stats" className="space-y-5 mb-6">
      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground" role="status">
        {header}
      </p>
      <ChipStrip
        label="Discipline"
        options={[{ value: "", label: "All" }, ...DISCIPLINES.map((d) => ({ value: d, label: d }))]}
        value={cat ?? ""}
        onChange={(v) => setCat(v || "ALL")}
      />

      {stats.completed === 0 ? (
        <p className="text-center py-10 text-sm text-muted-foreground">Stats appear once a match is completed.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Tile value={stats.completed} label="Matches decided" />
            <Tile value={stats.games} label="Games played" />
            <Tile value={stats.points.toLocaleString("en-IN")} label="Points played" />
            <Tile value={stats.deuceGames} label="Games to deuce" />
            <Tile value={stats.threeGameMatches} label="Went to 3 games" />
            <Tile value={stats.walkovers} label="Walkovers & forfeits" />
          </div>

          <Leaders title="Most wins" unit={(v) => `${v}`} rows={stats.mostWins} />
          <Leaders title="Best game-win rate (min. 3 matches)" unit={(v) => `${v}%`} rows={stats.bestGameWinPct} />
          <MatchList title="Closest matches (smallest point margin)" unit={(v) => `±${v}`} items={stats.closest} />
          <MatchList title="Longest single game" unit={(v) => `${v} pts`} items={stats.longestGame} />
          {stats.longestByTime ? (
            <MatchList title="Longest matches by time" unit={(v) => `${v} min`} items={stats.longestByTime} />
          ) : (
            <p className="text-xs text-muted-foreground">Match timing wasn't recorded reliably for most matches, so time records are hidden.</p>
          )}
          <MatchList title="Seed upsets" unit={() => "Upset"} items={stats.seedUpsets} />
          <MatchList title="Most one-sided" unit={(v) => `±${v}`} items={stats.mostOneSided} />
        </>
      )}
    </section>
  );
}
