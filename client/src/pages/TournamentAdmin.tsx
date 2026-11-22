import { useEffect } from "react";
import { useLocation } from "wouter";
import { Trophy, ArrowLeft, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { TournamentManager } from "@/components/admin/TournamentManager";
import { AdminHistoryProvider } from "@/contexts/AdminHistoryContext";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/BackButton";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isMainAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-danger" />
        <h1 className="text-2xl font-black text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">You need admin permissions to access Tournament Manager.</p>
        <Button onClick={() => navigate("/")} className="mt-2">
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <AdminHistoryProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border shadow-xs">
          <div className="max-w-5xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="-ml-1 rounded-xl shrink-0" asChild>
                <BackButton parent="/admin" aria-label="Back">
                  <ArrowLeft className="w-5 h-5" />
                </BackButton>
              </Button>
              <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-gold" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-black text-foreground leading-tight truncate">
                  Tournament Manager
                </h1>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground leading-tight">
                  <span>Admin</span>
                  <span>/</span>
                  <span className="text-soft font-semibold">Tournaments</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/tournaments")}
              >
                Tournaments
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
