import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Pause, Play, RotateCcw, Shuffle, Maximize2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { buildDraw, type DrawMatch } from "@/lib/drawReveal";
import { usePageMeta } from "@/hooks/usePageMeta";

/**
 * TV draw ceremony: reveals each category's first-round draw one pairing at a
 * time on a projector. Keyboard: → / Space next, ← back, A auto-play,
 * R restart category, ↑/↓ switch category, F fullscreen.
 * /tv/draw lists tournaments; /tv/draw/:tournamentId runs the ceremony.
 */

const CAT_LABELS: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles",
  WD: "Women's Doubles", XD: "Mixed Doubles", BS: "Boys' Singles",
  GS: "Girls' Singles", BD: "Boys' Doubles", GD: "Girls' Doubles",
};
const AUTO_MS = 3500;

function TournamentPicker() {
  const { data, isLoading } = useQuery({
    queryKey: ["tv-draw-tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, start_date, format_family")
        .in("status", ["draft", "active", "upcoming", "live"])
        .order("start_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).filter((t: any) => t.format_family !== "TEAM");
    },
  });
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <Link href="/tv">
        <span className="inline-flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer text-sm font-bold">
          <ArrowLeft className="w-4 h-4" /> TV home
        </span>
      </Link>
      <div className="max-w-2xl mx-auto mt-10 text-center">
        <Shuffle className="w-12 h-12 mx-auto text-amber-400" />
        <h1 className="mt-4 text-4xl font-black">Draw Ceremony</h1>
        <p className="mt-2 text-slate-400">Pick a tournament to reveal its draw on the big screen.</p>
        <div className="mt-8 space-y-3 text-left">
          {isLoading && <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-500" />}
          {!isLoading && (data?.length ?? 0) === 0 && (
            <p className="text-center text-slate-500">No upcoming or active tournaments with a draw.</p>
          )}
          {data?.map((t: any) => (
            <Link key={t.id} href={`/tv/draw/${t.id}`}>
              <div className="cursor-pointer rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-amber-500/60 transition-colors">
                <div className="text-lg font-black">{t.name}</div>
                <div className="text-sm text-slate-400 capitalize">
                  {t.status}
                  {t.start_date ? ` · ${new Date(t.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Ceremony({ tournamentId }: { tournamentId: string }) {
  const reduceMotion = useReducedMotion();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tv-draw", tournamentId],
    queryFn: async () => {
      const [t, m] = await Promise.all([
        supabase.from("tournaments").select("id, name").eq("id", tournamentId).maybeSingle(),
        supabase
          .from("tournament_matches")
          .select("id, category, round, round_name, match_number, team1_label, team2_label, tie_id")
          .eq("tournament_id", tournamentId),
      ]);
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      return { name: (t.data as any)?.name ?? "Tournament", draws: buildDraw((m.data ?? []) as DrawMatch[]) };
    },
  });

  const draws = data?.draws ?? [];
  const [catIdx, setCatIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [auto, setAuto] = useState(false);
  const current = draws[catIdx];
  const total = current?.pairs.length ?? 0;

  usePageMeta({ title: data ? `Draw · ${data.name}` : "Draw Ceremony", description: "Live draw ceremony" });

  const next = useCallback(() => {
    if (!current) return;
    if (revealed < total) setRevealed((r) => r + 1);
    else if (catIdx < draws.length - 1) {
      setCatIdx((i) => i + 1);
      setRevealed(0);
    } else setAuto(false);
  }, [current, revealed, total, catIdx, draws.length]);

  const prev = useCallback(() => setRevealed((r) => Math.max(0, r - 1)), []);
  const switchCat = useCallback(
    (d: number) => {
      setCatIdx((i) => Math.min(Math.max(0, i + d), Math.max(0, draws.length - 1)));
      setRevealed(0);
    },
    [draws.length],
  );

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(next, revealed === total ? AUTO_MS * 1.5 : AUTO_MS);
    return () => clearTimeout(t);
  }, [auto, next, revealed, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowDown") switchCat(1);
      else if (e.key === "ArrowUp") switchCat(-1);
      else if (e.key.toLowerCase() === "a") setAuto((a) => !a);
      else if (e.key.toLowerCase() === "r") setRevealed(0);
      else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, switchCat]);

  const cols = useMemo(() => (total > 16 ? "lg:grid-cols-3" : total > 6 ? "lg:grid-cols-2" : "lg:grid-cols-1"), [total]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400" aria-label="Loading draw" />
      </div>
    );
  }
  if (error || !current) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-2xl font-bold">{error ? "Couldn't load the draw." : "This tournament has no draw yet."}</p>
        <p className="text-slate-500">Generate the bracket in Tournament Manager first.</p>
        <Link href="/tv/draw">
          <span className="text-amber-400 font-bold cursor-pointer">← Choose another tournament</span>
        </Link>
      </div>
    );
  }

  const spring = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 22 };

  return (
    <div
      className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1e293b,_#020617_70%)] text-white flex flex-col"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,a")) return;
        next();
      }}
    >
      <header className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-amber-400 font-black tracking-[0.3em] text-xs sm:text-sm uppercase">Official Draw</p>
          <h1 className="text-2xl sm:text-4xl font-black">{data!.name}</h1>
        </div>
        <div className="text-right">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.category}
              initial={reduceMotion ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 10 }}
            >
              <div className="text-3xl sm:text-5xl font-black text-amber-300">{CAT_LABELS[current.category] ?? current.category}</div>
              <div className="text-slate-400 font-bold">
                {current.roundName} · {revealed}/{total} drawn
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </header>

      <main className={`flex-1 px-6 pb-24 grid gap-3 content-start grid-cols-1 md:grid-cols-2 ${cols}`} aria-live="polite">
        {current.pairs.slice(0, revealed).map((p, i) => {
          const latest = i === revealed - 1;
          return (
            <motion.div
              key={p.id}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.6, rotateX: 90 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              transition={spring}
              className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${
                latest ? "border-amber-400 bg-amber-400/10 shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)]" : "border-slate-700 bg-slate-900/70"
              }`}
            >
              <span className="w-9 h-9 shrink-0 rounded-full bg-slate-800 flex items-center justify-center font-black text-amber-300 tabular-nums">
                {p.slot}
              </span>
              <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-base sm:text-xl font-black">
                <span className="truncate text-right">{p.side1}</span>
                <span className="text-slate-500 text-sm font-bold">vs</span>
                <span className={`truncate ${p.isBye ? "text-slate-500 italic" : ""}`}>{p.side2}</span>
              </div>
            </motion.div>
          );
        })}
        {revealed === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-slate-500">
            <Shuffle className="w-16 h-16 mb-4" />
            <p className="text-xl font-bold">Press → or tap to draw the first pairing</p>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 px-4 py-3 bg-slate-950/80 backdrop-blur border-t border-slate-800 flex items-center justify-between gap-2 text-sm">
        <Link href="/tv/draw">
          <span className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white cursor-pointer font-bold">
            <ArrowLeft className="w-4 h-4" /> Exit
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => switchCat(-1)} disabled={catIdx === 0} className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-30" aria-label="Previous category">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-2 font-bold text-slate-300 tabular-nums">
            {catIdx + 1}/{draws.length}
          </span>
          <button type="button" onClick={() => switchCat(1)} disabled={catIdx >= draws.length - 1} className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-30" aria-label="Next category">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => setRevealed(0)} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Restart category">
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setAuto((a) => !a)}
            className={`ml-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold ${auto ? "bg-amber-400 text-slate-950" : "bg-slate-800 hover:bg-slate-700"}`}
            aria-pressed={auto}
          >
            {auto ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} Auto
          </button>
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => {}))}
            className="p-2 rounded-lg hover:bg-slate-800 hidden sm:inline-flex"
            aria-label="Toggle fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
        <button type="button" onClick={next} className="px-4 py-2 rounded-lg bg-white text-slate-950 font-black">
          Next →
        </button>
      </footer>
    </div>
  );
}

export default function TvDrawReveal() {
  const [matched, params] = useRoute<{ tournamentId: string }>("/tv/draw/:tournamentId");
  return matched && params?.tournamentId ? <Ceremony tournamentId={params.tournamentId} /> : <TournamentPicker />;
}
