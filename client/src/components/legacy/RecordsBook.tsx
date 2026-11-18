import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MATCH_VIEW_COLUMNS, toMatchView, type MatchRow } from "@/lib/matchView";
import { computeClubRecords, type MatchRecordRow, type PlayerRecordRow, type RecordTournament } from "@/lib/clubRecords";
import { DISCIPLINES, matchPath, parseDiscipline } from "@/lib/tournamentRoutes";
import { ChipStrip } from "@/components/match/ChipStrip";
import { usePlayerNames } from "@/hooks/queries/usePlayerNames";

/**
 * All-time records book (cricinfo Statsguru style) for the Legacy page.
 * Data: every decided match of published tournaments, paged in 1,000-row
 * chunks (PostgREST's row cap), cached and refreshed with tournament_matches.
 */

const PAGE = 1000;
const MAX_PAGES = 10;

type Row = MatchRow & { tournaments: { id: string; name: string; status: string; counts_for_elo: boolean | null } | null };

async function fetchRecordData() {
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("tournament_matches")
      .select(`${MATCH_VIEW_COLUMNS}, tournaments!inner(id, name, status, counts_for_elo)`)
      .in("status", ["completed", "finished", "walkover"])
      .not("tournaments.status", "in", "(draft,cancelled,deleted)")
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) break;
  }
  const tournaments: Record<string, RecordTournament> = {};
  for (const r of rows) {
    const t = r.tournaments;
    if (t) tournaments[t.id] = { id: t.id, name: t.name, countsForElo: t.counts_for_elo !== false };
  }
  // Plain JSON for the persisted cache: rows without the embed, plus a tournament map.
  return {
    rows: rows.map(({ tournaments: _t, ...m }) => m as MatchRow),
    tournaments,
  };
}

function PlayerTable({ title, unit, rows }: { title: string; unit: string; rows: PlayerRecordRow[] }) {
  return (
    <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No record yet.</p>
      ) : (
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r, i) => (
            <li key={r.playerId} className="flex items-center justify-between gap-3 py-2 min-h-[44px]">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <Link href={`/player/${r.playerId}`} className="text-sm font-semibold break-words hover:text-primary hover:underline underline-offset-2">
                  {r.name}
                </Link>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-black tabular-nums">
                  {r.value} {unit}
                </span>
                {r.note && <span className="block text-[11px] text-muted-foreground">{r.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MatchTable({ title, unit, rows }: { title: string; unit: (v: number) => string; rows: MatchRecordRow[] }) {
  return (
    <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No record yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.matchId}>
              <Link
                href={matchPath(r.tournamentId, r.matchId)}
                className="flex items-start justify-between gap-3 rounded-xl px-2 py-2 min-h-[44px] hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold break-words">{r.title}</span>
                  <span className="block text-xs text-muted-foreground">{r.detail}</span>
                </span>
                <span className="shrink-0 text-sm font-black tabular-nums">{unit(r.value)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function RecordsBook() {
  const [catRaw, setCatRaw] = useState("");
  const [rankedOnly, setRankedOnly] = useState(false);
  const cat = parseDiscipline(catRaw);
  const q = useQuery({
    queryKey: ["tournament_matches", "club-records"],
    queryFn: fetchRecordData,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const views = useMemo(() => (q.data ? q.data.rows.map((r) => toMatchView(r)) : []), [q.data]);
  const allIds = useMemo(() => Array.from(new Set(views.flatMap((v) => v.sides.flatMap((s) => s.playerIds)))), [views]);
  const names = usePlayerNames(allIds);
  const records = useMemo(
    () => (q.data ? computeClubRecords(views, q.data.tournaments, { discipline: cat, rankedOnly, names: names.data }) : null),
    [views, q.data, cat, rankedOnly, names.data],
  );

  return (
    <section aria-label="Club records" className="container mx-auto px-4 max-w-5xl py-6 space-y-4">
      <div className="space-y-2">
        <ChipStrip
          label="Discipline"
          options={[{ value: "", label: "Overall" }, ...DISCIPLINES.map((d) => ({ value: d, label: d }))]}
          value={cat ?? ""}
          onChange={setCatRaw}
        />
        <label className="inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold cursor-pointer">
          <input type="checkbox" checked={rankedOnly} onChange={(e) => setRankedOnly(e.target.checked)} className="w-4 h-4 accent-primary" />
          Ranked tournaments only
        </label>
      </div>

      {q.isPending ? (
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
          <span className="sr-only">Loading records…</span>
        </div>
      ) : q.isError || !records ? (
        <div role="alert" className="text-center py-10">
          <p className="font-black">Couldn't load records</p>
          <button type="button" onClick={() => void q.refetch()} className="mt-3 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-black">
            <RefreshCw className="w-4 h-4" aria-hidden /> Retry
          </button>
        </div>
      ) : rankedOnly && !Object.values(q.data.tournaments).some((t) => t.countsForElo) ? (
        <p className="text-sm text-muted-foreground py-6">
          No ranked tournaments yet. None of the recorded tournaments counted for ratings — untick the box to see records from all tournaments.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            From {records.matchCount.toLocaleString("en-IN")} decided matches in {records.tournamentCount} tournaments recorded on this site
            {rankedOnly ? " that counted for ratings" : ""}. Friendly and cancelled matches aren't included.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <PlayerTable title="Most titles" unit="" rows={records.mostTitles} />
            <PlayerTable title="Most finals" unit="" rows={records.mostFinals} />
            <PlayerTable title="Most tournament match wins" unit="" rows={records.mostWins} />
            <PlayerTable title="Longest winning streak" unit="in a row" rows={records.longestStreak} />
            <MatchTable title="Longest single game" unit={(v) => `${v} pts`} rows={records.longestGame} />
            <MatchTable title="Closest final" unit={(v) => `±${v}`} rows={records.closestFinal} />
          </div>
        </>
      )}
    </section>
  );
}
