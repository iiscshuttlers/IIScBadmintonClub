import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { headToHead, type HistMatch } from "@/lib/headToHead";
import type { MatchSide, MatchView } from "@/lib/matchView";
import { FormChips } from "@/components/match/MatchPrimitives";
import { useRecentForm } from "@/hooks/queries/useRecentForm";

/**
 * H2H & form (FotMob / BWF pre-match context). Tournament matches only:
 * the head-to-head record between the two sides (a player, or an exact
 * pair in any order) and every player's last-5 tournament form.
 */

const HIST_COLUMNS =
  "id, status, winner_side, player1_id, player2_id, player3_id, player4_id, score, ended_at, scheduled_at, category, tournaments(name)";

/** Side label "A / B" → per-player names aligned with playerIds; falls back to the side label. */
export function playerNames(side: MatchSide): Array<{ id: string; name: string }> {
  const names = side.label.split(/\s+(?:\/|&)\s+/).map((n) => n.trim()).filter(Boolean);
  return side.playerIds.map((id, i) => ({
    id,
    name: side.playerIds.length === names.length ? names[i] : side.playerIds.length === 1 ? side.label : `${side.label} (${i + 1})`,
  }));
}

function useH2HHistory(view: MatchView) {
  const a = view.sides[0].playerIds;
  const b = view.sides[1].playerIds;
  const ids = Array.from(new Set([...a, ...b])).sort();
  return useQuery({
    queryKey: ["tournament_matches", "h2h", view.id, ids],
    enabled: a.length > 0 && b.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Matches where side A's first player took part; H2H filtering is client-side.
      const list = a.join(",");
      const { data, error } = await supabase
        .from("tournament_matches")
        .select(HIST_COLUMNS)
        .in("status", ["completed", "walkover"])
        .or(`player1_id.in.(${list}),player2_id.in.(${list}),player3_id.in.(${list}),player4_id.in.(${list})`)
        .order("ended_at", { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as HistMatch[];
    },
  });
}

export function MatchH2HTab({ view }: { view: MatchView }) {
  const [s1, s2] = view.sides;
  const hasEntrants = s1.playerIds.length > 0 && s2.playerIds.length > 0;
  const history = useH2HHistory(view);
  const form = useRecentForm([...s1.playerIds, ...s2.playerIds]);
  if (!hasEntrants) {
    return <p className="mt-4 text-sm text-muted-foreground">Head-to-head appears once both sides are known.</p>;
  }

  // The match being viewed is excluded so a finished match doesn't count against itself.
  const h2h = history.data ? headToHead(history.data.filter((m) => m.id !== view.id), s1.playerIds, s2.playerIds) : null;
  const singles = s1.playerIds.length === 1 && s2.playerIds.length === 1;

  return (
    <div className="mt-4 space-y-6">
      <section aria-labelledby="h2h-heading">
        <h2 id="h2h-heading" className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
          Head-to-head in tournaments
        </h2>
        {history.isPending ? (
          <p className="text-sm text-muted-foreground" role="status">Loading head-to-head…</p>
        ) : history.isError ? (
          <p className="text-sm text-muted-foreground">Couldn't load head-to-head.</p>
        ) : h2h && h2h.meetings.length > 0 ? (
          <>
            <div className="grid grid-cols-3 items-center text-center rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 py-3">
              <div className="min-w-0 px-2">
                <p className="text-3xl font-black tabular-nums">{h2h.aWins}</p>
                <p className="text-xs font-semibold truncate">{s1.label}</p>
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                {h2h.meetings.length} {h2h.meetings.length === 1 ? "meeting" : "meetings"}
              </p>
              <div className="min-w-0 px-2">
                <p className="text-3xl font-black tabular-nums">{h2h.bWins}</p>
                <p className="text-xs font-semibold truncate">{s2.label}</p>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {h2h.meetings.slice(0, 5).map((m) => (
                <li key={m.id} className="py-2 flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{m.aWon ? s1.label : s2.label}</span> won
                    {m.score ? <span className="font-mono tabular-nums text-muted-foreground"> · {m.score}</span> : null}
                    <span className="block text-xs text-muted-foreground truncate">
                      {[m.where, m.date ? new Date(m.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">First tournament meeting.</p>
        )}
        {singles && (
          <Link
            href={`/compare/${s1.playerIds[0]}/${s2.playerIds[0]}`}
            className="mt-3 inline-flex items-center min-h-[44px] text-sm font-black text-primary underline underline-offset-2"
          >
            Full player comparison
          </Link>
        )}
      </section>

      <section aria-labelledby="form-heading">
        <h2 id="form-heading" className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
          Last 5 tournament matches
        </h2>
        <ul className="space-y-2">
          {[s1, s2].flatMap((side) =>
            playerNames(side).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold min-w-0 break-words">{p.name}</span>
                <FormChips entries={form.data?.[p.id]} loading={form.isPending} />
              </li>
            )),
          )}
        </ul>
      </section>
    </div>
  );
}
