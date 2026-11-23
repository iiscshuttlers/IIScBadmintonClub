/** Short UI texts for registration screens (notice texts live in registrationMessages.ts). */
import type { RegistrationWindow } from "@/lib/registration/window";
import { formatIST } from "../../../../supabase/functions/_shared/registrationMessages";

export { categoryLabel, formatIST } from "../../../../supabase/functions/_shared/registrationMessages";

export function stateText(w: RegistrationWindow | undefined): string {
  if (!w) return "";
  switch (w.state) {
    case "open": return w.closesAt ? `Open · closes ${formatIST(w.closesAt)}` : "Open";
    case "closing_soon": return `Closing soon · ${formatIST(w.closesAt)}`;
    case "not_open": return w.opensAt ? `Opens ${formatIST(w.opensAt)}` : "Not open yet";
    case "locked":
      return w.lockReason === "draw" ? "Draw made" : w.lockReason === "deadline" ? "Entries closed" : "Locked by the organiser";
    default: return "Not taking entries";
  }
}

/** Badge tone per state (semantic tokens). */
export function stateTone(w: RegistrationWindow | undefined): string {
  switch (w?.state) {
    case "open": return "bg-success/15 text-success";
    case "closing_soon": return "bg-warning/15 text-warning";
    case "locked": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

const REFUSALS: Record<string, string> = {
  not_open: "This category isn't open yet.",
  locked: "This category is locked.",
  closing_soon: "",
  hidden: "This tournament isn't taking entries.",
  unknown_category: "That category isn't part of this tournament.",
  unknown_partner: "That player can't be found.",
  guest_name_required: "Add your partner's name.",
  self: "You can't pick yourself.",
  gender: "That pair doesn't fit this category's gender rules.",
  events_limit: "That would go over the events limit for this tournament.",
  partner_waitlisted: "That player is on the waitlist for this category.",
  no_pair: "You're not in a pair in this category.",
  not_entered: "You're not entered in this category.",
  use_withdraw: "Entries are still open: use Withdraw instead.",
  not_doubles: "Partners are only for doubles.",
  draw_exists: "The draw is already made.",
  needs_new_deadline: "Set a new deadline in the future to reopen.",
};

export function refusalText(reason: string | undefined | null): string {
  return (reason && REFUSALS[reason]) || "That didn't work. Please try again.";
}
