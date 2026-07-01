import { useEffect } from "react";
import { useLocation } from "wouter";
import { Trophy, ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { TournamentManager } from "@/components/admin/TournamentManager";
import { AdminHistoryProvider } from "@/contexts/AdminHistoryContext";
import { Loader2 } from "lucide-react";

export default function TournamentAdmin() {
  const { session, isInitializing, isMainAdmin, isAdmin } = useAuth();
  const [, navigate] = useLocation();

  usePageMeta({
    title: "Tournament Manager — IISc Shuttlers",
    description: "Manage tournaments, brackets, participants and results.",
  });

  useEffect(() => {
    if (!isInitializing && !session) navigate("/join");
  }, [isInitializing, session, navigate]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#060d1b]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isMainAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#060d1b] gap-4 p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500" />
        <h1 className="text-2xl font-black text-slate-800 dark:text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">You need admin permissions to access Tournament Manager.</p>
        <button onClick={() => navigate("/")}
          className="mt-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary text-foreground font-black transition">
          Go Home
        </button>
      </div>
    );
  }

  return (
    <AdminHistoryProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-[#060d1b]">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-muted-foreground hover:text-slate-800 dark:hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-800 dark:text-foreground leading-tight">Tournament Manager</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">Create · Bracket · Archive</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 py-6">
          <TournamentManager />
        </div>
      </div>
    </AdminHistoryProvider>
  );
}
