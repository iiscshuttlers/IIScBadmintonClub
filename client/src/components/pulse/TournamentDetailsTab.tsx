import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, FileText, Upload, AlertCircle, X, Download, Loader2 } from "lucide-react";
import { tournamentService } from "@/services/tournamentService";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { toast } from "sonner";

interface TournamentDetailsTabProps {
  tournament: any;
  playerName: string | null;
}


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
  const { confirm } = useConfirm();
  
  // Notices State
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchNotices = async () => {
    try {
      const folder = tournament?.id || "legacy";
      const data = await tournamentService.listTournamentNotices(folder);
      setFiles(data);
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
      await tournamentService.uploadTournamentNotice(folder, fileName, file);
      await fetchNotices();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload notice");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    const ok = await confirm({
      title: "Delete Notice?",
      description: `Are you sure you want to delete notice "${fileName}"?`,
      confirmLabel: "Delete",
      confirmVariant: "danger"
    });
    if (!ok) return;

    try {
      const folder = tournament?.id || "legacy";
      await tournamentService.deleteTournamentNotice(folder, fileName);
      toast.success("Notice deleted");
      await fetchNotices();
    } catch (err: any) {
      toast.error("Failed to delete notice");
    }
  };

    return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-8">
        
        {/* Info Section */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-8 bg-gradient-to-b from-warning to-secondary rounded-full" />
              <div className="text-left">
                <h3 className="text-lg sm:text-xl font-black text-soft">
                  {tournament?.name}
                </h3>
              </div>
            </div>
            
            <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground whitespace-pre-wrap">
              {tournament?.description || "No description available for this tournament."}
            </div>
            
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card/50 p-4 rounded-2xl border border-border">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <p className="text-sm font-bold text-soft capitalize">{tournament?.status}</p>
              </div>
              <div className="bg-card/50 p-4 rounded-2xl border border-border">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Categories</p>
                <p className="text-sm font-bold text-soft">
                  {tournament?.categories?.join(", ") || "N/A"}
                </p>
              </div>
              <div className="bg-card/50 p-4 rounded-2xl border border-border">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Venue</p>
                <p className="text-sm font-bold text-soft">{tournament?.location || "TBD"}</p>
              </div>
              <div className="bg-card/50 p-4 rounded-2xl border border-border">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Eligibility</p>
                <p className="text-sm font-bold text-soft">
                  {tournament?.require_app_registration ? "App Registration Required" : "Open"}
                </p>
              </div>
            </div>

            <div className="h-px bg-muted w-full mb-8" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
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
                <div className="mb-5 flex items-start gap-2 px-4 py-3 bg-danger/10 border border-danger/40 rounded-xl text-danger text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="ml-auto text-danger hover:text-danger/80"><X className="w-4 h-4" /></button>
                </div>
              )}

              {loadingFiles ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 rounded-2xl border-2 border-dashed border-border bg-card/50">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground font-semibold text-sm">No notices yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file, idx) => {
                    const folder = tournament?.id || "legacy";
                    const fileUrl = tournamentService.getTournamentNoticePublicUrl(folder, file.name);
                    return (
                      <div key={idx} className="group relative flex items-center justify-between p-3 sm:p-4 bg-card/50 rounded-2xl border border-border hover:border-primary/40 transition-colors">
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0 rounded-2xl" />
                        <div className="flex items-center gap-3 overflow-hidden min-w-0 relative z-0 pointer-events-none">
                          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="truncate min-w-0">
                            <p className="font-bold text-soft truncate text-sm">
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
                            <button onClick={() => handleDeleteFile(file.name)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors">
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

      </div>
    </div>
  );
}
