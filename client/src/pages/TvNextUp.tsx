import { useMemo } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Radio, Swords } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { headToHead, recentForm, type HistMatch } from "@/lib/headToHead";
import { usePageMeta } from "@/hooks/usePageMeta";

/**
 * TV "between matches" card for one court: who's on next, their ratings,
 * head-to-head record and recent form. Shows "Now on court" while a match is
 * live. Refreshes every 20 s. /tv/next/:tournamentId?court=1
 */

const LIVE = new Set(["in_progress", "playing", "live", "ongoing"]);
const WAITING = new Set(["scheduled", "pending"]);
const CAT: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles", WD: "Women's Doubles", XD: "Mixed Doubles",
};
const courtName = (c: string) => (/^c?\d+$/i.test(c.trim()) ? `Court ${c.replace(/^c/i, "")}` : c);

interface Row {
  id: string;
  court_number: string | null;
  status: string;
  scheduled_at: string | null;
  round: number | null;
  match_number: number | null;
  round_name: string | null;
  category: string | null;
  team1_label: string | null;
  team2_label: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  score: string | null;
}

const ids = (m: Row, s: 1 | 2) => (s === 1 ? [m.player1_id, m.player3_id] : [m.player2_id, m.player4_id]).filter((x): x is string => !!x);

