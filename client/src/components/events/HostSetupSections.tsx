import { lazy, Suspense, type ReactNode } from "react";
import { ClipboardCheck, Gauge, Loader2, Users } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useAuth } from "@/contexts/AuthContext";

// Admin-sized components: load them only when a host opens the section.
const TournamentParticipantsTab = lazy(() =>
  import("@/components/admin/TournamentParticipantsTab").then((m) => ({ default: m.TournamentParticipantsTab })),
);
const TournamentRegistrationsPanel = lazy(() =>
  import("@/components/admin/TournamentRegistrationsPanel").then((m) => ({ default: m.TournamentRegistrationsPanel })),
);
const ScoringRulesPanel = lazy(() =>
  import("@/components/tournament/ScoringRulesPanel").then((m) => ({ default: m.ScoringRulesPanel })),
);

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * Set-up tools for the tournament's host in the Organiser panel, so a host who
 * is not an admin does not need the Tournament Manager for them:
 * registrations, entries and scoring rules. Shown to the creator, the person
 * the database lets write them (tp_host_manage, tournament_registrations_update,
 * set_tournament_round_rule). Admins who did not create the tournament use the
 * Manager. Team events keep their teams in the Manager.
 */
export function HostSetupSections({ tournament }: { tournament: any }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  if (!tournament?.id || !userId || tournament.created_by !== userId) return null;

  const isTeam = tournament.format_family === "TEAM";

  return (
    <div className="space-y-3">
      <h3 className="px-1 text-xs font-black uppercase tracking-wider text-muted-foreground">Set-up</h3>

      {tournament.require_app_registration && (
        <CollapsibleSection
          bare
          title="Registrations"
          icon={<ClipboardCheck />}
          summary="Approve players who signed up in the app"
        >
          <Loading>
            <TournamentRegistrationsPanel tournament={tournament} />
          </Loading>
        </CollapsibleSection>
      )}

      {!isTeam && (
        <CollapsibleSection
          bare
          title="Entries"
          icon={<Users />}
          summary="Add, seed, rename and remove players and pairs"
        >
          <Loading>
            <TournamentParticipantsTab tournament={tournament} variant="host" />
          </Loading>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        bare
        title="Scoring rules"
        icon={<Gauge />}
        summary="Points, games and caps per round"
      >
        <Loading>
          <ScoringRulesPanel tournament={tournament} />
        </Loading>
      </CollapsibleSection>
    </div>
  );
}
