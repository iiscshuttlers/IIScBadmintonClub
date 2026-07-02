import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Users,
  UserCheck,
  FileText,
  Upload,
  X,
  Loader2,
  Download,
  AlertCircle,
  Clock,
  ArrowRight,
  Radio,
  LayoutList,
  Tv2,
  Archive,
  ChevronDown,
  ChevronUp,
  Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";
import { useAuth } from "@/contexts/AuthContext";
import { LiveScoreSection } from "@/components/events/LiveScoreSection";
import { LiveBracketsSection } from "@/components/events/LiveBracketsSection";
import { LivePlayersSection } from "@/components/events/LivePlayersSection";
import { UmpireTab } from "@/components/umpire/UmpireTab";
import { useHashTab } from "@/hooks/useHashTab";
import { BracketVisual } from "@/components/tournament/BracketVisual";
import { MatchScoreDisplay } from "@/components/tournament/MatchScoreDisplay";
import {
  fetchTournamentConfig,
  tournamentDatesDisplay,
  DEFAULT_TOURNAMENT_CONFIG,
  type TournamentConfig,
} from "@/lib/tournaments";

const NOTICES_BUCKET = "tournament_notices";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

interface SupabaseTournament {
  id: string;
  name: string;
  tournament_type: string;
  categories: string[];
  status: string;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  description: string | null;
  eligibility: string | null;
  form_url: string | null;
  form_status: string;
  archived_at: string | null;
  slug?: string;
}

interface PastMatch {
  id: string;
  category: string;
  match_code: string;
  round: number;
  round_name: string;
  match_number: number;
  team1_label: string | null;
  team2_label: string | null;
  winner_side: 1 | 2 | null;
  score: string | null;
  sets_history: string[] | null;
  status: string;
  scheduled_at?: string | null;
  court_number?: string | null;
}
export interface TournamentSectionProps {
  liveEvents?: any[];
  upcomingEvents?: any[];
  completedEvents?: any[];
  renderCard?: (item: any, liveMode?: boolean) => React.ReactNode;
}

