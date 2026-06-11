import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Medal,
  Trophy,
  Users,
  Image as ImageIcon,
  Award,
  BarChart3,
} from "lucide-react";
import {
  ARCHIVED_TOURNAMENTS,
  computeWinnerLeaderboard,
} from "@/data/tournamentArchive";
import { usePageMeta } from "@/hooks/usePageMeta";
import { motion, AnimatePresence } from "framer-motion";

const cardVariant = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

// ── Lightweight canvas confetti ──────────────────────────────────────────────
function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Respect reduced-motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#10b981", "#ff6b35", "#f59e0b", "#3b82f6", "#a855f7", "#f43f5e"];
    const particles: {
      x: number; y: number; vx: number; vy: number;
      color: string; size: number; rotation: number; vr: number; alpha: number;
    }[] = [];

    for (let i = 0; i < 120; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 2 + Math.random() * 6;
      particles.push({
        x: canvas.width / 2,
        y: canvas.height * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 5 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        alpha: 1,
      });
    }

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.rotation += p.vr;
        p.alpha = Math.max(0, p.alpha - 0.012);
        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        }
      }
      if (alive) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
      aria-hidden="true"
    />
  );
}

export default function WinnersWall() {
  usePageMeta({
    title: "Winners Wall",
    description:
      "Champions and podium finishers from all IISc Badminton Club tournaments and events.",
  });
  const [filter, setFilter] = useState<"all" | "open" | "team">("all");

  const tournamentsWithResults = ARCHIVED_TOURNAMENTS.filter(
    (event) => event.winners || event.podium,
  );

  const filteredTournaments = tournamentsWithResults.filter(
    (t) => filter === "all" || t.type === filter,
  );

  const leaderboard = useMemo(
    () => computeWinnerLeaderboard().slice(0, 10),
    [],
  );

  const totalCategories = useMemo(
    () =>
      tournamentsWithResults.reduce(
        (sum, t) => sum + (t.winners?.length || 0),
        0,
      ),
    [],
  );

  return (
    <div className="flex-1 w-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Confetti burst on page load */}
      <ConfettiBurst />
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-sm font-bold mb-5">
            <Trophy className="w-4 h-4" />
            Club Records
          </div>
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-black mb-5"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Winners Wall
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Champions, podiums and archived results from IISc Badminton Club
            events.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 space-y-12">
        {/* Aggregate Stats & Leaderboard Grid */}
        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Stats Bar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-3xl font-black text-blue-950 dark:text-white">
                  {tournamentsWithResults.length}
                </div>
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Archived Events
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                <Medal className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-3xl font-black text-blue-950 dark:text-white">
                  {totalCategories}
                </div>
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Title Categories
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-3xl font-black text-blue-950 dark:text-white">
                  {leaderboard.length}
                </div>
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Total Champions
                </div>
              </div>
            </div>
          </div>

          {/* Top Leaderboard */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-emerald-500" />
              <h2 className="text-xl font-black text-blue-950 dark:text-white">
                Hall of Fame
              </h2>
            </div>
            <div className="p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                {leaderboard.slice(0, 8).map((player, idx) => (
                  <div
                    key={player.name}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-black flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {player.name}
                      </div>
                      <div className="flex flex-col mt-1 space-y-0.5">
                        {player.details.map((d, i) => {
                          const lower = d.category.toLowerCase();
                          let shortCat = d.category;
                          if (lower.includes("mixed")) shortCat = "XD";
                          else if (
                            lower.includes("women's singles") ||
                            lower.includes("womens singles")
                          )
                            shortCat = "WS";
                          else if (
                            lower.includes("women's doubles") ||
                            lower.includes("womens doubles")
                          )
                            shortCat = "WD";
                          else if (
                            lower.includes("men's singles") ||
                            lower.includes("mens singles")
                          )
                            shortCat = "MS";
                          else if (
                            lower.includes("men's doubles") ||
                            lower.includes("mens doubles")
                          )
                            shortCat = "MD";

                          const MedalIcon = d.medal === "Gold"
                              ? Trophy
                              : d.medal === "Silver"
                                ? Medal
                                : Award;
                          const medalColor = d.medal === "Gold"
                            ? "text-amber-500"
                            : d.medal === "Silver"
                              ? "text-slate-400"
                              : "text-orange-400";

                          return (
                            <div
                              key={i}
                              className="text-[11px] leading-tight flex items-start gap-1.5 min-w-0"
                            >
                              <span className="shrink-0" title={d.medal}>
                                <MedalIcon className={`w-3 h-3 ${medalColor}`} />
                              </span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0 w-5">
                                {shortCat}
                              </span>
                              <span className="text-slate-500">
                                {d.tournament}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold shrink-0">
                      <Award className="w-4 h-4" />
                      {player.wins}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-center max-w-6xl mx-auto">
          <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex gap-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === "all" ? "bg-blue-900 text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilter("open")}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === "open" ? "bg-emerald-600 text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              Open Tournaments
            </button>
            <button
              onClick={() => setFilter("team")}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === "team" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              Team Events
            </button>
          </div>
        </div>

        {filteredTournaments.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-slate-500">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">
              No results match this filter.
            </p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8">
            <AnimatePresence mode="popLayout">
              {filteredTournaments.map((event, idx) => (
                <motion.div
                  key={event.id}
                  layout
                  custom={idx}
                  variants={cardVariant}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.95 }}
                  viewport={{ once: true, margin: "-60px" }}
                  className="rounded-3xl shadow-md border border-emerald-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
                >
                  {/* Top accent */}
                  <div
                    className={`h-1.5 bg-gradient-to-r ${
                      event.type === "open"
                        ? "from-emerald-500 to-teal-600"
                        : event.type === "team"
                          ? "from-blue-500 to-indigo-600"
                          : "from-purple-500 to-pink-600"
                    }`}
                  />

                  <div className="p-8 sm:p-10 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              event.type === "open"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : event.type === "team"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                  : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                            }`}
                          >
                            {event.type === "open"
                              ? "Open Tournament"
                              : event.type === "team"
                                ? "Team Event"
                                : "Special Event"}
                          </span>
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-500">
                            {event.startDate}
                          </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-white">
                          {event.name}
                        </h2>
                        <p className="text-gray-600 dark:text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
                          {event.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {event.galleryFolder && (
                          <Link
                            href={`/gallery?filter=${encodeURIComponent(event.galleryFolder)}`}
                          >
                            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm transition-colors">
                              <ImageIcon className="w-4 h-4" />
                              Photos
                            </button>
                          </Link>
                        )}
                        <Link href={`/events/${event.slug}`}>
                          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-bold text-sm transition-colors">
                            Results Details
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </Link>
                      </div>
                    </div>

                    {/* Winners */}
                    {event.winners && (
                      <div className="space-y-7 pt-4 border-t border-slate-100 dark:border-slate-700">
                        {Object.entries(
                          event.winners.reduce(
                            (acc, curr) => {
                              const [group, ...rest] = curr.category.includes(
                                ":",
                              )
                                ? curr.category.split(":")
                                : ["Overall", curr.category];
                              const catName =
                                rest.length > 0
                                  ? rest.join(":").trim()
                                  : curr.category;
                              if (!acc[group]) acc[group] = [];
                              acc[group].push({ ...curr, category: catName });
                              return acc;
                            },
                            {} as Record<string, typeof event.winners>,
                          ),
                        ).map(([group, results]) => (
                          <div key={group} className="space-y-3">
                            {group !== "Overall" && (
                              <div className="flex items-center gap-3">
                                <div className="w-1.5 h-5 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
                                <h3 className="text-base font-black text-blue-900 dark:text-white">
                                  {group}
                                </h3>
                              </div>
                            )}
                            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {results!.map((result) => (
                                <div
                                  key={result.category}
                                  className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/15 p-4 hover:shadow-sm transition-shadow"
                                >
                                  <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                                    <Medal className="w-3.5 h-3.5" />
                                    {result.category}
                                  </div>
                                  <p className="font-bold text-blue-950 dark:text-white text-sm flex items-center gap-1">
                                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {result.winner}
                                  </p>
                                  {result.runnerUp && (
                                    <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                      <Medal className="w-3 h-3 text-slate-400 shrink-0" /> {result.runnerUp}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Podium */}
                    {event.podium && (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                        {event.podium.map((team, index) => {
                          const rankConfig = [
                            {
                              label: "Gold",
                              icon: Trophy,
                              iconColor: "text-amber-500",
                              border:
                                "border-amber-300 dark:border-amber-700/60",
                              bg: "bg-amber-50 dark:bg-amber-950/20",
                              text: "text-amber-700 dark:text-amber-400",
                            },
                            {
                              label: "Silver",
                              icon: Medal,
                              iconColor: "text-slate-400",
                              border: "border-slate-300 dark:border-slate-600",
                              bg: "bg-slate-50 dark:bg-slate-800",
                              text: "text-slate-600 dark:text-slate-300",
                            },
                            {
                              label: "Bronze",
                              icon: Award,
                              iconColor: "text-orange-400",
                              border:
                                "border-orange-300 dark:border-orange-700/60",
                              bg: "bg-orange-50 dark:bg-orange-950/20",
                              text: "text-orange-700 dark:text-orange-400",
                            },
                          ];
                          const rank = rankConfig[index] ?? {
                            label: `#${index + 1}`,
                            icon: undefined as any,
                            iconColor: undefined as string | undefined,
                            border: "border-blue-200 dark:border-blue-800",
                            bg: "bg-blue-50 dark:bg-blue-950/20",
                            text: "text-blue-700 dark:text-blue-400",
                          };
                          return (
                            <div
                              key={team}
                              className={`rounded-2xl border ${rank.border} ${rank.bg} p-4`}
                            >
                              <p
                                className={`text-xs font-black uppercase tracking-wider ${rank.text} flex items-center gap-1`}
                              >
                                {rank.icon && <rank.icon className={`w-3.5 h-3.5 ${rank.iconColor ?? ""}`} />}
                                {rank.label}
                              </p>
                              <p className="mt-2 font-bold text-blue-950 dark:text-white text-sm">
                                {team}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