function Form({ form }: { form: ("W" | "L")[] }) {
  if (!form.length) return <span className="text-slate-500 text-lg">No results yet</span>;
  return (
    <div className="flex gap-1.5 justify-center">
      {form.map((r, i) => (
        <span key={i} className={`w-9 h-9 rounded-lg flex items-center justify-center font-black ${r === "W" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
          {r}
        </span>
      ))}
    </div>
  );
}

export default function TvNextUp() {
  const [, params] = useRoute<{ tournamentId: string }>("/tv/next/:tournamentId");
  const [location, setLocation] = useLocation();
  const tournamentId = params?.tournamentId ?? "";
  const court = new URLSearchParams(window.location.search).get("court") ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["tv-next", tournamentId],
    enabled: !!tournamentId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const [{ data: t }, { data: rows, error }] = await Promise.all([
        supabase.from("tournaments").select("name").eq("id", tournamentId).maybeSingle(),
        supabase
          .from("tournament_matches")
          .select("id, court_number, status, scheduled_at, round, match_number, round_name, category, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, score")
          .eq("tournament_id", tournamentId)
          .not("court_number", "is", null)
          .in("status", [...LIVE, ...WAITING]),
      ]);
      if (error) throw error;
      return { name: (t as any)?.name ?? "", rows: (rows ?? []) as Row[] };
    },
  });

  const courts = useMemo(
    () => Array.from(new Set((data?.rows ?? []).map((r) => r.court_number!.trim()))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [data],
  );
  const activeCourt = court || courts[0] || "";
  const onCourt = (data?.rows ?? []).filter((r) => r.court_number!.trim() === activeCourt);
  const live = onCourt.find((r) => LIVE.has(r.status));
  const next = onCourt
    .filter((r) => WAITING.has(r.status) && r.player1_id && r.player2_id)
    .sort((a, b) => {
      const ta = a.scheduled_at ? Date.parse(a.scheduled_at) : Infinity;
      const tb = b.scheduled_at ? Date.parse(b.scheduled_at) : Infinity;
      return ta - tb || (a.round ?? 0) - (b.round ?? 0) || (a.match_number ?? 0) - (b.match_number ?? 0);
    })[0];

  const { data: info } = useQuery({
    queryKey: ["tv-next-h2h", next?.id],
    enabled: !!next,
    staleTime: 60_000,
    queryFn: async () => {
      const a = ids(next!, 1);
      const b = ids(next!, 2);
      const all = [...a, ...b];
      const or = all.flatMap((id) => [`player1_id.eq.${id}`, `player2_id.eq.${id}`, `player3_id.eq.${id}`, `player4_id.eq.${id}`]).join(",");
      const [{ data: hist }, { data: players }] = await Promise.all([
        supabase
          .from("tournament_matches")
          .select("id, status, winner_side, player1_id, player2_id, player3_id, player4_id, score, ended_at, scheduled_at, tournaments(name)")
          .in("status", ["completed", "walkover"])
          .or(or)
          .limit(500),
        supabase.from("players").select("id, elo_rating").in("id", all),
      ]);
      const h = (hist ?? []) as unknown as HistMatch[];
      const elo = new Map((players ?? []).map((p: any) => [p.id, p.elo_rating as number | null]));
      const rating = (xs: string[]) => {
        const r = xs.map((x) => elo.get(x)).filter((x): x is number => x != null);
        return r.length ? Math.round(r.reduce((s, x) => s + x, 0) / r.length) : null;
      };
      return { h2h: headToHead(h, a, b), formA: recentForm(h, a), formB: recentForm(h, b), ratingA: rating(a), ratingB: rating(b) };
    },
  });

  usePageMeta({ title: `Next up · ${courtName(activeCourt || "Court")}`, description: "Court display" });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-sky-400" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0c4a6e,_#020617_65%)] text-white flex flex-col p-6 sm:p-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/tv">
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white cursor-pointer font-bold">
              <ArrowLeft className="w-4 h-4" /> TV
            </span>
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black">{data?.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2 justify-end" role="tablist" aria-label="Court">
          {courts.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={c === activeCourt}
              onClick={() => setLocation(`${location}?court=${encodeURIComponent(c)}`)}
              className={`px-3 py-1.5 rounded-lg text-sm font-black ${c === activeCourt ? "bg-sky-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}
            >
              {courtName(c)}
            </button>
          ))}
        </div>
      </header>

      {live && (
        <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 flex items-center gap-3 text-lg font-bold">
          <Radio className="w-5 h-5 text-rose-400 animate-pulse" /> Now on court: {live.team1_label} vs {live.team2_label}
        </div>
      )}

      {!next ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Swords className="w-16 h-16 mb-4" />
          <p className="text-2xl font-bold">{courts.length ? `No more matches queued on ${courtName(activeCourt)}` : "No matches on court yet"}</p>
        </div>
      ) : (
        <main className="flex-1 flex flex-col justify-center">
          <p className="text-center text-sky-300 font-black tracking-[0.3em] uppercase text-sm">
            Next on {courtName(activeCourt)}
          </p>
          <p className="text-center text-slate-300 font-bold mt-1">
            {CAT[next.category ?? ""] ?? next.category} · {next.round_name}
            {next.scheduled_at ? ` · ${new Date(next.scheduled_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}
          </p>

          <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-10">
            {([1, 2] as const).map((s) => {
              const label = s === 1 ? next.team1_label : next.team2_label;
              const rating = s === 1 ? info?.ratingA : info?.ratingB;
              const form = s === 1 ? info?.formA : info?.formB;
              const card = (
                <div key={s} className="text-center space-y-3">
                  <div className="text-3xl sm:text-5xl font-black leading-tight break-words">{label}</div>
                  {rating != null && <div className="text-xl text-slate-300 font-bold tabular-nums">Elo {rating}</div>}
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Last 5</div>
                    <Form form={form ?? []} />
                  </div>
                </div>
              );
              return s === 1 ? (
                [
                  card,
                  <div key="h2h" className="text-center">
                    <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Head to head</div>
                    <div className="text-5xl sm:text-7xl font-black tabular-nums">
                      {info ? `${info.h2h.aWins}–${info.h2h.bWins}` : "–"}
                    </div>
                    {info && info.h2h.meetings.length === 0 && <div className="text-slate-400 font-bold">First meeting</div>}
                  </div>,
                ]
              ) : (
                card
              );
            })}
          </div>

          {info && info.h2h.meetings.length > 0 && (
            <ul className="mt-10 max-w-2xl mx-auto w-full space-y-1.5">
              {info.h2h.meetings.slice(0, 3).map((m) => (
                <li key={m.id} className="flex justify-between gap-4 text-slate-300 text-lg">
                  <span className="truncate">
                    {m.aWon ? next.team1_label : next.team2_label} won{m.where ? ` · ${m.where}` : ""}
                  </span>
                  <span className="tabular-nums text-slate-400 shrink-0">{m.score}</span>
                </li>
              ))}
            </ul>
          )}
        </main>
      )}
    </div>
  );
}