export function TournamentSection({ liveEvents, upcomingEvents, completedEvents, renderCard }: TournamentSectionProps) {
  const { session, isUmpire } = useAuth();
  const [isAdmin, setIsAdmin] = useState(isAdminEmail(session?.user?.email));
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_TOURNAMENT_CONFIG);
  
  const searchParams = new URLSearchParams(window.location.search);
  const [viewStatus, setViewStatus] = useState<string>(searchParams.get("t") || "active");
  const [activeTid, setActiveTid] = useState<string | null>(searchParams.get("tid"));
  const [allTournaments, setAllTournaments] = useState<SupabaseTournament[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useHashTab(
    ["notices", "players", "schedule", "broadcast", "brackets", "past", "umpire"] as const,
    "notices",
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("t", viewStatus);
    if (activeTid) url.searchParams.set("tid", activeTid);
    else url.searchParams.delete("tid");
    window.history.replaceState({}, "", url.toString());
  }, [viewStatus, activeTid]);

  useEffect(() => {
    const onOpenUmpire = () => setActiveTab("umpire" as any);
    window.addEventListener("openUmpireTab", onOpenUmpire);
    return () => window.removeEventListener("openUmpireTab", onOpenUmpire);
  }, [setActiveTab]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("players")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data && (data.role === "admin" || data.role === "master_admin")) {
              setIsAdmin(true);
            }
          });
      }
    });
  }, []);

  useEffect(() => {
    // Load site_data fallback config
    fetchTournamentConfig().then(setConfig);
    // Load active Supabase tournament (open type preferred for public display)
    supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data?.length) return;
        const validTournaments = isAdmin ? data : data.filter((t) => t.status !== "draft");
        setAllTournaments(validTournaments as SupabaseTournament[]);
      });
  }, [isAdmin]);

  const relevantEvents = viewStatus === "active" ? liveEvents : viewStatus === "draft" ? upcomingEvents : null;
  
  const liveTournament = viewStatus === "completed"
    ? null
    : ((activeTid ? relevantEvents?.find(t => t.slug === activeTid || t.id === activeTid) : null)
      ?? relevantEvents?.find((t) => t.tournament_type === "open")
      ?? relevantEvents?.[0]
      ?? (activeTid ? allTournaments.find(t => t.slug === activeTid || t.id === activeTid) : null)
      ?? allTournaments.find((t) => t.status === viewStatus && t.tournament_type === "open")
      ?? allTournaments.find((t) => t.status === viewStatus)
      ?? null);

  // Tournament bracket data now comes from Supabase tournament_matches (see LiveBracketsSection)

  useEffect(() => {
    mountedRef.current = true;
    const failsafe = setTimeout(() => {
      if (mountedRef.current) setLoadingFiles(false);
    }, 10_000);

    fetchNotices().finally(() => clearTimeout(failsafe));
    return () => {
      mountedRef.current = false;
      clearTimeout(failsafe);
    };
  }, []);

  const fetchNotices = async () => {
    if (!mountedRef.current) return;
    setLoadingFiles(true);
    try {
      const { data, error } = await supabase.storage
        .from(NOTICES_BUCKET)
        .list("");
      if (!mountedRef.current) return;
      if (error) {
        console.error("Bucket might not exist yet:", error.message);
        setFiles([]);
      } else {
        setFiles(data?.filter((f) => !f.name.startsWith(".")) || []);
      }
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setFiles([]);
    } finally {
      if (mountedRef.current) setLoadingFiles(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage
        .from(NOTICES_BUCKET)
        .upload(fileName, file, { upsert: true });
      if (error) throw error;
      await fetchNotices();
    } catch (err: any) {
      setUploadError("Upload failed: " + (err.message ?? "Unknown error"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    try {
      const { error } = await supabase.storage
        .from(NOTICES_BUCKET)
        .remove([fileName]);
      if (error) throw error;
      await fetchNotices();
    } catch (err: any) {
      setUploadError("Delete failed: " + (err.message ?? "Unknown error"));
    }
  };

  // Prefer live Supabase tournament data; fall back to site_data config
  const displayName = liveTournament?.name ?? config.name;
  const displayVenue = liveTournament?.venue ?? config.venue;
  const displayEligibility = liveTournament?.eligibility ?? config.eligibility;
  const displayDescription = liveTournament?.description ?? config.description;
  const displayFormUrl = liveTournament?.form_url ?? config.formUrl;
  const displayFormStatus = liveTournament?.form_status ?? config.formStatus;
  const displayDates = liveTournament
    ? (() => {
        const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        if (liveTournament.start_date && liveTournament.end_date && liveTournament.start_date !== liveTournament.end_date)
          return `${fmt(liveTournament.start_date)} – ${fmt(liveTournament.end_date)}`;
        if (liveTournament.start_date) return fmt(liveTournament.start_date);
        return "Dates TBD";
      })()
    : tournamentDatesDisplay(config);
  const displayCategories = liveTournament?.categories?.join(" · ") ?? config.categories;

  const infoCards = [
    { icon: Calendar, label: "Dates", value: displayDates, color: "bg-primary" },
    { icon: MapPin, label: "Venue", value: displayVenue, color: "bg-blue-600" },
    { icon: Users, label: "Categories", value: displayCategories, color: "bg-purple-600" },
    { icon: UserCheck, label: "Eligibility", value: displayEligibility, color: "bg-orange-500" },
  ];

  // Registration CTA
  const status = displayFormStatus as string;
  const hasForm = !!displayFormUrl && status !== "disabled";
  const formClosed = status === "closed";
  const badge =
    status === "open"
      ? { cls: "bg-primary/20 border-primary/30 text-primary/70", text: "Registrations Open" }
      : status === "closing_soon"
        ? { cls: "bg-amber-500/20 border-amber-500/30 text-amber-300", text: "Registrations Closing Soon" }
        : { cls: "bg-rose-500/20 border-rose-500/30 text-rose-300", text: "Registrations Closed" };
  const heading =
    status === "open"
      ? `Register for ${displayName}`
      : status === "closing_soon"
        ? "Registrations closing soon"
        : "Registrations are now closed";
  const ctaLabel =
    status === "open"
      ? "Register Now"
      : status === "closing_soon"
        ? "Register Now (Closing Soon)"
        : "Registration Form (Closed)";

  return (
    <section className="font-sans pb-16 pt-8">
      <div className="container mx-auto px-4 max-w-5xl space-y-6">
        {/* Tournament Status Subtabs */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-full max-w-md mx-auto">
            {[
              { id: "draft", label: "upcoming" },
              { id: "active", label: "live" },
              { id: "completed", label: "completed" }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setViewStatus(st.id)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all capitalize ${
                  viewStatus === st.id
                    ? "bg-white dark:bg-slate-700 text-blue-900 dark:text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-slate-300"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tournament Selection Subtabs (If multiple exist) */}
        {relevantEvents && relevantEvents.length > 1 && (
          <div className="flex justify-center mb-10 -mt-2">
            <div className="flex flex-wrap justify-center gap-2 bg-slate-50 dark:bg-slate-800/30 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              {relevantEvents.map((event) => {
                const isActive = liveTournament?.id === event.id;
                return (
                  <button
                    key={event.id}
                    onClick={() => setActiveTid(event.slug || event.id)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    {event.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {liveTournament && (
          <>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full" />
              <h2 className="text-3xl font-black text-blue-900 dark:text-foreground">
                {viewStatus === "active" ? "Live: " : viewStatus === "draft" ? "Upcoming: " : "Completed: "}
                {displayName}
              </h2>
            </div>

        {/* Info cards */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {infoCards.map(({ icon: Icon, label, value, color }, i) => (
            <motion.div
              key={label}
              custom={i}
              variants={fadeUp}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-3 hover:shadow-md transition-shadow"
            >
              <div
                className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shadow-md`}
              >
                <Icon className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 dark:text-muted-foreground uppercase tracking-wider">
                  {label}
                </p>
                <p className="text-sm font-bold text-blue-900 dark:text-foreground mt-0.5">
                  {value}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Registration CTA / Form — only when a form is configured */}
        {hasForm && (
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 rounded-3xl p-6 text-foreground text-center relative overflow-hidden border border-slate-700/50">
              <div className="absolute inset-0 hero-pattern opacity-20" />
              <div className="relative z-10">
                <div
                  className={`inline-flex items-center gap-2 border px-4 py-2 rounded-full text-sm font-bold mb-4 ${badge.cls}`}
                >
                  <Clock className="w-4 h-4" />
                  {badge.text}
                </div>
                <h2
                  className="text-2xl md:text-3xl font-black mb-2"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  {heading}
                </h2>
                {displayDescription && (
                  <p className="text-slate-300 max-w-2xl mx-auto mb-6">
                    {displayDescription}
                  </p>
                )}
                <a
                  href={displayFormUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-6 py-4 rounded-xl font-black transition shadow-xl ${
                    formClosed
                      ? "bg-slate-600 text-foreground opacity-70 cursor-not-allowed pointer-events-none"
                      : "bg-primary hover:bg-primary text-primary-foreground"
                  }`}
                >
                  {ctaLabel} <ArrowRight className="w-5 h-5" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap sm:flex-nowrap bg-white/5 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl mb-6 shadow-sm gap-1.5">
          {[
            { id: "notices", label: "Info & Notices", icon: FileText },
            { id: "players", label: "Players", icon: Users },
            { id: "schedule", label: "Match Schedule", icon: Calendar },
            { id: "broadcast", label: "Live Broadcast", icon: Radio },
            { id: "brackets", label: "Brackets", icon: LayoutList },
            ...((isUmpire || isAdmin) ? [{ id: "umpire", label: "Umpire", icon: Tv2 }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 basis-[45%] sm:basis-auto shrink-0 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "players" && liveTournament && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <LivePlayersSection tournamentId={liveTournament.id} categories={liveTournament.categories || []} />
          </div>
        )}

        {activeTab === "notices" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <motion.div
              custom={5}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden"
            >
              <div className="h-1 bg-gradient-to-r from-primary to-blue-600" />
              <div className="p-7 md:p-9">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-xl font-black text-slate-800 dark:text-foreground flex items-center gap-2">
                    <div className="p-2 bg-primary/15 dark:bg-primary/30 rounded-xl">
                      <FileText className="w-5 h-5 text-primary dark:text-primary" />
                    </div>
                    Official Notices
                  </h3>

                  {isAdmin && (
                    <label className="cursor-pointer inline-flex items-center gap-2 bg-primary/10 dark:bg-primary/20 hover:bg-primary/15 dark:hover:bg-primary/90/40 text-primary dark:text-primary px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border border-primary/40 dark:border-primary/80">
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {uploading ? "Uploading…" : "Upload Notice"}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,image/*"
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>

                {uploadError && (
                  <div className="mb-5 flex items-start gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-400 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                    <button
                      onClick={() => setUploadError(null)}
                      className="ml-auto text-rose-400 hover:text-rose-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {loadingFiles ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <FileText className="w-10 h-10 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground dark:text-muted-foreground font-semibold">
                      No notices yet
                    </p>
                    <p className="text-muted-foreground dark:text-muted-foreground text-sm mt-1">
                      Check back soon for fixtures and updates.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-primary/40 dark:hover:border-primary transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-primary/15 dark:bg-primary/30 flex items-center justify-center text-primary dark:text-primary flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="truncate min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-sm">
                              {file.name.replace(/^\d+_/, "")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(file.metadata?.size / 1024).toFixed(1)} KB ·{" "}
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                          <a
                            href={
                              supabase.storage
                                .from(NOTICES_BUCKET)
                                .getPublicUrl(file.name).data.publicUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-primary dark:text-primary hover:bg-primary/10 dark:hover:bg-primary/90/30 rounded-xl transition-colors"
                            title="Download / View"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteFile(file.name)}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                              title="Delete"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
            <SupabaseScheduleView tournamentId={liveTournament?.id ?? null} />
          </div>
        )}

        {activeTab === "broadcast" && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
            <LiveScoreSection />
          </div>
        )}
        {activeTab === "brackets" && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
            <LiveBracketsSection tournamentId={liveTournament?.id ?? null} />
          </div>
        )}

        {activeTab === "umpire" && (isUmpire || isAdmin) && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
            <UmpireTab tournamentOnly={true} />
          </div>
        )}
          </>
        )}
      </div>
      
      {/* ── GRID OF TOURNAMENTS (Rendered under the dashboard, or as the main view if dashboard is hidden) ── */}
      <div className="container mx-auto px-4 max-w-5xl mt-12 space-y-6 pb-16">
        {viewStatus === "active" && liveEvents && (
          <div>
            {liveEvents.filter(e => e.id !== liveTournament?.id).length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {liveEvents.filter(e => e.id !== liveTournament?.id).map((item) => renderCard?.(item, true))}
              </div>
            ) : !liveTournament ? (
              <div className="col-span-full rounded-3xl border-2 border-dashed border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/10 p-14 text-center">
                <Radio className="w-12 h-12 text-red-400 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-bold text-blue-900 dark:text-foreground mb-2">
                  No live tournaments
                </h3>
                <p className="text-muted-foreground dark:text-muted-foreground max-w-md mx-auto">
                  There are no ongoing tournaments at the moment. Check the upcoming tab to see what's next!
                </p>
              </div>
            ) : null}
          </div>
        )}

        {viewStatus === "draft" && upcomingEvents && (
          <div>
            {upcomingEvents.filter(e => e.id !== liveTournament?.id).length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {upcomingEvents.filter(e => e.id !== liveTournament?.id).map((item) => renderCard?.(item, false))}
              </div>
            ) : !liveTournament ? (
              <div className="col-span-full rounded-3xl border-2 border-dashed border-primary/40 dark:border-primary/50 bg-primary/10 dark:bg-primary/10 p-14 text-center">
                <Calendar className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-blue-900 dark:text-foreground mb-2">
                  No upcoming tournaments
                </h3>
                <p className="text-muted-foreground dark:text-muted-foreground max-w-md mx-auto">
                  No events are scheduled right now — check back soon, or browse our completed events.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {viewStatus === "completed" && (
          <div className="space-y-16">
            {completedEvents && (
              <div>
                {completedEvents.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {completedEvents.map((item) => renderCard?.(item, false))}
                  </div>
                ) : (
                  <div className="col-span-full rounded-3xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/10 p-14 text-center">
                    <Archive className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-blue-900 dark:text-foreground mb-2">
                      No completed tournaments
                    </h3>
                    <p className="text-muted-foreground dark:text-muted-foreground max-w-md mx-auto">
                      We don't have any completed tournament records yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Supabase Schedule View ────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  MS: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800",
  WS: "bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-100 dark:border-pink-800",
  MD: "bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary/70 border-primary/30 dark:border-primary/80",
  WD: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800",
  XD: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800",
};

interface ScheduledMatch {
  id: string;
  category: string;
  match_code: string;
  round_name: string;
  team1_label: string | null;
  team2_label: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  winner_side: 1 | 2 | null;
  sets_history: string[] | null;
}

function SupabaseScheduleView({ tournamentId }: { tournamentId: string | null }) {
  const [schedMatches, setSchedMatches] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");

  useEffect(() => {
    if (!tournamentId) { setLoading(false); return; }
    supabase
      .from("tournament_matches")
      .select("id,category,match_code,round_name,team1_label,team2_label,court_number,scheduled_at,status,winner_side,sets_history")
      .eq("tournament_id", tournamentId)
      .order("scheduled_at", { ascending: true })
      .order("round")
      .order("match_number")
      .then(({ data }) => {
        setSchedMatches((data as ScheduledMatch[]) ?? []);
        setLoading(false);
      });
  }, [tournamentId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const categories = ["ALL", ...new Set(schedMatches.map((m) => m.category))];
  const filtered = activeCategory === "ALL" ? schedMatches : schedMatches.filter((m) => m.category === activeCategory);

  // Group by date
  const grouped: Record<string, ScheduledMatch[]> = {};
  for (const m of filtered) {
    const key = m.scheduled_at
      ? new Date(m.scheduled_at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
      : "Unscheduled";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  if (!schedMatches.length) return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <Calendar className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-4" />
      <h3 className="text-xl font-black text-muted-foreground dark:text-slate-200 mb-2">Schedule Not Yet Available</h3>
      <p className="text-muted-foreground max-w-md">Match schedule will appear here once the admin assigns court times to bracket matches.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-xl text-sm font-black transition-all border ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-muted-foreground hover:border-primary"
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([date, dayMatches]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-black text-muted-foreground dark:text-slate-200">{date}</h3>
          </div>
          <div className="space-y-3">
            {dayMatches.map((m) => {
              const catCls = CAT_COLORS[m.category] ?? "bg-slate-50 dark:bg-slate-800 text-muted-foreground border-slate-200";
              const isCompleted = m.status === "completed" || m.status === "walkover";
              const isLive = m.status === "in_progress";
              return (
                <div key={m.id} className={`rounded-2xl border p-4 ${isLive ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20" : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${catCls}`}>{m.category}</span>
                    <span className="text-[10px] text-muted-foreground font-bold">{m.round_name} · {m.match_code}</span>
                    {m.court_number && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                        <MapPin className="w-3 h-3" /> Court {m.court_number}
                      </span>
                    )}
                    {m.scheduled_at && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {isLive && <span className="text-[10px] font-black text-red-500 animate-pulse">● LIVE</span>}
                    {isCompleted && <span className="text-[10px] font-black text-primary">✓ Done</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold flex-1 ${m.winner_side === 1 ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-slate-200"}`}>
                      {m.team1_label ?? "TBD"}
                    </span>
                    <span className="text-[10px] font-black text-rose-400 shrink-0">VS</span>
                    <span className={`text-sm font-bold flex-1 text-right ${m.winner_side === 2 ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-slate-200"}`}>
                      {m.team2_label ?? "TBD"}
                    </span>
                  </div>
                  {isCompleted && m.sets_history?.length ? (
                    <p className="mt-1.5 text-xs font-mono text-muted-foreground">{m.sets_history.join(", ")}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
// ── Tournament Archive Brackets ────────────────────────────────────────────────

export function TournamentArchiveBrackets({ tournamentId }: { tournamentId: string }) {
  const [matches, setMatches] = useState<PastMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "bracket">("list");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("tournament_matches")
      .select("id,category,match_code,round,round_name,match_number,team1_label,team2_label,winner_side,score,sets_history,status")
      .eq("tournament_id", tournamentId)
      .order("round")
      .order("match_number")
      .then(({ data }) => {
        const loadedMatches = (data as PastMatch[]) ?? [];
        setMatches(loadedMatches);
        if (loadedMatches.length > 0) {
          const cats = [...new Set(loadedMatches.map((m: any) => m.category))];
          if (cats.length > 0) setActiveCategory(cats[0]);
        }
        setLoading(false);
      });
  }, [tournamentId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const categories = [...new Set(matches.map((m) => m.category))];

  if (!matches.length) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 text-center">
        <p className="text-muted-foreground">No match results recorded for this tournament.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 space-y-6">
      {categories.length > 0 && matches.length > 0 && (
        <div className="space-y-4 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button onClick={() => setViewMode("list")} className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition ${viewMode === "list" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}>
              <LayoutList className="w-3.5 h-3.5" /> List View
            </button>
            <button onClick={() => setViewMode("bracket")} className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition ${viewMode === "bracket" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}>
              <Tv2 className="w-3.5 h-3.5" /> Bracket Tree
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary shadow"
                    : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-primary"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {viewMode === "bracket" && activeCategory ? (
        <div className="overflow-x-auto pb-4">
          {(() => {
            const catMatches = matches.filter((m) => m.category === activeCategory);
            const rounds = [...new Set(catMatches.map((m) => m.round))].sort((a, b) => a - b);
            return <BracketVisual matches={catMatches as any} rounds={rounds} />;
          })()}
        </div>
      ) : (
        <>
          {[activeCategory].filter(Boolean).map((cat) => {
            const catMatches = matches.filter((m) => m.category === cat);
            const rounds = [...new Set(catMatches.map((m) => m.round))].sort((a, b) => a - b);
            return (
              <div key={cat}>
                <h4 className="text-sm font-black text-muted-foreground dark:text-slate-200 mb-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-muted-foreground dark:text-slate-300">{cat}</span>
                </h4>
                <div className="space-y-4">
                  {rounds.map((round) => {
                    const roundMatches = catMatches.filter((m) => m.round === round);
                    return (
                      <div key={round}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{roundMatches[0]?.round_name}</p>
                        <div className="grid gap-2">
                          {roundMatches.map((m) => (
                            <div key={m.id} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-muted-foreground">{m.match_code}</span>
                                {m.status === "walkover" && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600">W/O</span>
                                )}
                                {m.status === "scheduled" && !m.scheduled_at && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">Not scheduled yet</span>
                                )}
                                {m.status === "scheduled" && m.scheduled_at && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                                    Scheduled at {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                    {m.court_number ? ` (Court ${m.court_number})` : ""}
                                  </span>
                                )}
                                {m.status === "in_progress" && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600">In Progress</span>
                                )}
                                {m.status === "completed" && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 dark:bg-primary/40 text-primary">Completed</span>
                                )}
                              </div>
                              <MatchScoreDisplay
                                sets_history={m.sets_history}
                                team1_label={m.team1_label ?? "TBD"}
                                team2_label={m.team2_label ?? "TBD"}
                                winner_side={m.winner_side}
                                status={m.status}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
