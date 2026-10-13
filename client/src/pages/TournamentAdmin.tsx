import { useEffect } from "react";
import { useLocation } from "wouter";
import { Trophy, ArrowLeft, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { TournamentManager } from "@/components/admin/TournamentManager";
import { AdminHistoryProvider } from "@/contexts/AdminHistoryContext";
import { Button } from "@/components/ui/button";

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
        <Button onClick={() => navigate("/")} className="mt-2">
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <AdminHistoryProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-[#060d1b]">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="max-w-5xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="-ml-1 rounded-xl shrink-0"
                aria-label="Back to Admin Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-black text-slate-800 dark:text-foreground leading-tight truncate">
                  Tournament Manager
                </h1>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground leading-tight">
                  <span>Admin</span>
                  <span>/</span>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">Tournaments</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/pulse")}
              >
                Pulse Hub
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/admin")}
              >
                Admin Panel
              </Button>
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
