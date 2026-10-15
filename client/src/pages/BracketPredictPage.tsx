import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Lock, Medal, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  candidates,
  isByeLabel,
  hasStarted,
  isLocked,
  matchLocked,
  maxPoints,
  roundPoints,
  predictableRounds,
  score,
  setPick,
  type PMatch,
  type Picks,
} from "@/lib/bracketPredict";

// bracket_predictions is new; generated types catch up after `supabase db push`.
const sb = supabase as any;

const CAT: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles", WD: "Women's Doubles", XD: "Mixed Doubles",
};

export default function BracketPredictPage() {
  const [, params] = useRoute<{ tournamentId: string }>("/predict/:tournamentId");
  const tournamentId = params?.tournamentId ?? "";
  const { profile } = useAuth();
  const me = profile?.id ?? null;
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["predict", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const [{ data: t }, { data: ms, error }] = await Promise.all([
        supabase.from("tournaments").select("name, format_family").eq("id", tournamentId).maybeSingle(),
        supabase
          .from("tournament_matches")
          .select("id, match_code, round, round_name, match_number, status, winner_side, advances_to_match, advances_to_position, player1_id, player2_id, team1_label, team2_label, category")
          .eq("tournament_id", tournamentId)
          .is("tie_id", null),
      ]);
      if (error) throw error;
      const byCat: Record<string, PMatch[]> = {};
      for (const m of (ms ?? []) as any[]) (byCat[m.category] ??= []).push(m);
      return { name: (t as any)?.name ?? "Tournament", byCat };
    },
  });

  const categories = useMemo(() => Object.keys(data?.byCat ?? {}).sort(), [data]);
  const [cat, setCat] = useState<string>("");
  useEffect(() => {
    if (!cat && categories.length) setCat(categories[0]);
  }, [categories, cat]);
  const matches = data?.byCat[cat] ?? [];
  const locked = isLocked(matches);
  const started = hasStarted(matches);
  const roundsList = useMemo(() => predictableRounds(matches), [matches]);

  usePageMeta({ title: `Bracket challenge · ${data?.name ?? ""}`, description: "Predict the draw" });

  // Own row (RLS: own only).
  const { data: mine } = useQuery({
    queryKey: ["predict-mine", tournamentId, cat, me],
    enabled: !!tournamentId && !!cat && !!me,
    queryFn: async () => {
      const { data, error } = await sb
        .from("bracket_predictions")
        .select("picks")
        .eq("tournament_id", tournamentId)
        .eq("category", cat)
        .eq("user_id", me)
        .maybeSingle();
      if (error) throw error;
      return { picks: ((data?.picks ?? {}) as Picks) };
    },
  });

  // Everyone's picks, filtered server-side to matches that have started.
  const { data: board } = useQuery({
    queryKey: ["predict-board", tournamentId, cat],
    enabled: !!tournamentId && !!cat && !!me && started,
    queryFn: async () => {
      const { data, error } = await sb.rpc("bracket_leaderboard", { p_tournament: tournamentId, p_category: cat });
      if (error) throw error;
      return (data ?? []) as { user_id: string; full_name: string | null; picks: Picks }[];
    },
  });

  const [picks, setPicks] = useState<Picks>({});
  const loadedFor = useRef<string>("");
  useEffect(() => {
    const key = `${cat}:${me}`;
    if (!mine || loadedFor.current === key) return;
    loadedFor.current = key;
    setPicks(mine.picks);
  }, [mine, cat, me]);

  // Debounced autosave.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const choose = (code: string, id: string) => {
    const m = matches.find((x) => x.match_code === code);
    if (!me || !m || matchLocked(m)) return;
    const next = setPick(matches, picks, code, id);
    setPicks(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const { error } = await sb
        .from("bracket_predictions")
        .upsert({ tournament_id: tournamentId, category: cat, user_id: me, picks: next, updated_at: new Date().toISOString() });
      setSaving(false);
      if (error) {
        const lockedNow = /has started/i.test(error.message);
        toast.error(lockedNow ? "That match has just started, so its pick is locked." : "Couldn't save your picks");
        if (lockedNow) {
          // Our view was stale: reload matches and fall back to what's saved.
          loadedFor.current = "";
          qc.invalidateQueries({ queryKey: ["predict", tournamentId] });
          qc.invalidateQueries({ queryKey: ["predict-mine", tournamentId, cat, me] });
        }
      } else qc.invalidateQueries({ queryKey: ["predict-mine", tournamentId, cat, me] });
    }, 600);
  };

  const real = roundsList.flat().filter((m) => !isByeLabel(m.team1_label) && !isByeLabel(m.team2_label));
  const total = real.length;
  const openLeft = real.filter((m) => !matchLocked(m)).length;
  const made = real.filter((m) => picks[m.match_code]).length;
  const max = maxPoints(matches);
  const leaderboard = useMemo(
    () =>
      started
        ? (board ?? [])
            .map((r) => ({ id: r.user_id, name: r.full_name ?? "Player", ...score(matches, r.picks ?? {}) }))
            .sort((a, b) => b.points - a.points || b.correct - a.correct)
        : [],
    [board, matches, started],
  );

  const myScore = started ? score(matches, picks) : undefined;
  const pickedAny = Object.keys(picks).length > 0;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading bracket" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        compact
        badge="Bracket challenge"
        badgeIcon={<Sparkles className="w-3.5 h-3.5 text-primary" />}
        title={data?.name ?? "Bracket challenge"}
        subtitle="Pick a winner for every match before play starts. Each correct pick: 2 pts from the quarterfinals on, 1 pt in earlier rounds."
      />
      <div className="container mx-auto px-4 py-5 max-w-2xl space-y-5">
        {error && <p className="text-sm text-muted-foreground">Couldn't load this tournament.</p>}
        {!me && <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm">Sign in to make your predictions.</p>}

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" role="tablist" aria-label="Category">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={c === cat}
              onClick={() => {
                setCat(c);
                loadedFor.current = "";
              }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition ${
                c === cat ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25" : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {CAT[c] ?? c}
            </button>
          ))}
        </div>

        {/* Status: lock + progress + points */}
        <div
          className={`rounded-2xl border p-4 flex items-center gap-4 ${
            locked ? "border-amber-500/40 bg-amber-500/10" : "border-primary/30 bg-primary/5"
          }`}
          aria-live="polite"
        >
          <span className={`w-10 h-10 shrink-0 rounded-full grid place-items-center ${locked ? "bg-amber-500/20 text-amber-500" : "bg-primary/15 text-primary"}`}>
            {locked ? <Lock className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black">
              {locked
                ? "All matches have started: predictions closed"
                : saving
                  ? "Saving…"
                  : made === total && total > 0
                    ? "All picked. You're set!"
                    : started
                      ? `${openLeft} match${openLeft === 1 ? "" : "es"} still open: pick before each starts`
                      : "Open: tap a player to pick"}
            </p>
            {locked ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {pickedAny && myScore ? `You have ${myScore.points} pts · ${myScore.correct}/${myScore.decided} correct` : "You didn't predict this category."}
              </p>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${total ? (made / total) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums text-muted-foreground">{made}/{total}</span>
              </div>
            )}
          </div>
          <span className="text-right shrink-0">
            <span className="block text-lg font-black tabular-nums leading-none">{started && pickedAny && myScore ? myScore.points : max}</span>
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{started && pickedAny && myScore ? "points" : "max pts"}</span>
          </span>
        </div>

        {roundsList.length === 0 ? (
          <p className="text-sm text-muted-foreground">The draw for this category hasn't been made yet.</p>
        ) : (
          roundsList.map((r, i) => {
            const list = r.filter((m) => !isByeLabel(m.team1_label) && !isByeLabel(m.team2_label));
            if (!list.length) return null;
            return (
              <section key={i} className="space-y-3" aria-label={r[0]?.round_name ?? `Round ${i + 1}`}>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                  <span className="w-1.5 h-4 rounded-full bg-primary" />
                  {r[0]?.round_name ?? `Round ${i + 1}`}
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px]">{roundPoints(i, roundsList.length)} pt{roundPoints(i, roundsList.length) > 1 ? "s" : ""} each</span>
                </h3>
                {list.map((m) => {
                  const [a, b] = candidates(matches, m, picks);
                  const winnerId = m.winner_side ? (m.winner_side === 1 ? m.player1_id : m.player2_id) : null;
                  const myPick = picks[m.match_code];
                  const result = myPick && winnerId ? (myPick === winnerId ? "right" : "wrong") : null;
                  return (
                    <article key={m.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-black text-muted-foreground">{m.match_code}</span>
                        <span className="ml-auto text-[10px] font-black uppercase tracking-wider">
                          {result === "right" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /> +{roundPoints(i, roundsList.length)}</span>
                          ) : result === "wrong" ? (
                            <span className="inline-flex items-center gap-1 text-rose-500"><XCircle className="w-3.5 h-3.5" /> Missed</span>
                          ) : m.winner_side ? (
                            <span className="text-muted-foreground">Done</span>
                          ) : myPick ? (
                            <span className="inline-flex items-center gap-1 text-primary">{matchLocked(m) && <Lock className="w-3 h-3" />} {matchLocked(m) ? "Locked in" : "Picked"}</span>
                          ) : matchLocked(m) ? (
                            <span className="inline-flex items-center gap-1 text-amber-500"><Lock className="w-3 h-3" /> {myPick ? "Locked" : "No pick"}</span>
                          ) : (
                            <span className="text-muted-foreground">Tap to pick</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-stretch gap-2">
                        {[a, b].map((c, k) => {
                          const picked = !!c && myPick === c.id;
                          const won = m.winner_side === k + 1;
                          return (
                            <Fragment key={k}>
                              {k === 1 && <span className="self-center text-[10px] font-black text-rose-400 shrink-0">VS</span>}
                              <button
                                type="button"
                                disabled={!c || matchLocked(m) || !me}
                                onClick={() => c && choose(m.match_code, c.id)}
                                aria-pressed={picked}
                                className={`flex-1 min-w-0 min-h-[3.25rem] rounded-xl border px-3 py-2 text-sm font-bold transition flex items-center gap-2 ${k ? "justify-end text-right" : ""} ${
                                  picked
                                    ? result === "wrong"
                                      ? "border-rose-500/60 bg-rose-500/10"
                                      : "border-primary bg-primary/15 text-foreground ring-2 ring-primary/30"
                                    : "border-border bg-muted/30 text-foreground/90 enabled:hover:border-primary/50"
                                } disabled:cursor-default`}
                              >
                                {picked && k === 0 && <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />}
                                <span className={`line-clamp-2 break-words ${won ? "text-emerald-500" : !c && !(k ? m.team2_label : m.team1_label) ? "text-muted-foreground italic font-medium" : ""}`}>
                                  {c?.label ?? ((k ? m.team2_label : m.team1_label) || "Winner of earlier pick")}
                                </span>
                                {picked && k === 1 && <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />}
                              </button>
                            </Fragment>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })
        )}

        {started && (
          <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="lb-h">
            <h3 id="lb-h" className="flex items-center gap-2 text-sm font-black">
              <Medal className="w-4 h-4 text-amber-500" /> Leaderboard · {CAT[cat] ?? cat}
            </h3>
            {leaderboard.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nobody predicted this category.</p>
            ) : (
              <ol className="mt-2 divide-y divide-border">
                {leaderboard.map((r, i) => (
                  <li key={r.id} className={`flex items-center justify-between py-1.5 text-sm ${r.id === me ? "font-black" : ""}`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 text-right tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="tabular-nums">
                      {r.points} pts <span className="text-muted-foreground font-normal">· {r.correct}/{r.decided}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </>
  );
}
