import { Link, useRoute, useLocation } from "wouter";
import { useEffect, useState } from "react";
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
import { useArchivedTournaments } from "@/hooks/useArchivedTournaments";
import { motion } from "framer-motion";
import { InfoModal } from "@/components/InfoModal";
import { useQuery } from "@tanstack/react-query";
import { getTournaments } from "@/lib/tournaments";
import { Loader2 } from "lucide-react";
import { TournamentArchiveBrackets } from "@/components/events/TournamentArchiveBrackets";
import { UpNextPanel } from "@/components/tournament/UpNextPanel";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { getEventFamily } from "@/lib/tournamentTheme";
import { TournamentWinnersPanel } from "@/components/tournament/TournamentWinnersPanel";
import { isUuid, tournamentPath } from "@/lib/tournamentRoutes";

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
  const { archivedTournaments, loading: archivedLoading } = useArchivedTournaments();
  let tournament: ArchivedTournament | undefined = getArchivedTournament(slug, archivedTournaments);
  
  const { data: events, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
    enabled: !tournament && !archivedLoading, // Only fetch if not a legacy tournament and after archive loading
  });

  if (!tournament && events) {
    const sb = events.find(e => e.slug === slug || e.id === slug);
    if (sb) {
      tournament = {
        id: sb.id,
        slug: sb.slug,
        status: sb.status,
        type: ((sb as any).tournament_type ?? sb.subtitle) as any,
        format_family: (sb as any).format_family,
        counts_for_elo: (sb as any).counts_for_elo,
        startDate: sb.startDate,
        name: sb.name,
        subtitle: "Official Results",
        description: sb.description || "Tournament completed.",
        winners: sb.winners,
        podium: (sb as any).podium,
      } as any;
    }
  }

  // WP5: every DB tournament (UUID id) lives at its canonical URL across its
  // whole lifecycle; only legacy JSON-archive records stay on /events/:slug.
  // `tournament` is only set from rows RLS let us read, so this never
  // confirms a hidden draft.
  const canonicalRedirect = tournament && isUuid(tournament.id)
    ? tournamentPath(tournament.id)
    : tournament && (tournament.status === "active" || tournament.status === "draft")
      ? "/tournaments"
      : null;

  useEffect(() => {
    if (canonicalRedirect) setLocation(canonicalRedirect, { replace: true });
  }, [canonicalRedirect, setLocation]);

  if (canonicalRedirect || ((isLoading || archivedLoading) && !tournament)) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-5 max-w-md">
          <div className="text-8xl font-black text-background select-none">
            ?
          </div>
          <h1
            className="text-3xl font-black text-foreground font-display"
          >
            Tournament Not Found
          </h1>
          <p className="text-muted-foreground">
            This tournament page doesn't exist or hasn't been archived yet.
          </p>
          <button onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = `${import.meta.env.BASE_URL}pulse`} className="inline-flex items-center gap-2 bg-primary hover:bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5">
              <ArrowLeft className="w-4 h-4" />
              Back to Pulse
            </button>
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
  const family = getEventFamily({ tournament_type: tournament.type as string, format_family: (tournament as any).format_family });
  const heroGradient =
    family === "team"
      ? "from-team/20 via-success to-success"
      : "from-individual/20 via-individual to-info";
  const ranked = (tournament as any).counts_for_elo;

  return (
    <ThemeScope family={family}>
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className={`bg-gradient-to-tr ${heroGradient} text-on-accent py-6 relative overflow-hidden`}>
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/20 border border-gold/30 text-gold text-sm font-bold mb-5">
            <Trophy className="w-4 h-4" />
            {typeLabel}
          </div>
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 text-foreground font-display"
          >
            {tournament.name}
          </h1>
          <p className="text-xl text-success max-w-2xl mx-auto">
            {tournament.subtitle}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-success text-sm">
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
              <BreadcrumbLink href={import.meta.env.BASE_URL}>Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`${import.meta.env.BASE_URL}pulse#events`}>Pulse</BreadcrumbLink>
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
            <Card className="rounded-3xl shadow-md border border-border-strong bg-muted overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-primary via-team to-info" />
              <CardContent className="p-6 sm:p-10 space-y-6">
                {/* Status + description */}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <EventTypeBadge
                      tournament_type={tournament.type as string}
                      format_family={(tournament as any).format_family}
                    />
                    {ranked != null && <RankedBadge ranked={ranked} />}
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted-strong text-soft">
                      ✓ Completed
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-2xl font-black text-foreground">
                      Results Archive
                    </h2>
                    <InfoModal
                      title="TOURNAMENT ARCHIVE"
                      items={[
                        { badge: "HISTORY", title: "Past Results", desc: "This page is a snapshot of the tournament results after it was completed." }
                      ]}
                    />
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {tournament.description}
                  </p>
                </div>

                <TournamentWinnersPanel tournament={tournament} />
              </CardContent>
            </Card>

            {/^[0-9a-f-]{36}$/i.test(tournament.id ?? "") && <UpNextPanel tournamentId={tournament.id} />}

            {tournament.id && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-muted-foreground to-faint rounded-full" />
                  <h2 className="text-2xl font-black text-foreground">
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
            <Card className="rounded-3xl shadow-md border border-border-strong bg-muted overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary to-team" />
              <CardContent className="p-7">
                <h2 className="text-lg font-black text-foreground mb-5">
                  Event Highlights
                </h2>
                {tournament.highlights && tournament.highlights.length > 0 ? (
                  <div className="space-y-3">
                    {tournament.highlights.map((item, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Official category results are archived for club records and
                    future reference.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick info */}
            <Card className="rounded-3xl shadow-md border border-border-strong bg-muted overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-info to-info" />
              <CardContent className="p-7 space-y-4">
                <h2 className="text-lg font-black text-foreground mb-2">
                  Tournament Info
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-border-strong">
                    <span className="text-muted-foreground font-medium">
                      Year
                    </span>
                    <span className="font-bold text-foreground">
                      {tournament.startDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border-strong">
                    <span className="text-muted-foreground font-medium">
                      Format
                    </span>
                    <span className="font-bold text-foreground">
                      {typeLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground font-medium">
                      Status
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Completed
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-3 text-sm mt-4 pt-4 border-t border-border-strong">
                  {tournament.winners && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-border-strong">
                        <span className="text-muted-foreground font-medium">
                          Categories
                        </span>
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-gold" />
                          {tournament.winners.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-border-strong">
                        <span className="text-muted-foreground font-medium">
                          Medalists
                        </span>
                        <span className="font-bold text-foreground flex items-center gap-1.5">
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
                    <div className="flex items-center justify-between py-2 border-b border-border-strong">
                      <span className="text-muted-foreground font-medium">
                        Teams Placed
                      </span>
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        {tournament.podium.length}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 mt-4 pt-4 border-t border-border-strong">
                  <Link
                    href={tournament.galleryFolder ? `/legacy?filter=${encodeURIComponent(tournament.galleryFolder)}#albums` : `/legacy#albums`}
                  >
                    <button className="w-full flex items-center justify-center gap-2 bg-primary/40 hover:bg-primary/60 text-primary font-bold px-4 py-3 rounded-xl text-sm transition-all hover:-translate-y-0.5">
                      <ImageIcon className="w-4 h-4" />
                      View Gallery
                    </button>
                  </Link>
                  <Link href="/legacy#champions">
                    <button className="w-full flex items-center justify-center gap-2 bg-info/20 hover:bg-info text-on-accent font-bold px-4 py-3 rounded-xl text-sm transition-all hover:-translate-y-0.5">
                      <Trophy className="w-4 h-4" />
                      Hall of Fame
                    </button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
    </ThemeScope>
  );
}
