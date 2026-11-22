import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { UmpireTournamentTab, type TournamentMatchForUmpire } from "@/components/umpire/UmpireTournamentTab";
import { UmpireEngine } from "@/components/umpire/UmpireEngine";
import { Shield, Swords, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHistoryStep } from "@/hooks/useHistoryStep";

export default function OfficiatePage() {
  const [, setLocation] = useLocation();
  const { session, profile, isUmpire, isAdmin } = useAuth();
  // The opened match is a step with its own history entry, so Back (on screen,
  // phone or browser) returns to the match list instead of leaving the page.
  // History keeps only the id; the loaded match stays in memory.
  const [openedMatches] = useState(() => new Map<string, TournamentMatchForUmpire>());
  const { value: openId, go: goToMatch, back: matchBack } = useHistoryStep<string | null>(
    "officiateMatch",
    null,
    (id) => (id === null ? undefined : null),
  );
  const activeMatch = openId ? openedMatches.get(openId) ?? null : null;
  const openMatch = (m: TournamentMatchForUmpire) => {
    openedMatches.set(m.id, m);
    goToMatch(m.id);
  };
  const closeMatch = () => {
    matchBack();
  };

  // After a reload the id survives but the loaded match doesn't: show the list.
  useEffect(() => {
    if (openId && !openedMatches.has(openId)) goToMatch(null, { replace: true });
  }, [openId, openedMatches, goToMatch]);

  const hasAccess = !!session && (isUmpire || isAdmin || profile?.role === "master_admin" || profile?.role === "admin" || profile?.role === "umpire");

  if (!session) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader
          badge="Officials & Umpires"
          badgeIcon={<Shield className="w-3.5 h-3.5 text-primary" />}
          title="Officiate Matches"
          subtitle="Real-time BWF scoring console, court scheduling, and match officiating."
        />
        <div className="container mx-auto px-4 max-w-xl text-center py-16">
          <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
            <Swords className="w-12 h-12 text-primary mx-auto opacity-80" />
            <h2 className="text-xl font-black text-foreground">Sign In Required</h2>
            <p className="text-sm text-muted-foreground">
              Please sign in with your official or club credentials to access assigned matches and the live scoring console.
            </p>
            <div className="pt-2">
              <Link href="/join?return_url=/officiate">
                <Button className="font-bold">Sign In to Officiate</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader
          badge="Officials & Umpires"
          badgeIcon={<Shield className="w-3.5 h-3.5 text-primary" />}
          title="Officiate Matches"
          subtitle="Real-time BWF scoring console, court scheduling, and match officiating."
        />
        <div className="container mx-auto px-4 max-w-xl text-center py-16">
          <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
            <AlertCircle className="w-12 h-12 text-warning mx-auto opacity-80" />
            <h2 className="text-xl font-black text-foreground">Official Access Required</h2>
            <p className="text-sm text-muted-foreground">
              Your account does not currently have umpire or tournament official privileges. Please contact tournament administration to be added as an official.
            </p>
            <div className="pt-2">
              <Link href="/tournaments">
                <Button variant="outline" className="font-bold">Browse Tournaments</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        badge="Officials Hub"
        badgeIcon={<Shield className="w-3.5 h-3.5 text-primary" />}
        title="Officiate Matches"
        subtitle="Active tournaments, assigned fixtures, and instant court scoring."
      />

      <div className="container mx-auto px-4 max-w-5xl pt-6">
        {activeMatch ? (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={closeMatch}
              className="gap-1.5 text-xs font-black"
            >
              <ArrowLeft className="w-4 h-4" /> Back to matches list
            </Button>
            <div className="rounded-3xl overflow-hidden border border-border shadow-xl bg-card p-2 sm:p-4">
              <UmpireEngine
                userId={session.user.id}
                userEmail={session.user.email || ""}
                userName={profile?.full_name || session.user.email || "Official"}
                isTournamentUmpire={true}
                tournamentMatch={activeMatch}
                onClose={closeMatch}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
            <UmpireTournamentTab
              onStartMatch={openMatch}
            />
          </div>
        )}
      </div>
    </div>
  );
}
