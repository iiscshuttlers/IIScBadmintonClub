import { useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Info, Loader2, Users, User } from "lucide-react";
import { playerService } from "@/services/playerService";
import { usePageMeta } from "@/hooks/usePageMeta";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import { DISCIPLINES, matchPath, parseDiscipline, type Discipline } from "@/lib/tournamentRoutes";
import { DISCIPLINE_LABELS } from "@/lib/matchView";
import {
  RESULT_POLICY_TEXT,
  compareSides,
  sampleNote,
  type ComparisonMeeting,
  type ComparisonSide,
} from "@/lib/comparison";
import { fetchComparisonRows } from "@/services/comparisonService";
import {
  PAIR_KIND_LABELS,
  PAIR_KIND_NEEDS,
  genderOf,
  misfitOnSecondSide,
  possibleKinds,
  settledKind,
  type Gender,
} from "@/lib/pairRules";

/**
 * Compare any two players or any two pairs (WP8):
 *   /h2h?a=<id>&b=<id>             players
 *   /h2h?a=<id>,<id>&b=<id>,<id>   pairs (order inside a pair does not matter)
 *   &cat=MS|WS|MD|WD|XD            discipline filter (players only: two pairs
 *                                  make one event, set by pair A's genders)
 */

type PublicPlayer = { id: string; full_name: string | null; gender: string | null };

const parseIds = (v: string | null) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[0-9a-f-]{36}$/i.test(x))
    .slice(0, 2);

