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
import { UmpireTab } from "@/components/umpire/UmpireTab";
import { useHashTab } from "@/hooks/useHashTab";
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
}

export function TournamentSection() {
  const { session, isUmpire } = useAuth();
  const isAdmin = isAdminEmail(session?.user?.email);
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_TOURNAMENT_CONFIG);
  // Live Supabase tournament (takes priority over site_data config)
  const [liveTournament, setLiveTournament] = useState<SupabaseTournament | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useHashTab(
    ["notices", "schedule", "broadcast", "brackets", "past", "umpire"] as const,
    "notices",
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    // Load site_data fallback config
    fetchTournamentConfig().then(setConfig);
    // Load active Supabase tournament (open type preferred for public display)
    supabase
      .from("tournaments")
      .select("id,name,tournament_type,categories,status,start_date,end_date,venue,description,eligibility,form_url,form_status,archived_at")
      .in("status", ["draft", "active", "completed"])
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!data?.length) return;
        // Prefer active open tournament; fall back to any active; then any
        const active = data.find((t) => t.status === "active" && t.tournament_type === "open")
          ?? data.find((t) => t.status === "active")
          ?? data[0];
        // Only show to non-admin if not draft
        if (!isAdmin && active.status === "draft") return;
        setLiveTournament(active as SupabaseTournament);
      });
  }, [isAdmin]);

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
    { icon: Calendar, label: "Dates", value: displayDates, color: "bg-emerald-500" },
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
      ? { cls: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", text: "Registrations Open" }
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
      <div className="container mx-auto px-4 max-w-5xl space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full" />
          <h2 className="text-3xl font-black text-blue-900 dark:text-white">
            {liveTournament?.status === "active" ? "Live: " : "Upcoming: "}{displayName}
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
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  {label}
                </p>
                <p className="text-sm font-bold text-blue-900 dark:text-white mt-0.5">
                  {value}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Registration CTA / Form — only when a form is configured */}
        {hasForm && (
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 rounded-3xl p-8 text-white text-center relative overflow-hidden border border-slate-700/50">
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
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-black transition shadow-xl ${
                    formClosed
                      ? "bg-slate-600 text-white opacity-70 cursor-not-allowed pointer-events-none"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
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
            { id: "schedule", label: "Match Schedule", icon: Calendar },
            { id: "broadcast", label: "Live Broadcast", icon: Radio },
            { id: "brackets", label: "Brackets", icon: LayoutList },
            { id: "past", label: "Past Tournaments", icon: Archive },
            ...((isUmpire || isAdmin) ? [{ id: "umpire", label: "Umpire", icon: Tv2 }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 basis-[45%] sm:basis-auto shrink-0 ${
                activeTab === tab.id
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "notices" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <motion.div
              custom={5}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden"
            >
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-blue-600" />
              <div className="p-7 md:p-9">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950/30 rounded-xl">
                      <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    Official Notices
                  </h3>

                  {isAdmin && (
                    <label className="cursor-pointer inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border border-emerald-200 dark:border-emerald-800">
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
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-semibold">
                      No notices yet
                    </p>
                    <p className="text-slate-400 dark:text-slate-600 text-sm mt-1">
                      Check back soon for fixtures and updates.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="truncate min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-sm">
                              {file.name.replace(/^\d+_/, "")}
                            </p>
                            <p className="text-xs text-slate-400">
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
                            className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors"
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
            <LiveBracketsSection />
          </div>
        )}

        {activeTab === "past" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PastTournamentsSection isAdmin={isAdmin} />
          </div>
        )}

        {activeTab === "umpire" && (isUmpire || isAdmin) && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
            <UmpireTab tournamentOnly={true} />
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
  MD: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800",
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

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
    <div className="py-24 flex flex-col items-center justify-center text-center">
      <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
      <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 mb-2">Schedule Not Yet Available</h3>
      <p className="text-slate-400 max-w-md">Match schedule will appear here once the admin assigns court times to bracket matches.</p>
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
                ? "bg-emerald-600 text-white border-emerald-600 shadow"
                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-400"
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([date, dayMatches]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <h3 className="font-black text-slate-700 dark:text-slate-200">{date}</h3>
          </div>
          <div className="space-y-3">
            {dayMatches.map((m) => {
              const catCls = CAT_COLORS[m.category] ?? "bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200";
              const isCompleted = m.status === "completed" || m.status === "walkover";
              const isLive = m.status === "in_progress";
              return (
                <div key={m.id} className={`rounded-2xl border p-4 ${isLive ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20" : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${catCls}`}>{m.category}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{m.round_name} · {m.match_code}</span>
                    {m.court_number && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                        <MapPin className="w-3 h-3" /> Court {m.court_number}
                      </span>
                    )}
                    {m.scheduled_at && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {isLive && <span className="text-[10px] font-black text-red-500 animate-pulse">● LIVE</span>}
                    {isCompleted && <span className="text-[10px] font-black text-emerald-500">✓ Done</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold flex-1 ${m.winner_side === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}>
                      {m.team1_label ?? "TBD"}
                    </span>
                    <span className="text-[10px] font-black text-rose-400 shrink-0">VS</span>
                    <span className={`text-sm font-bold flex-1 text-right ${m.winner_side === 2 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}>
                      {m.team2_label ?? "TBD"}
                    </span>
                  </div>
                  {isCompleted && m.sets_history?.length ? (
                    <p className="mt-1.5 text-xs font-mono text-slate-400">{m.sets_history.join(", ")}</p>
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

// ── Past Tournaments ───────────────────────────────────────────────────────────

function PastTournamentsSection({ isAdmin }: { isAdmin: boolean }) {
  const [tournaments, setTournaments] = useState<SupabaseTournament[]>([]);
  const [matches, setMatches] = useState<Record<string, PastMatch[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("tournaments")
      .select("id,name,tournament_type,categories,status,start_date,end_date,venue,description,eligibility,form_url,form_status,archived_at")
      .in("status", isAdmin ? ["completed", "archived"] : ["archived"])
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTournaments((data as SupabaseTournament[]) ?? []);
        setLoading(false);
      });
  }, [isAdmin]);

  const loadMatches = async (tournamentId: string) => {
    if (matches[tournamentId]) { setOpenId(tournamentId); return; }
    const { data } = await supabase
      .from("tournament_matches")
      .select("id,category,match_code,round,round_name,match_number,team1_label,team2_label,winner_side,score,sets_history,status")
      .eq("tournament_id", tournamentId)
      .order("round")
      .order("match_number");
    setMatches((prev) => ({ ...prev, [tournamentId]: (data as PastMatch[]) ?? [] }));
    setOpenId(tournamentId);
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
    </div>
  );

  if (!tournaments.length) return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 p-12 text-center">
      <Archive className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
      <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 mb-2">No Past Tournaments Yet</h3>
      <p className="text-slate-400">Completed and archived tournaments will appear here with full fixture history.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {tournaments.map((t) => {
        const isOpen = openId === t.id;
        const tournamentMatches = matches[t.id] ?? [];
        const categories = [...new Set(tournamentMatches.map((m) => m.category))];

        const fmt = (d: string | null) => d
          ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : null;

        return (
          <div key={t.id} className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => isOpen ? setOpenId(null) : loadMatches(t.id)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white">{t.name}</h3>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${t.status === "archived" ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600" : "bg-blue-100 dark:bg-blue-950/40 text-blue-600"}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {t.venue && <span>{t.venue} · </span>}
                    {fmt(t.start_date) && <span>{fmt(t.start_date)}{t.end_date && t.end_date !== t.start_date ? ` – ${fmt(t.end_date)}` : ""}</span>}
                    {t.categories?.length > 0 && <span className="ml-1">· {t.categories.join(", ")}</span>}
                  </p>
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 dark:border-slate-700 p-6 space-y-6">
                {!tournamentMatches.length && (
                  <p className="text-slate-400 text-center py-6">No match results recorded for this tournament.</p>
                )}
                {categories.map((cat) => {
                  const catMatches = tournamentMatches.filter((m) => m.category === cat);
                  const rounds = [...new Set(catMatches.map((m) => m.round))].sort((a, b) => a - b);
                  return (
                    <div key={cat}>
                      <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{cat}</span>
                      </h4>
                      <div className="space-y-4">
                        {rounds.map((round) => {
                          const roundMatches = catMatches.filter((m) => m.round === round);
                          return (
                            <div key={round}>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{roundMatches[0]?.round_name}</p>
                              <div className="grid gap-2">
                                {roundMatches.map((m) => (
                                  <div key={m.id} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-[10px] font-black text-slate-400">{m.match_code}</span>
                                      {m.status === "walkover" && (
                                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-500">W/O</span>
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
