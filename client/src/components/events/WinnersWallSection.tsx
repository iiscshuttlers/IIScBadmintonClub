import { tournamentLink } from "@/lib/tournamentRoutes";
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
import { computeWinnerLeaderboard } from "@/data/tournamentArchive";
import { useArchivedTournaments } from "@/hooks/useArchivedTournaments";
import { playerService } from "@/services/playerService";

import { motion, AnimatePresence } from "framer-motion";
import { themeColor } from "@/lib/themeColors";

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

    const COLORS = (["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6"] as const).map((t) => themeColor(t));
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

export function WinnersWallSection() {
  const { archivedTournaments, loading } = useArchivedTournaments();
  const [filter, setFilter] = useState<"all" | "open" | "team">("all");
  const [playerMap, setPlayerMap] = useState<Record<string, string>>({});

  useEffect(() => {
    playerService.getActivePlayerNames()
      .then((data) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach(p => {
             const fName = p.full_name.toLowerCase();
             map[fName] = p.id;
             const first = fName.split(" ")[0];
             if (!map[first]) map[first] = p.id;
          });
          map["radhika"] = map["radhika dutt"] || map["radhika"];
          map["kaling"] = map["kaling danggen"] || map["kaling"];
          map["raja"] = map["raja janmejay"] || map["raja"];
          map["shaili"] = map["shailli"] || map["shaili"];
          map["abhisek"] = map["abhishek"];
          map["renu"] = map["renu tewari"] || map["renu"];
          setPlayerMap(map);
        }
      });
  }, []);

  // One player: the name (linked to their profile when we can match it) and a
  // muted affiliation such as "(CES)" after it.
  const renderPlayer = (raw: string) => {
    const affiliation = raw.match(/\(([^)]*)\)/)?.[1]?.trim();
    const name = raw.replace(/\(.*?\)/g, "").trim();
    let lookup = name.toLowerCase();
    if (lookup === "radhika") lookup = "radhika dutt";
    if (lookup === "kaling") lookup = "kaling danggen";
    if (lookup === "raja") lookup = "raja janmejay";
    if (lookup === "shaili") lookup = "shailli";
    if (lookup === "abhisek") lookup = "abhishek";
    if (lookup === "renu") lookup = "renu tewari";
    const foundId = playerMap[lookup] || playerMap[name.split(" ")[0].toLowerCase()];

    return (
      <>
        {foundId ? (
          <Link href={`/player/${foundId}`}>
            <span className="hover:underline cursor-pointer hover:text-primary transition-colors">{name}</span>
          </Link>
        ) : (
          name
        )}
        {affiliation && (
          <span className="ml-1 text-[0.85em] font-medium text-muted-foreground">({affiliation})</span>
        )}
      </>
    );
  };

  // A winner or runner-up side. Pairs stack one partner per line, so a long
  // name never squeezes its partner and the "&" into narrow side-by-side columns.
  const renderSide = (raw: string) => {
    const partners = raw.split(/\s*[&/]\s*/).map((p) => p.trim()).filter(Boolean);
    return (
      <span className="min-w-0 flex flex-col">
        {partners.map((partner, i) => (
          <span key={i}>
            {i > 0 && <span className="font-medium text-muted-foreground">&amp; </span>}
            {renderPlayer(partner)}
          </span>
        ))}
      </span>
    );
  };

  const tournamentsWithResults = archivedTournaments.filter(
    (event) => event.winners || event.podium,
  );

  const filteredTournaments = tournamentsWithResults.filter(
    (t) => filter === "all" || t.type === filter,
  );

  const leaderboard = useMemo(
    () => computeWinnerLeaderboard(archivedTournaments).slice(0, 10),
    [archivedTournaments],
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
    <div className="flex-1 w-full flex flex-col">
      <section className="container mx-auto px-4 py-12 space-y-6">
        {/* Aggregate Stats & Leaderboard Grid */}
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            <div className="bg-card rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-border shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-info/15 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 sm:w-7 sm:h-7 text-info" />
              </div>
              <div>
                <div className="text-xl sm:text-3xl font-black text-foreground leading-none sm:leading-tight">
                  {tournamentsWithResults.length}
                </div>
                <div className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mt-1 sm:mt-0">
                  Events
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-border shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary/40 flex items-center justify-center shrink-0">
                <Medal className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
              </div>
              <div>
                <div className="text-xl sm:text-3xl font-black text-foreground leading-none sm:leading-tight">
                  {totalCategories}
                </div>
                <div className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mt-1 sm:mt-0">
                  Titles
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-border shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-warning/15 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 sm:w-7 sm:h-7 text-warning" />
              </div>
              <div>
                <div className="text-xl sm:text-3xl font-black text-foreground leading-none sm:leading-tight">
                  {leaderboard.length}
                </div>
                <div className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mt-1 sm:mt-0">
                  Champs
                </div>
              </div>
            </div>
          </div>

          {/* Top Leaderboard */}
          <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-black text-foreground">
                Hall of Fame
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {leaderboard.slice(0, 8).map((player, idx) => (
                  <div
                    key={player.name}
                    className="flex flex-col gap-3 p-4 rounded-3xl bg-muted/40 border border-border-strong/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/40 text-primary font-black flex items-center justify-center shrink-0 text-sm">
                          #{idx + 1}
                        </div>
                        <div className="font-bold text-foreground truncate text-base">
                          {renderPlayer(player.name)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gold/15 text-gold font-bold shrink-0 text-xs shadow-sm">
                        <Award className="w-3.5 h-3.5" />
                        {player.wins}
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2 bg-card/60 rounded-2xl p-3 border border-border/60">
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
                          ? "text-gold"
                          : d.medal === "Silver"
                            ? "text-muted-foreground"
                            : "text-secondary";

                        return (
                          <div
                            key={i}
                            className="text-xs leading-snug flex items-start gap-2 min-w-0"
                          >
                            <span className="shrink-0 mt-0.5" title={d.medal}>
                              <MedalIcon className={`w-3.5 h-3.5 ${medalColor}`} />
                            </span>
                            <span className="font-black text-soft shrink-0 w-6">
                              {shortCat}
                            </span>
                            <span className="text-muted-foreground font-medium flex-1">
                              {d.tournament}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-center max-w-6xl mx-auto">
          <div className="bg-card p-1.5 rounded-2xl shadow-sm border border-border flex gap-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === "all" ? "bg-info/20 text-info shadow-md" : "text-muted-foreground hover:bg-muted"}`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilter("open")}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === "open" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"}`}
            >
              Open Tournaments
            </button>
            <button
              onClick={() => setFilter("team")}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === "team" ? "bg-info text-on-accent shadow-md" : "text-muted-foreground hover:bg-muted"}`}
            >
              Team Events
            </button>
          </div>
        </div>

        {filteredTournaments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">
              No results match this filter.
            </p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
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
                  className="rounded-2xl sm:rounded-3xl shadow-sm border border-border-strong/50 bg-muted overflow-hidden"
                >
                  {/* Top accent */}
                  <div
                    className={`h-1.5 bg-gradient-to-r ${
                      event.type === "open"
                        ? "from-primary to-team"
                        : event.type === "team"
                          ? "from-info to-info"
                          : "from-individual to-individual"
                    }`}
                  />

                  <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                              event.type === "open"
                                ? "bg-primary/40 text-primary"
                                : event.type === "team"
                                  ? "bg-info/15 text-info"
                                  : "bg-individual/15 text-individual"
                            }`}
                          >
                            {event.type === "open"
                              ? "Open"
                              : event.type === "team"
                                ? "Team Event"
                                : "Special Event"}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-primary">
                            {event.startDate}
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-2xl font-black text-foreground leading-tight">
                          {event.name}
                        </h2>
                        <p className="text-muted-foreground mt-1.5 max-w-3xl text-xs sm:text-sm leading-snug">
                          {event.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
                        <a
                          href={event.galleryFolder ? `/club?tab=gallery&filter=${encodeURIComponent(event.galleryFolder)}#albums` : `/club?tab=gallery#albums`}
                          className="flex-1 sm:flex-none"
                        >
                          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-muted-strong hover:bg-faint text-soft font-bold text-xs sm:text-sm transition-colors">
                            <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Photos
                          </button>
                        </a>
                        <Link href={tournamentLink(event)} className="flex-1 sm:flex-none">
                          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/40 hover:bg-primary/60 text-primary font-bold text-xs sm:text-sm transition-colors">
                            Results
                            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </Link>
                      </div>
                    </div>

                    {/* Winners */}
                    {event.winners && (
                      <div className="space-y-5 pt-3 border-t border-border-strong/50">
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
                          <div key={group} className="space-y-2">
                            {group !== "Overall" && (
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-4 bg-gradient-to-b from-warning to-secondary rounded-full" />
                                <h3 className="text-sm font-black text-foreground">
                                  {group}
                                </h3>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 sm:gap-3">
                              {results!.map((result) => (
                                <div
                                  key={result.category}
                                  className="flex-1 min-w-[200px] rounded-xl border border-warning/25 bg-warning/5 p-3 hover:shadow-sm transition-shadow"
                                >
                                  <div className="flex items-center gap-1.5 text-[10px] font-black text-gold uppercase tracking-wider mb-1.5">
                                    <Medal className="w-3 h-3" />
                                    {result.category}
                                  </div>
                                  <div className="font-bold text-foreground text-xs sm:text-sm leading-snug flex items-start gap-1.5">
                                    <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 mt-[0.2em] text-gold shrink-0" />
                                    {renderSide(result.winner)}
                                  </div>
                                  {result.runnerUp && (
                                    <div className="mt-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground leading-snug flex items-start gap-1.5">
                                      <Medal className="w-3 h-3 mt-[0.1em] text-muted-foreground shrink-0" />
                                      {renderSide(result.runnerUp)}
                                    </div>
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
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pt-3 border-t border-border-strong/50">
                        {event.podium.map((team, index) => {
                          const rankConfig = [
                            {
                              label: "Gold",
                              icon: Trophy,
                              iconColor: "text-warning",
                              border:
                                "border-warning/60",
                              bg: "bg-warning/5",
                              text: "text-warning",
                            },
                            {
                              label: "Silver",
                              icon: Medal,
                              iconColor: "text-muted-foreground",
                              border: "border-border-strong/60",
                              bg: "bg-muted/40",
                              text: "text-soft",
                            },
                            {
                              label: "Bronze",
                              icon: Award,
                              iconColor: "text-secondary",
                              border:
                                "border-secondary/60",
                              bg: "bg-secondary/5",
                              text: "text-secondary",
                            },
                          ];
                          const rank = rankConfig[index] ?? {
                            label: `#${index + 1}`,
                            icon: undefined as any,
                            iconColor: undefined as string | undefined,
                            border: "border-info/35",
                            bg: "bg-info/5",
                            text: "text-info",
                          };
                          return (
                            <div
                              key={team}
                              className={`rounded-xl border ${rank.border} ${rank.bg} p-2.5 sm:p-4`}
                            >
                              <p
                                className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${rank.text} flex items-center gap-1`}
                              >
                                {rank.icon && <rank.icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${rank.iconColor ?? ""}`} />}
                                {rank.label}
                              </p>
                              <p className="mt-1.5 font-bold text-foreground text-xs sm:text-sm">
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
