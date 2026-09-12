import { Link } from "wouter";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar, Trophy, Users, Radio, Medal, ArrowRight, Clock, Info, Timer, Award, GraduationCap, Star, Activity, type LucideIcon,
} from "lucide-react";
import { getTournaments, fetchTournamentConfig, DEFAULT_TOURNAMENT_CONFIG, type TournamentConfig } from "@/lib/tournaments";
import { ArchivedTournament, type TournamentStatus } from "@/data/tournamentArchive";
import { useArchivedTournaments } from "@/hooks/useArchivedTournaments";
import { usePageMeta } from "@/hooks/usePageMeta";
import { InfoModal } from "@/components/InfoModal";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor } from '@capacitor/core';
import { supabase } from "@/lib/supabase";
import { motion, type Variants } from "framer-motion";

// New Tab Components
import { LiveTab } from "@/components/pulse/LiveTab";
import { AnnouncementsTab } from "@/components/pulse/AnnouncementsTab";
import { EventsTab } from "@/components/pulse/EventsTab";
import { DirectoryWrapper } from "@/components/players-directory/DirectoryWrapper";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function Pulse() {
  const { isAdmin } = useAuth();
  const { archivedTournaments } = useArchivedTournaments();

  usePageMeta({
    title: "Pulse",
    description: "Live activity, announcements, and tournaments at IISc Badminton Club.",
  });

  const isCapacitorEnv = Capacitor.isNativePlatform();

  const getPulseTab = () => {
    try {
      const hash = window.location.hash.replace("#", "");
      if (hash.startsWith("directory")) return "directory";
      if (hash.startsWith("events")) return "events";
      if (hash.startsWith("feed")) return "feed";
      if (hash.startsWith("live")) return "live";
    } catch { /* ignore */ }
    return "live";
  };

  const [pulseTab, setPulseTabState] = useState<"live" | "feed" | "events" | "directory">(getPulseTab);

  useEffect(() => {
    const onHashChange = () => setPulseTabState(getPulseTab());
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) {
      try { window.history.replaceState(null, "", "#live"); } catch { /* ignore */ }
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setPulseTab = (tab: "live" | "feed" | "events" | "directory") => {
    setPulseTabState(tab);
    try {
      const url = new URL(window.location.href);
      url.search = ""; // clear query string to prevent bleeding
      url.hash = tab;
      window.history.pushState(null, "", url.toString());
    } catch { /* ignore */ }
  };

  type LiveTournament = {
    id: string;
    slug?: string;
    name: string;
    subtitle?: string;
    description?: string;
    startDate: string;
    endDate?: string;
    status: TournamentStatus;
    location?: string;
    type?: string;
    categories?: string[];
  };

  const [events, setEvents] = useState<LiveTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentCfg, setTournamentCfg] = useState<TournamentConfig>(DEFAULT_TOURNAMENT_CONFIG);

  const { data: queryEvents, isLoading: isEventsLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const data = await getTournaments();
      return data.map((e: any) => ({ ...e, status: e.status as TournamentStatus }));
    },
    refetchInterval: (query) => (query.state.error ? false : 60_000),
  });

  useEffect(() => {
    if (queryEvents) {
      setEvents(queryEvents);
      setLoading(false);
    }
  }, [queryEvents]);

  useEffect(() => {
    fetchTournamentConfig().then(setTournamentCfg).catch(() => {});
  }, []);

  const [clubSettings, setClubSettings] = useState<any>({});
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("site_data").select("value").eq("key", "club_settings").maybeSingle();
      if (data?.value) setClubSettings(data.value);
    };
    fetchSettings();
  }, []);

  const live = events.filter((e) => e.status === "active");
  const upcoming = events.filter((e) => e.status === "upcoming" || e.status === "draft");
  const completed = [
    ...archivedTournaments,
    ...events.filter(
      (e) =>
        (e.status === "completed" || e.status === "archived") &&
        !archivedTournaments.some((archived) => archived.slug === e.slug),
    ),
  ].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));

  const getTypeLabel = (type: string) => {
    if (type === "open") return "Open Tournament";
    if (type === "team") return "Team Event";
    if (type === "special") return "Special Event";
    return type;
  };

  const renderCard = (item: any | ArchivedTournament, liveMode = false) => {
    const isUpcoming = item.status === "draft";

    const cardContent = (
      <Card className="rounded-3xl border border-primary/30 dark:border-slate-700 shadow-md bg-white dark:bg-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full overflow-hidden flex flex-col">
        <div
          className={`h-1 w-full shrink-0 ${liveMode ? "bg-gradient-to-r from-red-500 to-orange-500 animate-pulse" : isUpcoming ? "bg-gradient-to-r from-primary to-teal-500" : "bg-gradient-to-r from-slate-300 to-slate-400"}`}
        />
        <CardContent className="p-6 space-y-5 flex-1 flex flex-col">
          <div className="flex flex-wrap items-center gap-3">
            {liveMode ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                item.status === 'draft' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400' :
                item.status === 'completed' || item.status === 'archived' ? 'bg-slate-100 text-muted-foreground dark:bg-slate-800 dark:text-muted-foreground' :
                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
              }`}>
                {item.status === 'draft' ? 'Upcoming' : item.status}
              </span>
            )}

            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                item.type === "open"
                  ? "bg-primary/15 text-primary dark:bg-primary/40 dark:text-primary"
                  : item.type === "team"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                    : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
              }`}
            >
              {getTypeLabel(item.type)}
            </span>

            <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {item.startDate}
            </div>
          </div>

          <h3 className="text-2xl font-black text-blue-900 dark:text-foreground leading-tight">
            {item.name}
          </h3>

          <p className="text-muted-foreground dark:text-muted-foreground line-clamp-3">
            {item.description}
          </p>
          
          <div className="flex-1" />

          <div className="flex items-center gap-2 pt-1 font-bold text-primary dark:text-primary text-sm">
            {isUpcoming
              ? "View details"
              : item.status === "active"
                ? "View live fixtures"
                : "View results"}
            <ArrowRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    );

    const cardLink = isUpcoming 
      ? `/pulse#events` 
      : liveMode 
        ? `/pulse#live` 
        : `/events/${item.slug || item.id}`;

    if (isUpcoming || liveMode) {
      return (
        <a 
          href={cardLink} 
          key={item.id}
          className="block h-full group focus:outline-none focus:ring-4 focus:ring-primary/20 rounded-3xl transition-all"
        >
          {cardContent}
        </a>
      );
    }

    return (
      <Link 
        href={cardLink} 
        key={item.id}
        className="block h-full group focus:outline-none focus:ring-4 focus:ring-primary/20 rounded-3xl transition-all"
      >
        {cardContent}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
      <section className="bg-gradient-to-tr from-teal-800 via-emerald-700 to-lime-600 text-on-accent py-6 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <Activity className="w-3.5 h-3.5 text-lime-300" />
            Pulse
            <InfoModal
              title="PULSE"
              items={[
                { badge: "LIVE", title: "Live Matches", desc: "View real-time scores and matches in progress." },
                { badge: "EVENTS", title: "Tournaments", desc: "Browse upcoming and past tournaments." }
              ]}
              triggerClassName="text-white hover:text-lime-200"
            />
          </div>
          <h1
            className="text-3xl md:text-4xl font-black mb-2 text-white"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Action & Updates
          </h1>
          <p className="text-sm md:text-base text-emerald-50 max-w-3xl mx-auto">
            Live matches, upcoming tournaments, and club announcements.
          </p>

          <div className="mt-6 w-full flex justify-center mb-2 px-2">
            <div className="flex w-full sm:w-auto bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/20 gap-1 flex-wrap justify-center">
              <button
                onClick={() => setPulseTab("live")}
                className={`flex-auto sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  pulseTab === "live"
                    ? "bg-white text-blue-900 shadow-sm scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Live
              </button>
              <button
                onClick={() => setPulseTab("feed")}
                className={`flex-auto sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  pulseTab === "feed"
                    ? "bg-white text-blue-900 shadow-sm scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Radio className="w-3.5 h-3.5" /> Feed
              </button>
              <button
                onClick={() => setPulseTab("events")}
                className={`flex-auto sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  pulseTab === "events"
                    ? "bg-white text-blue-900 shadow-sm scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" /> Events
              </button>
              <button
                onClick={() => setPulseTab("directory")}
                className={`flex-auto sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  pulseTab === "directory"
                    ? "bg-white text-blue-900 shadow-sm scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Directory
              </button>
            </div>
          </div>
        </div>
      </section>

      {pulseTab === "live" && <LiveTab />}
      {pulseTab === "feed" && <AnnouncementsTab />}
      {pulseTab === "events" && (
        <EventsTab 
          liveEvents={live} 
          upcomingEvents={upcoming} 
          completedEvents={completed} 
          renderCard={renderCard} 
        />
      )}
      {pulseTab === "directory" && (
        clubSettings?.showPlayerDirectory || isAdmin ? (
          <DirectoryWrapper />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center mt-8">
            <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <Users className="w-12 h-12 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-foreground mb-4">Feature Disabled</h2>
            <p className="text-lg text-muted-foreground max-w-md">
              The player directory is currently hidden by the club administrators.
            </p>
          </div>
        )
      )}
    </div>
  );
}
