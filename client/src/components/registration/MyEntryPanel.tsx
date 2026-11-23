/**
 * "My entry": a signed-in player controls their tournament entries here —
 * categories, partner (pick / join / ask), leaving a pair, withdrawing, the
 * "Looking for a partner" flag, partner requests and, after the lock,
 * "Can't play?". Every write goes through the registration RPCs, which re-check
 * everything on the server; this screen only explains the state.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { CalendarClock, Hourglass, LogIn, UserCheck, UserMinus, Users } from "lucide-react";
import {
  useMyRegistration, useMyWaitlistPositions, usePickerPlayers, useRegistrationEntries,
  useRegistrationMutation, useRegistrationWindows,
} from "@/hooks/useRegistration";
import {
  answerPartnerRequest, leaveMyPair, requestLateWithdrawal, requestPartner, saveMyEntries, withdrawMyEntry,
} from "@/services/tournament/registrationEntries";
import { isDoublesCategory } from "@/lib/registration/partners";
import { myEntryPath, tournamentPath } from "@/lib/tournamentRoutes";
import { rememberReturnUrl } from "@/lib/returnUrl";
import type { EntryRowData, RegistrationTournament, SaveEntryInput, SaveResult } from "@/types/registration";
import { PartnerPicker } from "./PartnerPicker";
import { categoryLabel, formatIST, refusalText, stateText, stateTone } from "./registrationText";

export interface MyEntryPanelProps {
  tournament: RegistrationTournament;
  /** The resolved player id (profile.id); null when signed out or without a profile. */
  playerId: string | null;
  playerGender?: string | null;
  signedIn: boolean;
  initialCategory?: string | null;
}

function otherName(row: EntryRowData, me: string): string | null {
  return row.player_id === me ? row.partner?.full_name ?? null : row.player?.full_name ?? null;
}

