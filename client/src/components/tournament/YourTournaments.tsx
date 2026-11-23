import { useMemo } from "react";
import { Link } from "wouter";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MyMatchesStrip } from "@/components/tournament/MyMatchesStrip";
import { StatusChip } from "@/components/tournament/StatusChip";
import { TournamentRoleChips } from "@/components/tournament/TournamentRoleChips";
import { isPastStatus } from "@/lib/tournamentHub";
import { tournamentLink, tournamentManagePath, tournamentPath } from "@/lib/tournamentRoutes";
import type { MyRole } from "@/hooks/useMyTournamentRoles";

interface YourTournamentsProps {
  myPlayerId: string | null | undefined;
  /** Every tournament the hub shows; only live/upcoming ones with a role are listed. */
  tournaments: any[];
  myRoles: Map<string, MyRole>;
  isAdmin: boolean;
  /** Opens the entry (registration) sheet for a tournament. */
  onManageEntry: (t: any) => void;
}

const startTime = (t: any) => (t.startDate ? new Date(t.startDate).getTime() : Number.POSITIVE_INFINITY);

/**
 * The signed-in user's corner of the hub: their tournament matches, then the
 * live or upcoming tournaments they organise, officiate or entered, each with
 * its one next step. Finished tournaments stay in Results with a role badge.
 * Renders nothing (the card hides itself) when there is nothing to show.
 */
export function YourTournaments({ myPlayerId, tournaments, myRoles, isAdmin, onManageEntry }: YourTournamentsProps) {
  const mine = useMemo(
    () =>
      tournaments
        .filter((t) => myRoles.has(t.id) && !isPastStatus(t.status))
        .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || startTime(a) - startTime(b)),
    [tournaments, myRoles],
  );

  return (
    <section
      aria-label="Your matches and tournaments"
      className="empty:hidden bg-card/60 rounded-3xl border border-border p-4 sm:p-5 shadow-lg divide-y divide-border [&>*:not(:last-child)]:pb-4 [&>*+*]:pt-4"
    >
      <MyMatchesStrip myPlayerId={myPlayerId} limit={3} upcomingOnly />

      {mine.length > 0 && (
        <div>
          <h2 className="flex items-center gap-1.5 mb-2 text-xs font-black text-primary uppercase tracking-wider">
            <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> Your roles
          </h2>
          <ul className="space-y-2">
            {mine.map((t) => {
              const role = myRoles.get(t.id)!;
              const isOrganizer = role.isCreator || role.roles.has("ORGANIZER");
              const officialPanel = role.roles.has("REFEREE") ? "referee" : role.roles.has("UMPIRE") ? "umpire" : null;
              return (
                <li key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/60 border border-border-strong/60">
                  <div className="min-w-0 flex-1">
                    <Link href={tournamentLink(t)} className="block truncate text-sm font-bold text-foreground hover:text-primary">
                      {t.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <StatusChip state={t.status} compact />
                      <TournamentRoleChips role={role} />
                    </div>
                  </div>
                  {isOrganizer ? (
                    <Button asChild size="sm" variant="outline" className="shrink-0 border-border-strong">
                      <Link href={tournamentManagePath(t.id, isAdmin)}>Manage</Link>
                    </Button>
                  ) : officialPanel ? (
                    <Button asChild size="sm" variant="outline" className="shrink-0 border-border-strong">
                      <Link href={tournamentPath(t.id, null, { panel: officialPanel })}>Officiate</Link>
                    </Button>
                  ) : role.registration ? (
                    <Button size="sm" variant="outline" className="shrink-0 border-border-strong" onClick={() => onManageEntry(t)}>
                      Your entry
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
