import { useEffect, useMemo, useRef, useState } from "react";
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
  isLocked,
  maxPoints,
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
  const roundsList = useMemo(() => predictableRounds(matches), [matches]);

  usePageMeta({ title: `Bracket challenge · ${data?.name ?? ""}`, description: "Predict the draw" });

  const { data: rows } = useQuery({
    queryKey: ["predict-rows", tournamentId, cat],
    enabled: !!tournamentId && !!cat && !!me,
    queryFn: async () => {
      const { data, error } = await sb
        .from("bracket_predictions")
        .select("user_id, picks, updated_at, player:players!bracket_predictions_user_id_fkey(full_name)")
        .eq("tournament_id", tournamentId)
        .eq("category", cat);
      if (error) throw error;
      return (data ?? []) as { user_id: string; picks: Picks; player?: { full_name: string } }[];
    },
  });

  const [picks, setPicks] = useState<Picks>({});
  const loadedFor = useRef<string>("");
  useEffect(() => {
    const key = `${cat}:${me}`;
    if (!rows || loadedFor.current === key) return;
    loadedFor.current = key;
    setPicks(rows.find((r) => r.user_id === me)?.picks ?? {});
  }, [rows, cat, me]);

  // Debounced autosave.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const choose = (code: string, id: string) => {
    if (locked || !me) return;
    const next = setPick(matches, picks, code, id);
    setPicks(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const { error } = await sb
        .from("bracket_predictions")
        .upsert({ tournament_id: tournamentId, category: cat, user_id: me, picks: next, updated_at: new Date().toISOString() });
      setSaving(false);
      if (error) toast.error(error.message.includes("row-level") ? "Predictions are locked — play has started." : "Couldn't save your picks");
      else qc.invalidateQueries({ queryKey: ["predict-rows", tournamentId, cat] });
    }, 600);
  };

  const total = roundsList.reduce((s, r) => s + r.filter((m) => !isByeLabel(m.team1_label) && !isByeLabel(m.team2_label)).length, 0);
  const made = Object.keys(picks).length;
  const max = maxPoints(matches);
  const leaderboard = useMemo(
    () =>
      locked
        ? (rows ?? [])
            .map((r) => ({ id: r.user_id, name: r.player?.full_name ?? "Player", ...score(matches, r.picks ?? {}) }))
            .sort((a, b) => b.points - a.points || b.correct - a.correct)
        : [],
    [rows, matches, locked],
  );

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
        subtitle="Pick a winner for every match before play starts. 1 point per first-round hit, doubling each round."
      />
      <div className="container mx-auto px-4 py-5 max-w-6xl space-y-5">
        {error && <p className="text-sm text-muted-foreground">Couldn't load this tournament.</p>}
        {!me && <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm">Sign in to make your predictions.</p>}

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Category">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={c === cat}
              onClick={() => {
                setCat(c);
                loadedFor.current = "";
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${c === cat ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {CAT[c] ?? c}
            </button>
          ))}
          <span className="ml-auto text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            {locked ? (
              <>
                <Lock className="w-3.5 h-3.5" /> Locked — play has started
              </>
            ) : saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
              </>
            ) : (
              `${made}/${total} picked · max ${max} pts`
            )}
          </span>
        </div>

        {roundsList.length === 0 ? (
          <p className="text-sm text-muted-foreground">The draw for this category hasn't been made yet.</p>
        ) : (
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex gap-4 min-w-max">
              {roundsList.map((r, i) => (
                <section key={i} className="w-56 shrink-0 space-y-2" aria-label={r[0]?.round_name ?? `Round ${i + 1}`}>
                  <h3 className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                    {r[0]?.round_name ?? `Round ${i + 1}`} · {2 ** i} pt{i ? "s" : ""}
                  </h3>
                  {r
                    .filter((m) => !isByeLabel(m.team1_label) && !isByeLabel(m.team2_label))
                    .map((m) => {
                      const [a, b] = candidates(matches, m, picks);
                      const winnerId = m.winner_side ? (m.winner_side === 1 ? m.player1_id : m.player2_id) : null;
                      return (
                        <div key={m.id} className="rounded-xl border border-border bg-card overflow-hidden">
                          {[a, b].map((c, k) => {
                            const picked = !!c && picks[m.match_code] === c.id;
                            const right = picked && winnerId === c!.id;
                            const wrong = picked && !!winnerId && winnerId !== c!.id;
                            return (
                              <button
                                key={k}
                                type="button"
                                disabled={!c || locked || !me}
                                onClick={() => c && choose(m.match_code, c.id)}
                                aria-pressed={picked}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm ${k ? "border-t border-border" : ""} ${
                                  picked ? "bg-primary/15 font-bold text-foreground" : "text-foreground/90 hover:bg-muted"
                                } disabled:cursor-default disabled:hover:bg-transparent`}
                              >
                                <span className={`truncate ${!c ? "text-muted-foreground italic" : ""}`}>{c?.label ?? "Pick earlier round"}</span>
                                {right && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" aria-label="Correct" />}
                                {wrong && <XCircle className="w-4 h-4 shrink-0 text-rose-500" aria-label="Wrong" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                </section>
              ))}
            </div>
          </div>
        )}

        {locked && (
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
