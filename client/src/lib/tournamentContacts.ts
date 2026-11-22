/**
 * Who may see phone numbers for a tournament. The server enforces this in
 * get_tournament_contacts (migration 20261122120000); the client only uses it
 * to decide which buttons and panels to show.
 *
 *  - hidden:    nobody, officials and admins included;
 *  - officials: officials, the organiser and site admins (the default);
 *  - everyone:  also players, for their opponents and the officials.
 */
export type ContactsMode = "hidden" | "officials" | "everyone";

export const CONTACTS_MODES: readonly ContactsMode[] = ["hidden", "officials", "everyone"];

/** Reads site_data `tournament_contacts_<id>`, including the older boolean forms. */
export function parseContactsMode(value: unknown): ContactsMode {
  if (value && typeof value === "object") {
    const v = value as { mode?: unknown; enabled?: unknown };
    if (typeof v.mode === "string" && (CONTACTS_MODES as readonly string[]).includes(v.mode)) {
      return v.mode as ContactsMode;
    }
    if (v.enabled === true) return "everyone";
    return "officials";
  }
  return value === true ? "everyone" : "officials";
}

/** Finished tournaments release no contacts to anyone (server rule). */
export function isTournamentFinished(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "completed" || s === "archived" || s === "deleted";
}
