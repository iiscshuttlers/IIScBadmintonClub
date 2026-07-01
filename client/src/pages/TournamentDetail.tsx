import { Link, useRoute, useLocation } from "wouter";
import { useEffect } from "react";
import {
  ArrowLeft,
  Medal,
  Trophy,
  Calendar,
  CheckCircle,
  Image as ImageIcon,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getArchivedTournament, ArchivedTournament } from "@/data/tournamentArchive";
import { motion } from "framer-motion";
import { InfoModal } from "@/components/InfoModal";
import { useQuery } from "@tanstack/react-query";
import { getTournaments } from "@/lib/tournaments";
import { Loader2 } from "lucide-react";
import { TournamentArchiveBrackets } from "@/components/events/TournamentSection";

const PODIUM_CONFIGS = [
  {
    label: "🥇 Champion",
    border: "border-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-400",
  },
  {
    label: "🥈 Runner-up",
    border: "border-slate-300",
    bg: "bg-slate-50 dark:bg-slate-800",
    text: "text-muted-foreground dark:text-slate-300",
    ring: "ring-slate-400",
  },
  {
    label: "🥉 Third Place",
    border: "border-orange-300",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-400",
    ring: "ring-orange-400",
  },
  {
    label: "Fourth Place",
    border: "border-blue-200",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-400 dark:text-blue-400",
    ring: "",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

export default function TournamentDetail() {
  const [, routeParams] = useRoute("/events/:slug");
  const [, setLocation] = useLocation();
  const params = routeParams ?? { slug: "" };
  const slug = params.slug;
  let tournament: ArchivedTournament | undefined = getArchivedTournament(slug);
  
  const { data: events, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
    enabled: !tournament, // Only fetch if not a legacy tournament
  });

  useEffect(() => {
    if (tournament && (tournament.status === "active" || tournament.status === "draft")) {
      setLocation(`/events?t=${tournament.status}#tournament`);
    }
  }, [tournament?.id, tournament?.status, setLocation]);

  if (!tournament && events) {
    const sb = events.find(e => e.slug === slug || e.id === slug);
    if (sb) {
      tournament = {
        id: sb.id,
        slug: sb.slug,
        status: sb.status,
        type: sb.subtitle as any,
        startDate: sb.startDate,
        name: sb.name,
        subtitle: "Official Results",
        description: sb.description || "Tournament completed.",
        winners: sb.winners,
        podium: (sb as any).podium,
      } as any;
    }
  }

  if (isLoading && !tournament) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center space-y-5 max-w-md">
          <div className="text-8xl font-black text-slate-200 dark:text-slate-800 select-none">
            ?
          </div>
          <h1
            className="text-3xl font-black text-blue-900 dark:text-foreground"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Tournament Not Found
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            This tournament page doesn't exist or hasn't been archived yet.
          </p>
          <Link href="/events">
            <button className="inline-flex items-center gap-2 bg-primary hover:bg-primary text-foreground font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5">
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const typeLabel =
    tournament.type === "open"
      ? "Open Tournament"
      : tournament.type === "team"
        ? "Team Event"
        : "Special Event";
  const typeColor =
    tournament.type === "open"
      ? "bg-primary/15 text-primary dark:bg-primary/40 dark:text-primary"
      : tournament.type === "team"
        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
        : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-primary/90 text-foreground py-16 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-sm font-bold mb-5">
            <Trophy className="w-4 h-4" />
            {typeLabel}
          </div>
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-black mb-4"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            {tournament.name}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            {tournament.subtitle}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-gray-400 text-sm">
            <Calendar className="w-4 h-4" />
            {tournament.startDate}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 max-w-6xl space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/events?t=completed#tournament">Events</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{tournament.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid lg:grid-cols-[1.5fr_0.7fr] gap-6 items-start">
          {/* Main results card */}
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <Card className="rounded-3xl shadow-md border border-primary/30 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-primary via-teal-500 to-blue-600" />
              <CardContent className="p-6 sm:p-10 space-y-6">
                {/* Status + description */}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${typeColor}`}
                    >
                      {typeLabel}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-muted-foreground dark:bg-slate-700 dark:text-slate-300">
                      ✓ Completed
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-2xl font-black text-blue-900 dark:text-foreground">
                      Results Archive
                    </h2>
                    <InfoModal
                      title="TOURNAMENT ARCHIVE"
                      items={[
                        { badge: "HISTORY", title: "Past Results", desc: "This page is a snapshot of the tournament results after it was completed." }
                      ]}
                    />
                  </div>
                  <p className="text-muted-foreground dark:text-muted-foreground leading-relaxed">
                    {tournament.description}
                  </p>
                </div>

                {/* Winners grid */}
                {tournament.winners && (
                  <div className="space-y-6">
                    {Object.entries(
                      tournament.winners.reduce(
                        (acc, curr) => {
                          const [group, ...rest] = curr.category.includes(":")
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
                        {} as Record<string, typeof tournament.winners>,
                      ),
                    ).map(([group, results]) => (
                      <div key={group} className="space-y-4">
                        {group !== "Overall" && (
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
                            <h3 className="text-lg font-black text-blue-900 dark:text-foreground">
                              {group}
                            </h3>
                          </div>
                        )}
                        <div className="grid md:grid-cols-2 gap-4">
                          {results!.map((result) => (
                            <div
                              key={result.category}
                              className="rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 p-5 shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-wider mb-3">
                                <Medal className="w-3.5 h-3.5" />
                                {result.category}
                              </div>
                              <p className="font-bold text-blue-950 dark:text-foreground flex items-center gap-2">
                                🥇 {result.winner}
                              </p>
                              {result.runnerUp && (
                                <p className="mt-1.5 text-sm font-semibold text-muted-foreground dark:text-muted-foreground flex items-center gap-2">
                                  🥈 {result.runnerUp}
                                </p>
                              )}
                              {result.bronze && (
                                <p className="mt-1 text-sm font-semibold text-muted-foreground dark:text-muted-foreground flex items-center gap-2">
                                  🥉 {result.bronze.join(" / ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Podium grid */}
                {tournament.podium && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
                      <h3 className="text-lg font-black text-blue-900 dark:text-foreground">
                        Final Standings
                      </h3>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {tournament.podium.map((team, index) => {
                        const cfg = PODIUM_CONFIGS[index] ?? PODIUM_CONFIGS[3];
                        return (
                          <div
                            key={team}
                            className={`rounded-2xl border ${cfg.border} ${cfg.bg} px-5 py-4 hover:shadow-sm transition-shadow`}
                          >
                            <p
                              className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}
                            >
                              {cfg.label}
                            </p>
                            <p className="mt-2 text-lg font-bold text-blue-950 dark:text-foreground">
                              {team}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {tournament.id && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-slate-400 to-slate-600 rounded-full" />
                  <h2 className="text-2xl font-black text-blue-900 dark:text-foreground">
                    Past Brackets & Results
                  </h2>
                </div>
                <TournamentArchiveBrackets tournamentId={tournament.id} />
              </div>
            )}
          </motion.div>

          {/* Sidebar */}
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Highlights */}
            <Card className="rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary to-teal-600" />
              <CardContent className="p-7">
                <h2 className="text-lg font-black text-blue-900 dark:text-foreground mb-5">
                  Event Highlights
                </h2>
                {tournament.highlights && tournament.highlights.length > 0 ? (
                  <div className="space-y-3">
                    {tournament.highlights.map((item, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed">
                    Official category results are archived for club records and
                    future reference.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick info */}
            <Card className="rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
              <CardContent className="p-7 space-y-4">
                <h2 className="text-lg font-black text-blue-900 dark:text-foreground mb-2">
                  Tournament Info
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-muted-foreground dark:text-muted-foreground font-medium">
                      Year
                    </span>
                    <span className="font-bold text-blue-900 dark:text-foreground">
                      {tournament.startDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-muted-foreground dark:text-muted-foreground font-medium">
                      Format
                    </span>
                    <span className="font-bold text-blue-900 dark:text-foreground">
                      {typeLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground dark:text-muted-foreground font-medium">
                      Status
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-primary dark:text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Completed
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-3 text-sm mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  {tournament.winners && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-muted-foreground dark:text-muted-foreground font-medium">
                          Categories
                        </span>
                        <span className="font-bold text-blue-900 dark:text-foreground flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                          {tournament.winners.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-muted-foreground dark:text-muted-foreground font-medium">
                          Medalists
                        </span>
                        <span className="font-bold text-blue-900 dark:text-foreground flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          {tournament.winners.reduce(
                            (sum, w) =>
                              sum +
                              1 +
                              (w.runnerUp ? 1 : 0) +
                              (w.bronze ? w.bronze.length : 0),
                            0,
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  {tournament.podium && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground dark:text-muted-foreground font-medium">
                        Teams Placed
                      </span>
                      <span className="font-bold text-blue-900 dark:text-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        {tournament.podium.length}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  {tournament.galleryFolder && (
                    <Link
                      href={`/gallery?filter=${encodeURIComponent(tournament.galleryFolder)}`}
                    >
                      <button className="w-full flex items-center justify-center gap-2 bg-primary/15 hover:bg-primary/20 dark:bg-primary/40 dark:hover:bg-primary/80/60 text-primary dark:text-primary font-bold px-4 py-3 rounded-xl text-sm transition-all hover:-translate-y-0.5">
                        <ImageIcon className="w-4 h-4" />
                        View Gallery
                      </button>
                    </Link>
                  )}
                  <Link href="/hall-of-fame">
                    <button className="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 dark:bg-blue-800 dark:hover:bg-blue-700 text-foreground font-bold px-4 py-3 rounded-xl text-sm transition-all hover:-translate-y-0.5">
                      <Trophy className="w-4 h-4" />
                      Club Hall of Fame
                    </button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
