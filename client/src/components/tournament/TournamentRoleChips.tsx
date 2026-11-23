import { Award, Shield } from "lucide-react";
import type { MyRole } from "@/hooks/useMyTournamentRoles";

const CHIP = "inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md";

/** The signed-in user's roles in one tournament: organiser, official, entry. */
export function TournamentRoleChips({ role, className = "" }: { role: MyRole; className?: string }) {
  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {(role.isCreator || role.roles.has("ORGANIZER")) && (
        <span className={`${CHIP} bg-individual/15 text-individual`}>
          <Shield className="w-3 h-3" aria-hidden="true" /> Organizer
        </span>
      )}
      {role.roles.has("REFEREE") && <span className={`${CHIP} bg-warning/15 text-warning`}>Referee</span>}
      {role.roles.has("UMPIRE") && <span className={`${CHIP} bg-info/15 text-info`}>Umpire</span>}
      {role.registration && (
        <span
          className={`${CHIP} ${
            role.registration === "approved"
              ? "bg-success/15 text-success"
              : role.registration === "pending"
              ? "bg-warning/15 text-warning"
              : "bg-muted text-soft"
          }`}
        >
          <Award className="w-3 h-3" aria-hidden="true" />
          {role.registration === "approved" ? "Registered" : `Entry: ${role.registration}`}
        </span>
      )}
    </div>
  );
}