export function MyEntryPanel({ tournament: t, playerId, playerGender, signedIn, initialCategory }: MyEntryPanelProps) {
  const windows = useRegistrationWindows(t);
  const { data: mine } = useMyRegistration(t, playerId);
  const { data: positions } = useMyWaitlistPositions(t, playerId);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const { data: allRows } = useRegistrationEntries(t, !!pickerFor);
  const { data: players } = usePickerPlayers(!!pickerFor);
  const [notice, setNotice] = useState<Record<string, { text: string; askId?: string; askName?: string }>>({});
  const [cantPlayFor, setCantPlayFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const save = useRegistrationMutation(t.id, (entries: SaveEntryInput[]) => saveMyEntries(t.id, entries));
  const act = useRegistrationMutation(t.id, (fn: () => Promise<unknown>) => fn());

  const categories = useMemo(() => {
    const list = (t.categories ?? []).filter((c) => windows[c] && windows[c].state !== "hidden");
    // Open the linked category first.
    return initialCategory ? [...list].sort((a, b) => (a === initialCategory ? -1 : b === initialCategory ? 1 : 0)) : list;
  }, [t.categories, windows, initialCategory]);

  if (!signedIn || !playerId) {
    return (
      <div className="rounded-3xl border border-border bg-card p-5 text-center" data-testid="my-entry-signed-out">
        <LogIn className="mx-auto mb-2 h-8 w-8 text-primary" aria-hidden />
        <h3 className="text-lg font-black text-foreground">Sign in to enter</h3>
        <p className="mt-1 text-sm text-muted-foreground">Entries are made in the app, so every entry belongs to a player profile.</p>
        <Link href="/join" onClick={() => rememberReturnUrl(myEntryPath(t.id, initialCategory))}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Sign in to enter
        </Link>
      </div>
    );
  }

  const entries = mine?.entries ?? [];
  const requests = mine?.requests ?? [];
  const incoming = requests.filter((r) => r.to_player_id === playerId && r.status === "pending");
  const outgoing = requests.filter((r) => r.from_player_id === playerId);
  const busy = save.isPending || act.isPending;

  const handleResults = (results: SaveResult[]) => {
    for (const r of Array.isArray(results) ? results : []) {
      if (r.status === "taken" && r.with_name) {
        setNotice((n) => ({ ...n, [r.category]: { text: `Already entered with ${r.with_name}.`, askId: r.partner_id } }));
      } else if (r.status === "taken") {
        setNotice((n) => ({ ...n, [r.category]: { text: refusalText(r.reason ?? "partner_waitlisted") } }));
      } else if (r.status === "refused") {
        setNotice((n) => ({ ...n, [r.category]: { text: refusalText(r.reason) } }));
      } else {
        setNotice((n) => { const next = { ...n }; delete next[r.category]; return next; });
        setPickerFor(null);
        toast.success(
          r.status === "waitlisted" ? `${categoryLabel(r.category)}: you're on the waitlist (#${r.position ?? "?"})`
          : r.status === "joined" ? `${categoryLabel(r.category)}: you joined your partner's entry`
          : r.status === "unchanged" ? `${categoryLabel(r.category)}: saved`
          : `${categoryLabel(r.category)}: you're entered`,
        );
      }
    }
  };

  const doSave = (entry: SaveEntryInput) =>
    save.mutate([entry], { onSuccess: handleResults, onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save") });

  const run = (fn: () => Promise<{ status: string; reason?: string } | unknown>, ok: string, cat?: string) =>
    act.mutate(fn, {
      onSuccess: (res) => {
        const r = res as { status?: string; reason?: string } | undefined;
        if (r?.status === "refused") {
          if (cat) setNotice((n) => ({ ...n, [cat]: { text: refusalText(r.reason) } }));
          else toast.error(refusalText(r.reason));
        } else toast.success(ok);
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Something went wrong"),
    });

  return (
    <div className="space-y-4" data-testid="my-entry">
      {incoming.length > 0 && (
        <section className="rounded-3xl border border-primary/40 bg-primary/5 p-4" aria-label="Partner requests">
          <h3 className="text-sm font-black text-foreground">Partner requests</h3>
          <ul className="mt-2 space-y-2">
            {incoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3">
                <span className="text-sm text-foreground">
                  <strong>{r.from_player?.full_name ?? "A player"}</strong> asked you to partner in {categoryLabel(r.category)}.
                </span>
                <span className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => run(() => answerPartnerRequest(r.id, true), "You switched partner")}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">Switch</button>
                  <button type="button" disabled={busy} onClick={() => run(() => answerPartnerRequest(r.id, false), "You stayed with your entry")}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-soft disabled:opacity-50">Stay</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.filter((r) => r.status !== "accepted").slice(0, 5).map((r) => (
        <p key={r.id} className="rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground" data-testid="sent-request">
          {r.status === "pending" && <>You asked <strong className="text-foreground">{r.to_player?.full_name}</strong> to partner in {categoryLabel(r.category)}. Waiting for an answer.</>}
          {r.status === "declined" && <>{r.to_player?.full_name} stayed with their entry in {categoryLabel(r.category)}.</>}
          {r.status === "stale" && <>Your request to {r.to_player?.full_name} in {categoryLabel(r.category)} no longer applies{r.stale_reason ? ` (${r.stale_reason})` : ""}. Nothing changed.</>}
          {r.status === "expired" && <>Your request to {r.to_player?.full_name} in {categoryLabel(r.category)} expired when entries closed.</>}
        </p>
      ))}

      {categories.length === 0 && (
        <p className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">This tournament isn't taking entries right now.</p>
      )}

      {categories.map((cat) => {
        const w = windows[cat];
        const row = entries.find((e) => e.category === cat);
        const partner = row && playerId ? otherName(row, playerId) : null;
        const waitPos = (positions ?? []).find((p) => p.category === cat)?.waitlist_position;
        const doubles = isDoublesCategory(cat);
        const withdrawal = (mine?.withdrawals ?? []).find((x) => x.category === cat && ["pending", "waiting_opponent"].includes(x.status));
        const history = (mine?.events ?? []).filter((e) => e.category === cat).slice(0, 3);
        const n = notice[cat];
        return (
          <section key={cat} className="rounded-3xl border border-border bg-card p-4" data-testid={`entry-card-${cat}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-black text-foreground">{categoryLabel(cat)}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${stateTone(w)}`}>{stateText(w)}</span>
            </div>

            <div className="mt-2 text-sm text-soft">
              {row ? (
                doubles ? (partner ? <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden /> Entered with <strong className="text-foreground">{partner}</strong></span>
                  : <span className="inline-flex items-center gap-1.5"><UserCheck className="h-4 w-4" aria-hidden /> Entered, no partner yet</span>)
                : <span className="inline-flex items-center gap-1.5"><UserCheck className="h-4 w-4" aria-hidden /> You're entered</span>
              ) : waitPos ? (
                <span className="inline-flex items-center gap-1.5"><Hourglass className="h-4 w-4" aria-hidden /> On the waitlist: #{waitPos}</span>
              ) : (
                <span className="text-muted-foreground">Not entered</span>
              )}
            </div>

            {doubles && !playerGender && w?.canEdit && (
              <p className="mt-2 rounded-xl bg-warning/10 p-2 text-xs text-warning">
                Set your gender in your <Link href="/profile/setup" className="underline">profile</Link> so doubles pairs can be checked.
              </p>
            )}

            {n && (
              <div className="mt-2 rounded-xl bg-muted p-2 text-xs text-foreground" role="status">
                {n.text}
                {n.askId && (
                  <button type="button" disabled={busy} className="ml-2 font-bold text-primary"
                    onClick={() => run(() => requestPartner(t.id, cat, n.askId!), "Request sent", cat)}>
                    Ask them instead
                  </button>
                )}
              </div>
            )}

            {w?.canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!row && !waitPos && !doubles && (
                  <button type="button" disabled={busy} onClick={() => doSave({ category: cat })}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50">Enter</button>
                )}
                {doubles && (
                  <button type="button" disabled={busy} onClick={() => setPickerFor(pickerFor === cat ? null : cat)}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50">
                    {row || waitPos ? (partner ? "Change partner" : "Pick a partner") : "Enter with a partner"}
                  </button>
                )}
                {doubles && !row && !waitPos && (
                  <button type="button" disabled={busy} onClick={() => doSave({ category: cat, looking_for_partner: true })}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-soft disabled:opacity-50">Enter alone, looking for a partner</button>
                )}
                {doubles && row && !partner && (
                  <label className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-soft">
                    <input type="checkbox" checked={!!row.looking_for_partner} disabled={busy}
                      onChange={(e) => doSave({ category: cat, looking_for_partner: e.target.checked })} />
                    Looking for a partner
                  </label>
                )}
                {row && partner && (
                  <button type="button" disabled={busy} onClick={() => run(() => leaveMyPair(t.id, cat), "You left the pair; you're still entered", cat)}
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-soft disabled:opacity-50">
                    <UserMinus className="h-3.5 w-3.5" aria-hidden /> Leave pair
                  </button>
                )}
                {(row || waitPos) && (
                  <button type="button" disabled={busy} onClick={() => run(() => withdrawMyEntry(t.id, cat), `Withdrawn from ${categoryLabel(cat)}`, cat)}
                    className="rounded-xl border border-danger/40 px-3 py-2 text-xs font-bold text-danger disabled:opacity-50">Withdraw</button>
                )}
              </div>
            )}

            {pickerFor === cat && w?.canEdit && (
              <PartnerPicker
                category={cat}
                meId={playerId}
                myGender={playerGender}
                rows={(Array.isArray(allRows) ? allRows : []).filter((r) => r.category === cat)}
                players={Array.isArray(players) ? players : []}
                busy={busy}
                onPick={(id) => doSave({ category: cat, partner_id: id })}
                onAsk={(id, name) => run(() => requestPartner(t.id, cat, id), `Request sent to ${name}`, cat)}
                onGuest={(g) => doSave({ category: cat, guest_partner: g })}
                onCancel={() => setPickerFor(null)}
              />
            )}

            {w?.state === "locked" && row && (
              <div className="mt-3 text-xs text-muted-foreground">
                {w.lockReason === "draw" && (
                  <Link href={tournamentPath(t.id, undefined, { panel: "my-matches" })} className="mr-3 font-bold text-primary">See my matches</Link>
                )}
                {withdrawal ? (
                  <span>{withdrawal.status === "waiting_opponent" ? "Withdrawal requested: the walkover will apply when the opponent is known." : "Withdrawal requested. The organiser will decide."}</span>
                ) : cantPlayFor === cat ? (
                  <form className="mt-2 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => {
                    e.preventDefault();
                    run(() => requestLateWithdrawal(t.id, cat, reason), "Your request was sent to the organiser", cat);
                    setCantPlayFor(null); setReason("");
                  }}>
                    <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder="Reason (optional)" aria-label="Reason"
                      className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none" />
                    <button type="submit" disabled={busy} className="rounded-xl bg-danger px-3 py-2 text-xs font-black text-danger-foreground">Ask to withdraw</button>
                  </form>
                ) : (
                  <button type="button" onClick={() => setCantPlayFor(cat)} className="font-bold text-danger">Can't play?</button>
                )}
              </div>
            )}

            {history.length > 0 && (
              <ul className="mt-3 space-y-0.5 border-t border-border pt-2 text-[11px] text-faint">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-1.5">
                    <CalendarClock className="h-3 w-3" aria-hidden /> {formatIST(h.created_at)} · {h.action.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
