import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { ScheduleView } from "@/pages/ScheduleView";
import { LiveScoreSection } from "@/components/events/LiveScoreSection";
import { LiveBracketsSection } from "@/components/events/LiveBracketsSection";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

const INVICTA_CONFIG = {
  dates: "1st – 21st June",
  venue: "Gymkhana Courts",
  categories: "MS · WS · MD · WD · XD",
  eligibility: "All IISc Members",
  registrationClosed: true,
  description:
    "The registration window for INVICTA 2026 has ended. Check back for fixtures and updates below.",
  formUrl: "https://forms.cloud.microsoft/r/c82F9mgTv5",
};

export function InvictaSection() {
  const { session } = useAuth();
  const isAdmin = isAdminEmail(session?.user?.email);
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"notices" | "schedule" | "broadcast" | "brackets">("notices");
  const [tournamentData, setTournamentData] = useState<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "live_data", "tournament"), (docSnap) => {
      if (docSnap.exists()) setTournamentData(docSnap.data());
    });
    return () => unsubscribe();
  }, []);

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
        .from("invicta_notices")
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
        .from("invicta_notices")
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
        .from("invicta_notices")
        .remove([fileName]);
      if (error) throw error;
      await fetchNotices();
    } catch (err: any) {
      setUploadError("Delete failed: " + (err.message ?? "Unknown error"));
    }
  };

  const infoCards = [
    {
      icon: Calendar,
      label: "Dates",
      value: INVICTA_CONFIG.dates,
      color: "bg-emerald-500",
    },
    {
      icon: MapPin,
      label: "Venue",
      value: INVICTA_CONFIG.venue,
      color: "bg-blue-600",
    },
    {
      icon: Users,
      label: "Categories",
      value: INVICTA_CONFIG.categories,
      color: "bg-purple-600",
    },
    {
      icon: UserCheck,
      label: "Eligibility",
      value: INVICTA_CONFIG.eligibility,
      color: "bg-orange-500",
    },
  ];

  return (
    <section className="font-sans pb-16 pt-8">
      <div className="container mx-auto px-4 max-w-5xl space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full" />
          <h2 className="text-3xl font-black text-blue-900 dark:text-white">
            Upcoming: INVICTA 2026
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

        {/* Registration CTA / Form */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 rounded-3xl p-8 text-white text-center relative overflow-hidden border border-slate-700/50">
            <div className="absolute inset-0 hero-pattern opacity-20" />
            <div className="relative z-10">
              {INVICTA_CONFIG.registrationClosed ? (
                <>
                  <div className="inline-flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 text-rose-300 px-4 py-2 rounded-full text-sm font-bold mb-4">
                    <Clock className="w-4 h-4" />
                    Registrations Closed
                  </div>
                  <h2
                    className="text-2xl md:text-3xl font-black mb-2"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    Registrations are now closed
                  </h2>
                  <p className="text-slate-300 max-w-2xl mx-auto mb-6">
                    {INVICTA_CONFIG.description}
                  </p>
                  <a
                    href={INVICTA_CONFIG.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-black transition shadow-xl opacity-70 cursor-not-allowed pointer-events-none"
                  >
                    Registration Form (Closed){" "}
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-4 py-2 rounded-full text-sm font-bold mb-4">
                    <Clock className="w-4 h-4" />
                    Registrations Open
                  </div>
                  <h2
                    className="text-2xl md:text-3xl font-black mb-2"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    Register for INVICTA
                  </h2>
                  <p className="text-slate-300 max-w-2xl mx-auto mb-6">
                    {INVICTA_CONFIG.description}
                  </p>
                  <a
                    href={INVICTA_CONFIG.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition shadow-xl"
                  >
                    Register Now <ArrowRight className="w-5 h-5" />
                  </a>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex bg-white/5 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide mb-6 shadow-sm">
          {[
            { id: "notices", label: "Info & Notices", icon: FileText },
            { id: "schedule", label: "Match Schedule", icon: Calendar },
            { id: "broadcast", label: "Live Broadcast", icon: Radio },
            { id: "brackets", label: "Brackets", icon: LayoutList },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 justify-center ${
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
            {/* Notices & Announcements */}
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
                            .from("invicta_notices")
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

        {/* Visual Bracket Demo */}
        <motion.div
          custom={6}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden"
        >
          <div className="p-7 md:p-9">
            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 mb-8">
              <Trophy className="w-5 h-5 text-emerald-500" />
              Tournament Bracket (Preview)
            </h3>

            <div className="overflow-x-auto pb-8">
              <div className="flex gap-8 min-w-max">
                {/* Quarter Finals */}
                <div className="flex flex-col gap-8 justify-center">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Quarter Finals
                  </div>

                  {/* Match 1 */}
                  <div className="flex flex-col">
                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 w-48 flex justify-between items-center z-10 relative">
                      <span className="font-bold text-sm">Player 1</span>
                      <span className="text-xs font-black text-slate-400">
                        21
                      </span>
                    </div>
                    <div className="h-4 border-r-2 border-slate-200 dark:border-slate-700 w-full relative -top-1 -z-10" />
                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 w-48 flex justify-between items-center z-10 relative">
                      <span className="font-bold text-sm">Player 2</span>
                      <span className="text-xs font-black text-slate-400">
                        18
                      </span>
                    </div>
                  </div>

                  {/* Match 2 */}
                  <div className="flex flex-col mt-4">
                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 w-48 flex justify-between items-center z-10 relative">
                      <span className="font-bold text-sm">Player 3</span>
                      <span className="text-xs font-black text-slate-400">
                        15
                      </span>
                    </div>
                    <div className="h-4 border-r-2 border-slate-200 dark:border-slate-700 w-full relative -top-1 -z-10" />
                    <div className="bg-slate-100 dark:bg-slate-900 border border-emerald-500 dark:border-emerald-600 rounded-lg p-3 w-48 flex justify-between items-center z-10 relative shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      <span className="font-bold text-sm">Player 4</span>
                      <span className="text-xs font-black text-emerald-500">
                        21
                      </span>
                    </div>
                  </div>
                </div>

                {/* Semi Finals */}
                <div className="flex flex-col gap-8 justify-center mt-6">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Semi Finals
                  </div>

                  {/* Match 3 */}
                  <div className="flex flex-col relative h-[180px] justify-center">
                    {/* Connecting line from QF 1 */}
                    <div className="absolute -left-8 top-1/4 w-8 border-b-2 border-slate-200 dark:border-slate-700" />
                    {/* Connecting line from QF 2 */}
                    <div className="absolute -left-8 bottom-1/4 w-8 border-b-2 border-slate-200 dark:border-slate-700" />

                    <div className="bg-slate-100 dark:bg-slate-900 border border-emerald-500 dark:border-emerald-600 rounded-lg p-3 w-48 flex justify-between items-center z-10 relative shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      <span className="font-bold text-sm">Player 1</span>
                      <span className="text-xs font-black text-emerald-500">
                        21
                      </span>
                    </div>
                    <div className="h-4 border-r-2 border-slate-200 dark:border-slate-700 w-full relative -top-1 -z-10" />
                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 w-48 flex justify-between items-center z-10 relative">
                      <span className="font-bold text-sm">Player 4</span>
                      <span className="text-xs font-black text-slate-400">
                        19
                      </span>
                    </div>
                  </div>
                </div>

                {/* Finals */}
                <div className="flex flex-col gap-8 justify-center mt-6">
                  <div className="text-xs font-black uppercase tracking-widest text-amber-500 mb-2">
                    Finals
                  </div>

                  {/* Match 4 */}
                  <div className="flex flex-col relative h-[180px] justify-center">
                    <div className="absolute -left-8 top-1/2 w-8 border-b-2 border-slate-200 dark:border-slate-700" />

                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-3 w-48 flex justify-between items-center z-10 relative shadow-xl shadow-amber-500/30 text-white">
                      <span className="font-bold text-sm flex items-center gap-2">
                        <Trophy className="w-4 h-4" /> Player 1
                      </span>
                      <span className="text-xs font-black">21</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-slate-500 dark:text-slate-400 text-xs mt-4">
              This is a live preview. The actual bracket will be generated when
              registration closes.
            </p>
          </div>
        </motion.div>
        </div>
        )}

        {activeTab === "schedule" && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
             <ScheduleView tournamentData={tournamentData} />
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
      </div>
    </section>
  );
}
