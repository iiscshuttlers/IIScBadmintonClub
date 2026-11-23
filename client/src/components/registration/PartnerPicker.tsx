/**
 * Pick a doubles partner. Each player shows where they stand in this category:
 * free (Pick), entered alone (Join), entered with someone (Ask), or you.
 * "Not on the app?" adds a guest partner by name (phone stays private).
 */
import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { disciplineOf } from "@/lib/matchView";
import { isFuzzyMatch } from "@/lib/utils";
import type { EntryRowData } from "@/types/registration";
import type { PickerPlayer } from "@/services/tournament/registrationEntries";

export type PickerStatus =
  | { kind: "free" }
  | { kind: "alone" }
  | { kind: "with"; withName: string }
  | { kind: "you" }
  | { kind: "current" };

/** Where a candidate stands in the category, from my point of view. */
export function pickerStatus(
  playerId: string,
  meId: string,
  rows: Pick<EntryRowData, "player_id" | "partner_id" | "player" | "partner">[],
): PickerStatus {
  if (playerId === meId) return { kind: "you" };
  const row = rows.find((r) => r.player_id === playerId || r.partner_id === playerId);
  if (!row) return { kind: "free" };
  const otherId = row.player_id === playerId ? row.partner_id : row.player_id;
  if (!otherId) return { kind: "alone" };
  if (otherId === meId) return { kind: "current" };
  const otherName = row.player_id === playerId ? row.partner?.full_name : row.player?.full_name;
  return { kind: "with", withName: otherName || "another player" };
}

/** The partner gender a category expects, given mine (null = anyone). */
export function wantedGender(category: string, myGender: string | null | undefined): "Male" | "Female" | null {
  const d = disciplineOf(category);
  if (d === "MD") return "Male";
  if (d === "WD") return "Female";
  if (d === "XD") return myGender === "Male" ? "Female" : myGender === "Female" ? "Male" : null;
  return null;
}

interface Props {
  category: string;
  meId: string;
  myGender?: string | null;
  rows: EntryRowData[];
  players: PickerPlayer[];
  busy?: boolean;
  onPick: (partnerId: string) => void;
  onAsk: (partnerId: string, name: string) => void;
  onGuest: (guest: { name: string; phone: string }) => void;
  onCancel: () => void;
}

export function PartnerPicker({ category, meId, myGender, rows, players, busy, onPick, onAsk, onGuest, onCancel }: Props) {
  const [query, setQuery] = useState("");
  const wanted = wantedGender(category, myGender);
  const [everyone, setEveryone] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const list = useMemo(() => {
    const q = query.trim();
    return players
      .filter((p) => everyone || !wanted || !p.gender || p.gender === wanted)
      .filter((p) => !q || isFuzzyMatch(q, p.full_name))
      .slice(0, 40);
  }, [players, query, everyone, wanted]);

  return (
    <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3" data-testid="partner-picker">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players"
          aria-label="Search players"
          className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
        />
      </div>
      {wanted && (
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
          Show everyone (not only {wanted === "Male" ? "men" : "women"})
        </label>
      )}

      <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
        {list.length === 0 && <li className="p-3 text-sm text-muted-foreground">No players match.</li>}
        {list.map((p) => {
          const st = pickerStatus(p.id, meId, rows);
          return (
            <li key={p.id} className="flex items-center justify-between gap-2 p-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{p.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {st.kind === "with" && `Entered with ${st.withName}`}
                  {st.kind === "alone" && "Entered alone: you can join"}
                  {st.kind === "free" && "Not entered yet"}
                  {st.kind === "current" && "Your partner"}
                  {st.kind === "you" && "You"}
                </div>
              </div>
              {st.kind === "with" ? (
                <button type="button" disabled={busy} onClick={() => onAsk(p.id, p.full_name)}
                  className="shrink-0 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50">
                  Ask
                </button>
              ) : st.kind === "free" || st.kind === "alone" ? (
                <button type="button" disabled={busy} onClick={() => onPick(p.id)}
                  className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {st.kind === "alone" ? "Join" : "Pick"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {guestOpen ? (
        <form
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); if (guestName.trim()) onGuest({ name: guestName.trim(), phone: guestPhone.trim() }); }}
        >
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Partner's name" aria-label="Partner's name"
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none" />
          <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Phone (only organisers see it)" aria-label="Partner's phone"
            inputMode="tel" className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none" />
          <button type="submit" disabled={busy || !guestName.trim()}
            className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50 sm:col-span-2">
            Enter with this partner
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setGuestOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
          <UserPlus className="h-3.5 w-3.5" aria-hidden /> Not on the app? Add name and phone
        </button>
      )}
      <div className="mt-2 text-right">
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}
