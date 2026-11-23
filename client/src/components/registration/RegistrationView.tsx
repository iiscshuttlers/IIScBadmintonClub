/**
 * Organiser "Registration" view (in-app registration, flag on). Mounted in the
 * Tournament Manager (Players tab) and the Organiser panel's Set-up (host and
 * ORGANIZER officials). Every write goes through the organiser RPCs, which
 * check rights on the server and also work after a category is locked.
 *
 * 1. Timeline: opens / closes, Lock all, Reopen all, Remind all incomplete,
 *    payment, events limit, fallback form link.
 * 2. Categories: state, count, waitlist, Lock/Unlock, visibility, cap, "N no
 *    partner · M shared" + Remind.
 * 3. Entries: filters, Remind, add / remove, CSV export.
 * 4. Duplicates banner, late withdrawal requests, backup copy status, share kit.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Lock, Megaphone, Printer, Share2, Unlock } from "lucide-react";
import {
  useCategorySettings, useOrganiserRegistration, usePartnerConflicts, usePickerPlayers, useRegistrationAttention,
  useRegistrationEntries, useRegistrationMutation, useRegistrationWindows,
} from "@/hooks/useRegistration";
import {
  organiserRemoveEntry, organiserSaveEntry, promoteFromWaitlist, resolveWithdrawalRequest, setCategoryLock,
  setCategorySettings, setRegistrationTimeline,
} from "@/services/tournament/registrationEntries";
import { isDoublesCategory } from "@/lib/registration/partners";
import { myEntryPath, tournamentPath } from "@/lib/tournamentRoutes";
import { posterHtml, publicLink } from "@/lib/registration/poster";
import type { EntriesVisibility, EntryRowData, RegistrationTournament, ReminderKind } from "@/types/registration";
import { BACKUP_CSV_HEADER, closingTomorrowText, csvRow, shareText } from "../../../../supabase/functions/_shared/registrationMessages";
import { RegistrationReminderSheet, type ReminderRecipient } from "./RegistrationReminderSheet";
import { categoryLabel, formatIST, refusalText, stateText, stateTone } from "./registrationText";

type Filter = "all" | "no_partner" | "shared" | "guest" | "gender";

const VIS_OPTIONS: { value: EntriesVisibility | ""; label: string }[] = [
  { value: "", label: "Same as tournament" },
  { value: "as_entered", label: "As players enter" },
  { value: "after_close", label: "After entries close" },
  { value: "after_draw", label: "After the draw" },
  { value: "hidden", label: "Hidden" },
];

/** ISO -> value for <input type="datetime-local"> (local time). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const names = (r: EntryRowData) =>
  [r.player?.full_name, r.partner?.full_name].filter(Boolean).join(" & ") || r.display_name || "Entry";

export function RegistrationView({ tournament: t }: { tournament: RegistrationTournament }) {
  const windows = useRegistrationWindows(t);
  const { data: settings } = useCategorySettings(t);
  const { data: rows } = useRegistrationEntries(t);
  const { data: attention } = useRegistrationAttention(t);
  const { data: conflicts } = usePartnerConflicts(t);
  const { data: org } = useOrganiserRegistration(t);
  const [adding, setAdding] = useState<string | null>(null);
  const { data: players } = usePickerPlayers(!!adding);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<{ kind: ReminderKind; category: string | null; ids?: string[] } | null>(null);
  const [opens, setOpens] = useState(toLocalInput(t.registration_opens_at));
  const [closes, setCloses] = useState(toLocalInput(t.form_close_date));
  const [addPlayer, setAddPlayer] = useState("");
  const [addPartner, setAddPartner] = useState("");

  const write = useRegistrationMutation(t.id, (fn: () => Promise<unknown>) => fn());
  const run = (fn: () => Promise<unknown>, ok: string) =>
    write.mutate(fn, {
      onSuccess: (res) => {
        const r = res as { status?: string; reason?: string; warnings?: { kind: string; player_name?: string; with_name?: string }[] };
        if (r?.status === "refused") return void toast.error(refusalText(r.reason));
        for (const w of r?.warnings ?? []) {
          toast.warning(w.kind === "taken" ? `${w.player_name} is also entered with ${w.with_name}` : w.kind === "gender" ? "Gender rules don't fit this pair" : "Over the events limit");
        }
        toast.success(ok);
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Something went wrong"),
    });

  const allRows = Array.isArray(rows) ? rows : [];
  const att = attention ?? { noPartner: [], sharedPartner: [], partnerNotOnApp: [], genderMismatch: [], genderUnknown: [] };
  const lastReminded = useMemo(() => new Map<string, string>(), []);
  const settingFor = (cat: string) => (Array.isArray(settings) ? settings : []).find((s) => s.category === cat);
  const playerName = (id: string | null | undefined) => {
    if (!id) return "";
    const r = allRows.find((x) => x.player_id === id || x.partner_id === id);
    return (r?.player_id === id ? r?.player?.full_name : r?.partner?.full_name) ?? "A player";
  };
  const isGuest = (id: string) => {
    const r = allRows.find((x) => x.player_id === id || x.partner_id === id);
    return !!(r?.player_id === id ? r?.player?.is_guest : r?.partner?.is_guest);
  };

  /** Recipients the sheet previews (the server recomputes them anyway). */
  const recipientsFor = (kind: ReminderKind, category: string | null, ids?: string[]): ReminderRecipient[] => {
    const out: ReminderRecipient[] = [];
    const inCat = (c: string) => !category || c === category;
    const deadline = (c: string) => windows[c]?.closesAt ?? null;
    if (kind !== "shared_partner") {
      for (const n of att.noPartner.filter((x) => inCat(x.category))) {
        out.push({ playerId: n.player_id, name: playerName(n.player_id), category: n.category, isGuest: isGuest(n.player_id),
          payload: { kind: "incomplete_entry_manual", tournament_name: t.name, category: n.category, reason: "no_partner", looking: n.looking, deadline: deadline(n.category) } });
      }
    }
    if (kind !== "no_partner") {
      for (const s of att.sharedPartner.filter((x) => inCat(x.category))) {
        const others = s.other_player_ids.filter((o): o is string => !!o);
        out.push({ playerId: s.shared_player_id, name: playerName(s.shared_player_id), category: s.category, isGuest: isGuest(s.shared_player_id),
          payload: { kind: "incomplete_entry_manual", tournament_name: t.name, category: s.category, reason: "shared_player", pair_names: others.map(playerName) } });
        for (const o of others) {
          out.push({ playerId: o, name: playerName(o), category: s.category, isGuest: isGuest(o),
            payload: { kind: "incomplete_entry_manual", tournament_name: t.name, category: s.category, reason: "shared_pair",
              partner_name: playerName(s.shared_player_id), other_name: others.filter((x) => x !== o).map(playerName).join(", ") } });
        }
      }
    }
    const seen = new Set<string>();
    return out.filter((r) => (!ids || ids.includes(r.playerId)) && !seen.has(r.playerId + r.category) && seen.add(r.playerId + r.category))
      .map((r) => ({ ...r, lastRemindedAt: lastReminded.get(r.playerId + r.category) ?? null }));
  };

  const filtered = allRows.filter((r) => {
    if (filter === "no_partner") return att.noPartner.some((n) => n.row_id === r.id);
    if (filter === "shared") return att.sharedPartner.some((s) => s.row_ids.includes(r.id));
    if (filter === "guest") return att.partnerNotOnApp.some((n) => n.row_id === r.id);
    if (filter === "gender") return [...att.genderMismatch, ...att.genderUnknown].some((n) => n.row_id === r.id);
    return true;
  });
  const filterIds = (f: Filter) =>
    f === "no_partner" ? att.noPartner.map((n) => n.player_id)
    : f === "shared" ? att.sharedPartner.flatMap((s) => [s.shared_player_id, ...s.other_player_ids.filter((o): o is string => !!o)])
    : [];

  // Shares and the poster use the public https site, so they also work when copied from the Android app.
  const link = publicLink(tournamentPath(t.id));
  const shareCats = (t.categories ?? []).map((c) => ({ category: c, closesAt: windows[c]?.closesAt, state: windows[c]?.state }));
  const share = async (text: string) => {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success("Copied: paste it into WhatsApp"); }
    } catch { /* share sheet closed */ }
  };
  const exportCsv = () => {
    const lines = [csvRow(["Category", "Player", "Partner", "Source", "Looking for a partner", "Entered (IST)"]),
      ...allRows.map((r) => csvRow([r.category, r.player?.full_name, r.partner?.full_name, r.source, r.looking_for_partner ? "yes" : "", formatIST(r.created_at, { withYear: true })]))];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `entries-${(t.name ?? "tournament").replace(/\W+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  void BACKUP_CSV_HEADER;
  const openPoster = async () => {
    const entryLink = publicLink(myEntryPath(t.id));
    const { toString: qrToString } = await import("qrcode");
    const qrSvg = await qrToString(entryLink, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
    const html = posterHtml({
      tournament: t.name ?? "Tournament",
      categories: shareCats
        .filter((c) => c.state === "open" || c.state === "closing_soon" || c.state === "not_open")
        .map((c) => ({ label: categoryLabel(c.category), closes: c.closesAt ? formatIST(c.closesAt) : null })),
      link: entryLink,
      qrSvg,
    });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      // Pop-ups blocked (or the app's webview): save the page instead; it prints from any browser.
      const a = document.createElement("a");
      a.href = url;
      a.download = `poster-${(t.name ?? "tournament").replace(/\W+/g, "-")}.html`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const pending = (org?.withdrawals ?? []).filter((w) => w.status === "pending" || w.status === "waiting_opponent");

  return (
    <div className="space-y-4" data-testid="registration-view">
      {/* Duplicates */}
      {Array.isArray(conflicts) && conflicts.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground" role="alert" data-testid="duplicates-banner">
          <div className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Players in two pairs</div>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {conflicts.map((c) => (
              <li key={c.category + c.shared_player_id}>{c.shared_name} is in {c.row_ids.length} {categoryLabel(c.category)} pairs (with {c.other_names.filter(Boolean).join(" and ")}).</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Timeline */}
      <section className="rounded-3xl border border-border bg-card p-4" aria-label="Timeline">
        <h3 className="text-sm font-black text-foreground">Timeline</h3>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs font-bold text-muted-foreground">Entries open
            <input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-2 py-1.5 text-sm text-foreground" />
          </label>
          <label className="text-xs font-bold text-muted-foreground">Entries close
            <input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-2 py-1.5 text-sm text-foreground" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={write.isPending} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground"
            onClick={() => run(() => setRegistrationTimeline(t.id, { opens_at: fromLocalInput(opens), closes_at: fromLocalInput(closes) }), "Timeline saved")}>Save dates</button>
          <button type="button" disabled={write.isPending} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-soft"
            onClick={() => run(() => setRegistrationTimeline(t.id, { action: "lock_all" }), "Every category locked")}><Lock className="h-3.5 w-3.5" aria-hidden /> Lock all</button>
          <button type="button" disabled={write.isPending} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-soft"
            onClick={() => run(() => setRegistrationTimeline(t.id, { action: "reopen_all", closes_at: fromLocalInput(closes) }), "Reopened (categories without a draw)")}><Unlock className="h-3.5 w-3.5" aria-hidden /> Reopen</button>
          <button type="button" className="inline-flex items-center gap-1 rounded-xl border border-primary/40 px-3 py-2 text-xs font-bold text-primary"
            onClick={() => setSheet({ kind: "all_incomplete", category: null })}><Megaphone className="h-3.5 w-3.5" aria-hidden /> Remind all incomplete</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-soft">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={!!t.collect_payment} onChange={(e) => run(() => setRegistrationTimeline(t.id, { collect_payment: e.target.checked }), "Saved")} /> Collect payment
          </label>
          <label className="inline-flex items-center gap-1.5">Events per player
            <input type="number" min={0} defaultValue={t.max_events_per_player ?? ""} aria-label="Events per player"
              onBlur={(e) => run(() => setRegistrationTimeline(t.id, { max_events_per_player: e.target.value ? Number(e.target.value) : null }), "Saved")}
              className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-foreground" />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Fallback form (only if the site is down): {t.form_url ? <a href={t.form_url} target="_blank" rel="noreferrer" className="font-bold text-primary">{t.form_url}</a> : "not set (Settings)"}.
          {org?.backup && <> · Backup copies: {org.backup.copied} copied{org.backup.failed ? `, ${org.backup.failed} failed` : ""}{org.backup.pending ? `, ${org.backup.pending} waiting` : ""}.</>}
        </p>
      </section>

      {/* 2. Categories */}
      <section className="rounded-3xl border border-border bg-card p-4" aria-label="Categories">
        <h3 className="text-sm font-black text-foreground">Categories</h3>
        <ul className="mt-2 divide-y divide-border">
          {(t.categories ?? []).map((cat) => {
            const w = windows[cat];
            const s = settingFor(cat);
            const count = allRows.filter((r) => r.category === cat).length;
            const wait = (org?.waitlist ?? []).filter((x) => x.category === cat).length;
            const np = att.noPartner.filter((n) => n.category === cat).length;
            const sh = att.sharedPartner.filter((n) => n.category === cat).length;
            const locked = w?.state === "locked";
            return (
              <li key={cat} className="py-3" data-testid={`category-row-${cat}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-black text-foreground">{categoryLabel(cat)} <span className="font-semibold text-muted-foreground">· {count} entered{s?.max_entries ? ` / ${s.max_entries}` : ""}{wait ? ` · ${wait} waiting` : ""}</span></span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${stateTone(w)}`}>{stateText(w)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {locked ? (
                    <button type="button" disabled={write.isPending || w?.lockReason === "draw"} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 font-bold text-soft disabled:opacity-50"
                      onClick={() => {
                        const needDate = w?.lockReason === "deadline";
                        const v = needDate ? window.prompt("New deadline (YYYY-MM-DD HH:MM, your time)") : null;
                        if (needDate && !v) return;
                        run(() => setCategoryLock(t.id, cat, false, v ? new Date(v.replace(" ", "T")).toISOString() : null), `${categoryLabel(cat)} reopened`);
                      }}><Unlock className="h-3 w-3" aria-hidden /> Unlock</button>
                  ) : (
                    <button type="button" disabled={write.isPending} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 font-bold text-soft"
                      onClick={() => run(() => setCategoryLock(t.id, cat, true), `${categoryLabel(cat)} locked`)}><Lock className="h-3 w-3" aria-hidden /> Lock</button>
                  )}
                  <select aria-label={`${cat} visibility`} value={s?.entries_visibility ?? ""} className="rounded-lg border border-border bg-card px-2 py-1 text-foreground"
                    onChange={(e) => run(() => setCategorySettings(t.id, cat, { entries_visibility: (e.target.value || null) as EntriesVisibility | null }), "Visibility saved")}>
                    {VIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input type="number" min={0} aria-label={`${cat} cap`} placeholder="Cap" defaultValue={s?.max_entries ?? ""}
                    onBlur={(e) => run(() => setCategorySettings(t.id, cat, { max_entries: e.target.value ? Number(e.target.value) : null }), "Cap saved")}
                    className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-foreground" />
                  {wait > 0 && locked && (
                    <button type="button" className="rounded-lg border border-border px-2 py-1 font-bold text-soft"
                      onClick={() => run(() => promoteFromWaitlist(t.id, cat), "Moved up the next waitlisted entry")}>Move up next</button>
                  )}
                  {isDoublesCategory(cat) && (np > 0 || sh > 0) && (
                    <span className="text-muted-foreground">
                      {np} no partner · {sh} shared
                      <button type="button" disabled={locked} className="ml-2 font-bold text-primary disabled:opacity-50"
                        onClick={() => setSheet({ kind: "all_incomplete", category: cat })}>Remind</button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3. Entries */}
      <section className="rounded-3xl border border-border bg-card p-4" aria-label="Entries">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-foreground">Entries</h3>
          <div className="flex gap-2">
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-bold text-soft"><Download className="h-3 w-3" aria-hidden /> CSV</button>
            <button type="button" onClick={() => setAdding(adding ? null : (t.categories ?? [])[0] ?? null)} className="rounded-lg bg-primary px-2 py-1 text-xs font-black text-primary-foreground">Add entry</button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter entries">
          {([["all", "All"], ["no_partner", `No partner (${att.noPartner.length})`], ["shared", `Shared partner (${att.sharedPartner.length})`],
            ["guest", `Partner not on app (${att.partnerNotOnApp.length})`], ["gender", `Gender (${att.genderMismatch.length + att.genderUnknown.length})`]] as [Filter, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={`rounded-full px-3 py-1 text-xs font-bold ${filter === k ? "bg-primary text-primary-foreground" : "bg-muted text-soft"}`}>{label}</button>
          ))}
          {(filter === "no_partner" || filter === "shared") && filterIds(filter).length > 0 && (
            <button type="button" className="rounded-full border border-primary/40 px-3 py-1 text-xs font-bold text-primary"
              onClick={() => setSheet({ kind: filter === "shared" ? "shared_partner" : "no_partner", category: null })}>
              Remind ({new Set(filterIds(filter)).size})
            </button>
          )}
        </div>

        {adding && (
          <form className="mt-3 grid grid-cols-1 gap-2 rounded-2xl bg-muted/50 p-3 sm:grid-cols-4"
            onSubmit={(e) => { e.preventDefault(); if (!addPlayer) return; run(() => organiserSaveEntry({ tournamentId: t.id, category: adding, playerId: addPlayer, partnerId: addPartner || null }), "Entry saved"); setAddPlayer(""); setAddPartner(""); }}>
            <select aria-label="Category" value={adding} onChange={(e) => setAdding(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground">
              {(t.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label="Player" value={addPlayer} onChange={(e) => setAddPlayer(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground">
              <option value="">Player…</option>
              {(players ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            {isDoublesCategory(adding) ? (
              <select aria-label="Partner" value={addPartner} onChange={(e) => setAddPartner(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground">
                <option value="">No partner</option>
                {(players ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            ) : <span />}
            <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground">Save</button>
          </form>
        )}

        <ul className="mt-3 divide-y divide-border" data-testid="entries-list">
          {filtered.length === 0 && <li className="py-3 text-sm text-muted-foreground">No entries here.</li>}
          {filtered.map((r) => {
            const noPartner = att.noPartner.find((n) => n.row_id === r.id);
            const shared = att.sharedPartner.find((s) => s.row_ids.includes(r.id));
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{names(r)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.category} · {r.source === "app" ? "in the app" : r.source === "form" ? "form import" : "organiser"}
                    {noPartner && (noPartner.looking ? " · looking for a partner" : " · no partner")}
                    {shared && " · shared partner"}
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  {(noPartner || shared) && (
                    <button type="button" className="font-bold text-primary"
                      onClick={() => setSheet({ kind: shared ? "shared_partner" : "no_partner", category: r.category, ids: [r.player_id, r.partner_id].filter((x): x is string => !!x) })}>Remind</button>
                  )}
                  <button type="button" className="font-bold text-danger"
                    onClick={() => { if (window.confirm(`Remove ${names(r)} from ${r.category}?`)) run(() => organiserRemoveEntry(r.id), "Entry removed"); }}>Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Late withdrawals */}
      {pending.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-4" aria-label="Withdrawal requests">
          <h3 className="text-sm font-black text-foreground">Withdrawal requests</h3>
          <ul className="mt-2 divide-y divide-border">
            {pending.map((w) => {
              const drawn = windows[w.category]?.lockReason === "draw";
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="withdrawal-row">
                  <span className="text-foreground">
                    {w.player_ids.map(playerName).join(" & ")} · {w.category}{w.reason ? ` · "${w.reason}"` : ""}
                    {w.status === "waiting_opponent" && <span className="block text-xs text-muted-foreground">Walkover will apply when the opponent is known.</span>}
                  </span>
                  <span className="flex gap-2 text-xs">
                    {drawn ? (
                      <button type="button" className="font-bold text-primary" onClick={() => run(() => resolveWithdrawalRequest(w.id, "walkover"), "Walkover given")}>Give walkover</button>
                    ) : (
                      <button type="button" className="font-bold text-danger" onClick={() => run(() => resolveWithdrawalRequest(w.id, "remove"), "Entry removed")}>Remove entry</button>
                    )}
                    <button type="button" className="font-bold text-soft" onClick={() => run(() => resolveWithdrawalRequest(w.id, "dismiss"), "Dismissed")}>Dismiss</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Share kit */}
      <section className="rounded-3xl border border-border bg-card p-4" aria-label="Share">
        <h3 className="text-sm font-black text-foreground">Share</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => share(shareText(t.name ?? "the tournament", shareCats, link))}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-soft"><Share2 className="h-3.5 w-3.5" aria-hidden /> Share entries</button>
          <button type="button" onClick={() => share(closingTomorrowText(t.name ?? "the tournament", shareCats, link))}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-soft"><Share2 className="h-3.5 w-3.5" aria-hidden /> Closing soon</button>
          <button type="button" onClick={() => { void openPoster().catch(() => toast.error("Couldn't make the poster")); }}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-soft"><Printer className="h-3.5 w-3.5" aria-hidden /> Poster (A4)</button>
        </div>
      </section>

      {sheet && (
        <RegistrationReminderSheet
          tournamentId={t.id}
          kind={sheet.kind}
          category={sheet.category}
          recipients={recipientsFor(sheet.kind, sheet.category, sheet.ids)}
          locked={!!sheet.category && windows[sheet.category]?.state === "locked"}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