export default function HeadToHeadPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const aIds = parseIds(params.get("a"));
  const bIds = parseIds(params.get("b"));
  const mode: "players" | "pairs" = params.get("mode") === "pairs" || aIds.length === 2 || bIds.length === 2 ? "pairs" : "players";
  const discipline = mode === "pairs" ? null : parseDiscipline(params.get("cat") ?? "");
  const period = params.get("period") === "12m" || params.get("period") === "36m" ? params.get("period")! : "all";
  const dateFrom = useMemo(() => {
    if (period === "all") return null;
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - (period === "12m" ? 12 : 36));
    return date.toISOString();
  }, [period]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setLocation(`/h2h?${next.toString()}`, { replace: true });
  };

  const players = useQuery({
    queryKey: ["players", "public-list"],
    queryFn: async (): Promise<PublicPlayer[]> => {
      const data = await playerService.getPublicPlayerList();
      return (data ?? []) as PublicPlayer[];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Pairs: pair A's genders set the event (two men, two women, or one of
  // each) and pair B's pickers only offer players who fit (lib/pairRules).
  const genderById = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, genderOf(p)] as const)),
    [players.data],
  );
  const g = (id: string): Gender => genderById.get(id) ?? null;
  const pairEvent = mode === "pairs" ? settledKind(aIds.map(g), bIds.map(g)) : null;

  // When pair A changes, drop pair B's picks that no longer fit.
  useEffect(() => {
    if (mode !== "pairs" || !players.data) return;
    const misfit = misfitOnSecondSide(aIds.map(g), bIds[0] ? g(bIds[0]) : undefined, bIds[1] ? g(bIds[1]) : undefined);
    if (misfit === "player") set({ b: null });
    else if (misfit === "partner") set({ b: bIds[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, players.data, aIds.join(), bIds.join()]);

  const need = mode === "pairs" ? 2 : 1;
  const ready = aIds.length === need && bIds.length === need && !aIds.some((x) => bIds.includes(x));
  const a: ComparisonSide = { ids: aIds };
  const b: ComparisonSide = { ids: bIds };

  const data = useQuery({
    queryKey: ["tournament_matches", "comparison", [...aIds].sort().join("+"), [...bIds].sort().join("+")],
    queryFn: () => fetchComparisonRows(a, b),
    enabled: ready,
    staleTime: 60_000,
  });

  const result = useMemo(
    () => (data.data ? compareSides(data.data.rows, a, b, { discipline, dateFrom }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.data, aIds.join(), bIds.join(), discipline, dateFrom],
  );

  const nameOf = (id: string) => players.data?.find((p) => p.id === id)?.full_name ?? data.data?.players[id]?.full_name ?? "Player";
  const sideName = (ids: string[]) => (ids.length ? ids.map(nameOf).join(" & ") : "—");
  usePageMeta({ title: ready ? `${sideName(aIds)} vs ${sideName(bIds)}` : "Head-to-head" });

  const picker = (which: "a" | "b", idx: number) => {
    const ids = which === "a" ? aIds : bIds;
    const value = ids[idx] ?? "";
    const all = players.data ?? [];
    const mates = idx === 1 && bIds[0] ? [g(bIds[0])] : [];
    const options =
      mode === "pairs" && which === "b"
        ? all.filter((p) => !ids.includes(p.id) || p.id === value)
            .filter((p) => possibleKinds(aIds.map(g), [...mates, genderOf(p)]).length > 0)
        : all;
    return (
      <PlayerSelect
        value={value}
        players={options}
        placeholder={mode === "pairs" ? (idx === 0 ? "Player" : "Partner") : "Choose a player"}
        onChange={(v) => {
          const next = [...ids];
          next[idx] = v;
          set({ [which]: next.filter(Boolean).join(",") || null });
        }}
      />
    );
  };

  const note = result ? sampleNote(result.sample) : null;

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="container mx-auto max-w-3xl px-4 pt-5 space-y-4">
        <h1 className="text-2xl font-black">Head-to-head</h1>

        <div role="radiogroup" aria-label="Compare" className="inline-flex rounded-xl border border-border-strong p-1">
          {(["players", "pairs"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => set({ mode: m === "pairs" ? "pairs" : null, a: null, b: null })}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg text-sm font-bold ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {m === "players" ? <User className="w-4 h-4" aria-hidden /> : <Users className="w-4 h-4" aria-hidden />}
              {m === "players" ? "Two players" : "Two pairs"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] items-start">
          <fieldset className="space-y-2">
            <legend className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">{mode === "pairs" ? "Pair A" : "Player A"}</legend>
            {picker("a", 0)}
            {mode === "pairs" && picker("a", 1)}
          </fieldset>
          <button
            type="button"
            onClick={() => set({ a: bIds.join(",") || null, b: aIds.join(",") || null })}
            className="self-center justify-self-center inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-border-strong"
            aria-label="Swap sides"
          >
            <ArrowLeftRight className="w-4 h-4" aria-hidden />
          </button>
          <fieldset className="space-y-2">
            <legend className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">{mode === "pairs" ? "Pair B" : "Player B"}</legend>
            {picker("b", 0)}
            {mode === "pairs" && picker("b", 1)}
          </fieldset>
        </div>

        {mode === "pairs" ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-bold text-foreground">{pairEvent ? PAIR_KIND_LABELS[pairEvent] : "Doubles & mixed"}</span>
            {pairEvent
              ? ` · Pair B must be ${PAIR_KIND_NEEDS[pairEvent]}.`
              : " · Pair B must match pair A: two men, two women, or a man and a woman."}
          </p>
        ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Discipline">
          {[null, ...DISCIPLINES].map((d) => (
            <button
              key={d ?? "all"}
              onClick={() => set({ cat: d })}
              aria-pressed={discipline === d}
              className={`min-h-[44px] px-3 rounded-xl text-sm font-bold border ${discipline === d ? "bg-primary text-primary-foreground border-primary" : "border-border-strong"}`}
              title={d ? DISCIPLINE_LABELS[d as Discipline] : "All disciplines"}
            >
              {d ?? "All"}
            </button>
          ))}
        </div>
        )}

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Comparison period">
          <span className="text-xs font-bold text-muted-foreground">Period</span>
          {(["all", "12m", "36m"] as const).map((value) => (
            <button
              key={value}
              onClick={() => set({ period: value === "all" ? null : value })}
              aria-pressed={period === value}
              className={`min-h-[44px] px-3 rounded-xl text-sm font-bold border ${period === value ? "bg-primary text-primary-foreground border-primary" : "border-border-strong"}`}
            >
              {value === "all" ? "All time" : value === "12m" ? "Last 12 months" : "Last 3 years"}
            </button>
          ))}
        </div>

        {!ready ? (
          <p className="text-sm text-muted-foreground">
            {aIds.some((x) => bIds.includes(x))
              ? "The same player can't be on both sides."
              : mode === "pairs"
                ? "Choose both players of each pair."
                : "Choose two players to compare."}
          </p>
        ) : data.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Loading meetings…
          </p>
        ) : data.isError || !result ? (
          <p role="alert" className="text-sm text-danger">
            Couldn't load match history.{" "}
            <button className="underline font-bold" onClick={() => void data.refetch()}>Try again</button>
          </p>
        ) : (
          <>
            <section aria-label="Summary" className="rounded-3xl bg-card border border-border p-5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                <p className="font-black break-words">{sideName(aIds)}</p>
                <p className="text-3xl font-black tabular-nums" aria-label={`${result.aWins} wins to ${result.bWins}`}>
                  {result.aWins} – {result.bWins}
                </p>
                <p className="font-black break-words">{sideName(bIds)}</p>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {result.sample} counted {result.sample === 1 ? "meeting" : "meetings"}
                {discipline ? ` in ${DISCIPLINE_LABELS[discipline]}` : ""}
                {period !== "all" ? ` · ${period === "12m" ? "last 12 months" : "last 3 years"}` : ""}
                {result.walkovers.aWon + result.walkovers.bWon > 0 &&
                  ` · walkovers ${result.walkovers.aWon}–${result.walkovers.bWon} (not counted)`}
                {result.excluded > 0 && ` · ${result.excluded} not counted`}
              </p>
              {note && <p className="mt-1 text-center text-xs font-bold text-warning">{note}</p>}
              {result.formA.length > 0 && (
                <p className="mt-3 text-center text-xs">
                  <span className="text-muted-foreground">Last {result.formA.length} meetings for {sideName(aIds)}: </span>
                  {result.formA.map((f, i) => (
                    <span
                      key={i}
                      className={`inline-block mx-0.5 w-6 rounded font-black ${f === "W" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}
                      aria-label={f === "W" ? "won" : "lost"}
                    >
                      {f}
                    </span>
                  ))}
                </p>
              )}
              {data.data?.truncated && (
                <p className="mt-2 text-center text-xs text-warning">Very long history: only the first 1000 matches of each kind were checked.</p>
              )}
            </section>

            {result.together && (
              <section aria-label="Played together" className="rounded-2xl border border-border-strong p-4 text-sm">
                <p className="font-bold">As partners</p>
                {result.together.played === 0 ? (
                  <p className="text-muted-foreground">No counted matches together{discipline ? ` in ${discipline}` : ""}.</p>
                ) : (
                  <p>
                    Played {result.together.played} together: won {result.together.won}, lost {result.together.lost}.{" "}
                    <Link className="underline font-bold" href={`/h2h?mode=pairs&a=${aIds[0]},${bIds[0]}`}>Compare this pair →</Link>
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Partner results are kept separate from the head-to-head above.</p>
              </section>
            )}

            <section aria-label="Meetings">
              <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">Meetings</h2>
              {result.meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recorded meetings{discipline ? ` in ${discipline}` : ""}.</p>
              ) : (
                <ol className="space-y-2">
                  {result.meetings.map((m) => (
                    <MeetingRow key={`${m.row.source}:${m.row.id}`} m={m} aName={sideName(aIds)} />
                  ))}
                </ol>
              )}
            </section>

            <details className="rounded-2xl border border-border-strong p-4 text-sm">
              <summary className="cursor-pointer font-bold inline-flex items-center gap-1.5 min-h-[44px]">
                <Info className="w-4 h-4" aria-hidden /> What is counted?
              </summary>
              <p className="mt-2 text-muted-foreground">{RESULT_POLICY_TEXT}</p>
              <p className="mt-2 text-muted-foreground">
                A pair is the same pair whichever partner is listed first, but a different partner makes a different pair.
              </p>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

function MeetingRow({ m, aName }: { m: ComparisonMeeting; aName: string }) {
  const date = m.row.date ? new Date(m.row.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Date unknown";
  const outcome =
    m.eligibility === "excluded"
      ? `Not counted — ${m.excludedReason}`
      : m.eligibility === "walkover"
        ? `Walkover — ${m.aWon ? `${aName} advanced` : `${aName} did not advance`} (not counted)`
        : m.aWon
          ? `${aName} won`
          : `${aName} lost`;
  const body = (
    <>
      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>{date}</span>
        {m.discipline && <span>· {m.discipline}</span>}
        <span>· {m.row.event ?? (m.row.source === "friendly" ? "Friendly" : "Tournament")}</span>
        {m.row.round && <span>· {m.row.round}</span>}
      </span>
      <span className={`block font-bold ${m.eligibility !== "counted" ? "text-muted-foreground" : ""}`}>{outcome}</span>
      {m.row.score && <span className="block font-mono text-sm tabular-nums">{m.row.score}</span>}
    </>
  );
  const cls = "block rounded-2xl border border-border bg-card p-3";
  return (
    <li>
      {m.row.source === "tournament" && m.row.tournamentId ? (
        <Link href={matchPath(m.row.tournamentId, m.row.id)} className={`${cls} hover:border-primary`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}
