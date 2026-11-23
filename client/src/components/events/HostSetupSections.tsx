import { lazy, Suspense, type ReactNode } from "react";
import { ClipboardCheck, Gauge, Loader2, Users } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useAuth } from "@/contexts/AuthContext";
import { isRegistrationFlagOn } from "@/services/tournament/registrationEntries";

// Admin-sized components: load them only when a host opens the section.
const TournamentParticipantsTab = lazy(() =>
  import("@/components/admin/TournamentParticipantsTab").then((m) => ({ default: m.TournamentParticipantsTab })),
);
const TournamentRegistrationsPanel = lazy(() =>
  import("@/components/admin/TournamentRegistrationsPanel").then((m) => ({ default: m.TournamentRegistrationsPanel })),
);
const RegistrationView = lazy(() =>
  import("@/components/registration/RegistrationView").then((m) => ({ default: m.RegistrationView })),
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
/** The tournament's creator gets the set-up tools (the database lets them write these). */
export function canHostSetup(tournament: { id?: string; created_by?: string | null } | null | undefined, userId: string | null | undefined): boolean {
  return !!tournament?.id && !!userId && tournament.created_by === userId;
}

/** The Registration view: host, plus ORGANIZER officials (the RPCs check rights again). */
export function canManageRegistration(tournament: any, userId: string | null | undefined, organiser: boolean): boolean {
  return isRegistrationFlagOn(tournament) && (canHostSetup(tournament, userId) || organiser);
}

export function HostSetupSections({ tournament, heading = true, organiser = false }: { tournament: any; heading?: boolean; organiser?: boolean }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const isHost = canHostSetup(tournament, userId);
  const registration = canManageRegistration(tournament, userId, organiser);
  if (!isHost && !registration) return null;

  const isTeam = tournament.format_family === "TEAM";

  return (
    <div className="space-y-3">
      {heading && <h3 className="px-1 text-xs font-black uppercase tracking-wider text-muted-foreground">Set-up</h3>}

      {registration && (
        <CollapsibleSection
          bare
          title="Registration"
          icon={<ClipboardCheck />}
          summary="Timeline, categories, entries, reminders and sharing"
          defaultOpen={typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "registration"}
        >
          <Loading>
            <RegistrationView tournament={tournament} />
          </Loading>
        </CollapsibleSection>
      )}

      {isHost && tournament.require_app_registration && (
        <CollapsibleSection
          bare
          title="Registrations"
          icon={<ClipboardCheck />}
          summary="Older sign-ups waiting for approval"
        >
          <Loading>
            <TournamentRegistrationsPanel tournament={tournament} />
          </Loading>
        </CollapsibleSection>
      )}

      {isHost && !isTeam && (
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

      {isHost && (
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
      )}
    </div>
  );
}
