import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, FileText, Upload, AlertCircle, X, Download, Loader2, Info, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { LivePlayersSection } from "@/components/events/LivePlayersSection";

interface TournamentDetailsTabProps {
  tournament: any;
  playerName: string | null;
}

const NOTICES_BUCKET = "tournament_notices";

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.4, ease: "easeOut" as const } 
  },
};

export function TournamentDetailsTab({ tournament, playerName }: TournamentDetailsTabProps) {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"info" | "participants">("info");
  
  // Notices State
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchNotices = async () => {
    try {
      const folder = tournament?.id || "legacy";
      const { data, error } = await supabase.storage.from(NOTICES_BUCKET).list(folder, {
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      setFiles(data?.filter((f) => f.name !== ".emptyFolderPlaceholder") || []);
    } catch (err: any) {
      console.error("Error fetching notices:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [tournament?.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("File must be less than 5MB");
      const folder = tournament?.id || "legacy";
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from(NOTICES_BUCKET).upload(`${folder}/${fileName}`, file);
      if (error) throw error;
      await fetchNotices();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload notice");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!window.confirm("Delete this notice?")) return;
    try {
      const folder = tournament?.id || "legacy";
      const { error } = await supabase.storage.from(NOTICES_BUCKET).remove([`${folder}/${fileName}`]);
      if (error) throw error;
      await fetchNotices();
    } catch (err: any) {
      alert("Failed to delete notice");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pb-2 mb-6">
        {[
          { id: "info", label: "Info & Notices", icon: Info },
          { id: "participants", label: "Participants", icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 scale-105"
                : "bg-slate-200 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4 mb-[1px]" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-8">
        
        {/* Info Section */}
        {activeTab === "info" && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full" />
              <div className="text-left">
                <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-200">
                  {tournament?.name}
                </h3>
              </div>
            </div>
            
            <div className="prose dark:prose-invert max-w-none text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {tournament?.description || "No description available for this tournament."}
            </div>
            
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Status</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">{tournament?.status}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Categories</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {tournament?.categories?.join(", ") || "N/A"}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Venue</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{tournament?.location || "TBD"}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Eligibility</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {tournament?.require_app_registration ? "App Registration Required" : "Open"}
                </p>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800 w-full mb-8" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-lg font-black text-slate-800 dark:text-foreground flex items-center gap-2">
                <div className="p-2 bg-primary/15 rounded-xl">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                Notices
              </h3>

                {isAdmin && (
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? "Uploading…" : "Upload Notice"}
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,image/*" disabled={uploading} />
                  </label>
                )}
              </div>

              {uploadError && (
                <div className="mb-5 flex items-start gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="ml-auto text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
                </div>
              )}

              {loadingFiles ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground font-semibold text-sm">No notices yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file, idx) => {
                    const folder = tournament?.id || "legacy";
                    const fileUrl = supabase.storage.from(NOTICES_BUCKET).getPublicUrl(`${folder}/${file.name}`).data.publicUrl;
                    return (
                      <div key={idx} className="group relative flex items-center justify-between p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/40 transition-colors">
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0 rounded-2xl" />
                        <div className="flex items-center gap-3 overflow-hidden min-w-0 relative z-0 pointer-events-none">
                          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="truncate min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-sm">
                              {file.name.replace(/^\d+_/, "")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(file.metadata?.size / 1024).toFixed(1)} KB · {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-3 relative z-10">
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors">
                            <Download className="w-4 h-4" />
                          </a>
                          {isAdmin && (
                            <button onClick={() => handleDeleteFile(file.name)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </motion.div>
        )}

        {/* Players Section */}
        {activeTab === "participants" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-slate-800 dark:text-foreground mb-6">Participants</h3>
            <LivePlayersSection 
              tournamentId={tournament?.id} 
              categories={tournament?.categories || []} 
              showParticipants={tournament?.show_participants} 
            />
          </div>
        )}

      </div>
    </div>
  );
}
