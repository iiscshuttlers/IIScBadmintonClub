/**
 * When a category's entries show in the Players tab (a screen rule, not a
 * database restriction: participant rows stay publicly readable).
 *
 * entries_visibility: as_entered | after_close | after_draw | hidden, or null
 * = inherit tournaments.show_participants (old tournaments and rows created by
 * triggers behave as before). With the registration flag off nothing changes.
 * A signed-in player always sees their own entry (handled by the caller).
 */
import type { RegistrationWindow } from "./window";

export type EntriesVisibility = "as_entered" | "after_close" | "after_draw" | "hidden";

export function categoryEntriesVisible(args: {
  flagOn: boolean;
  showParticipants: boolean | null | undefined;
  visibility: EntriesVisibility | null | undefined;
  window?: RegistrationWindow;
  hasDraw?: boolean;
}): boolean {
  const inherit = !!args.showParticipants;
  if (!args.flagOn || !args.visibility) return inherit;
  switch (args.visibility) {
    case "as_entered": return true;
    case "after_close": return args.window?.state === "locked" || !!args.hasDraw;
    case "after_draw": return !!args.hasDraw || args.window?.lockReason === "draw";
    case "hidden": return false;
    default: return inherit;
  }
}

/** Why a category's list isn't shown yet (viewer text). */
export function hiddenReason(visibility: EntriesVisibility | null | undefined): string {
  switch (visibility) {
    case "after_close": return "Entries show here once this category closes.";
    case "after_draw": return "Entries show here once the draw is made.";
    case "hidden": return "The organiser keeps this category's entries private.";
    default: return "The participants list has not been published yet.";
  }
}
