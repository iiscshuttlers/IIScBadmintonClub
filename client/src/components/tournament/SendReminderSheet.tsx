import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import {
  Bell, X, Send, Clock, Mail, Smartphone, MonitorSmartphone,
  Users, ShieldCheck, UserPlus, Loader2, CalendarClock, Plus, Trash2,
  Swords, CheckSquare, Square, MapPin,
} from "lucide-react";

type Channel = "in_app" | "email" | "push";
type Audience = "tournament" | "officials" | "matches" | "custom";

interface MatchForReminder {
  id: string;
  match_code: string;
  category: string;
  round_name: string;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  team1_label: string | null;
  team2_label: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
}

interface SendReminderSheetProps {
  open: boolean;
  onClose: () => void;
  tournament: { id: string; name?: string | null; slug?: string | null };
  /** Preselect recipients + custom audience (e.g. "remind this umpire"). */
  prefillPlayerIds?: string[];
  /** Optional starting title/body (e.g. a match reminder template). */
  defaultTitle?: string;
  defaultBody?: string;
  defaultAudience?: Audience;
}

const CHANNELS: { key: Channel; label: string; icon: typeof Mail; note: string }[] = [
  { key: "in_app", label: "In-app", icon: MonitorSmartphone, note: "Delivered instantly" },
  { key: "email", label: "Email", icon: Mail, note: "Queued for dispatch" },
  { key: "push", label: "Push", icon: Smartphone, note: "Queued for dispatch" },
];

const AUDIENCES: { key: Audience; label: string; desc: string; icon: typeof Users }[] = [
  { key: "tournament", label: "All participants", desc: "Everyone entered in this event", icon: Users },
  { key: "officials", label: "Officials", desc: "Assigned umpires & referees", icon: ShieldCheck },
  { key: "matches", label: "Match players", desc: "Select matches to notify", icon: Swords },
  { key: "custom", label: "Specific people", desc: "Pick players individually", icon: UserPlus },
];

const TIME_WINDOWS = [
  { label: "All", mins: 0 },
  { label: "Next 30m", mins: 30 },
  { label: "Next 1h", mins: 60 },
  { label: "Next 2h", mins: 120 },
  { label: "Today", mins: -1 },
];

const CAT_LABELS_SHORT: Record<string, string> = {
  MS: "MS", WS: "WS", MD: "MD", WD: "WD", XD: "XD",
  BS: "BS", GS: "GS", BD: "BD", GD: "GD",
};

function formatMatchTime(dt: string | null) {
  if (!dt) return "";
  return new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** Quick-schedule presets (minutes from now); 0 = send immediately. */
const PRESETS: { label: string; mins: number }[] = [
  { label: "Now", mins: 0 },
  { label: "+15 min", mins: 15 },
  { label: "+1 hour", mins: 60 },
  { label: "Custom", mins: -1 },
];

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function SendReminderSheet({
  open,
  onClose,
  tournament,
  prefillPlayerIds,
  defaultTitle = "",
  defaultBody = "",
  defaultAudience = "tournament",
}: SendReminderSheetProps) {
  const { profile } = useAuth();

  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(defaultBody);
  const [channels, setChannels] = useState<Channel[]>(["in_app"]);
  const [audience, setAudience] = useState<Audience>(
    prefillPlayerIds?.length ? "custom" : defaultAudience,
  );
  const [customIds, setCustomIds] = useState<string[]>(prefillPlayerIds ?? []);
  const [picker, setPicker] = useState("");
  const [presetMins, setPresetMins] = useState(0);
  const [customAt, setCustomAt] = useState(toLocalInput(new Date(Date.now() + 30 * 60000)));

  const [players, setPlayers] = useState<any[]>([]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [officialIds, setOfficialIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Match-based audience state
  const [allMatches, setAllMatches] = useState<MatchForReminder[]>([]);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [matchCourtFilter, setMatchCourtFilter] = useState<Set<string>>(new Set());
  const [matchCatFilter, setMatchCatFilter] = useState<Set<string>>(new Set());
  const [matchTimeWindow, setMatchTimeWindow] = useState(0);

  // Reset fields each time the sheet opens so stale state never leaks.
  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setBody(defaultBody);
    setChannels(["in_app"]);
    setAudience(prefillPlayerIds?.length ? "custom" : defaultAudience);
    setCustomIds(prefillPlayerIds ?? []);
    setPicker("");
    setPresetMins(0);
    setCustomAt(toLocalInput(new Date(Date.now() + 30 * 60000)));
    setSelectedMatchIds(new Set());
    setMatchCourtFilter(new Set());
    setMatchCatFilter(new Set());
    setMatchTimeWindow(0);
  }, [open, defaultTitle, defaultBody, defaultAudience, prefillPlayerIds]);

  const load = useCallback(async () => {
    setLoading(true);
    const [plRes, partRes, offRes, matchRes] = await Promise.all([
      supabase.from("players").select("id, full_name, avatar_url").is("deleted_at", null).order("full_name"),
      supabase.from("tournament_participants").select("player_id").eq("tournament_id", tournament.id),
      supabase.from("tournament_officials").select("user_id").eq("tournament_id", tournament.id),
      supabase.from("tournament_matches")
        .select("id, match_code, category, round_name, court_number, scheduled_at, status, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id")
        .eq("tournament_id", tournament.id)
        .in("status", ["scheduled", "in_progress"])
        .order("scheduled_at", { ascending: true, nullsFirst: false }),
    ]);
    setPlayers((plRes.data as any) ?? []);
    setParticipantIds(
      Array.from(new Set(((partRes.data as any[]) ?? []).map((r) => r.player_id).filter(Boolean))),
    );
    setOfficialIds(
      Array.from(new Set(((offRes.data as any[]) ?? []).map((r) => r.user_id).filter(Boolean))),
    );
    setAllMatches((matchRes.data as MatchForReminder[]) ?? []);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const nameOf = useCallback(
    (id: string) => players.find((p) => p.id === id)?.full_name ?? "Unknown",
    [players],
  );

  const matchRecipientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of allMatches) {
      if (!selectedMatchIds.has(m.id)) continue;
      if (m.player1_id) ids.add(m.player1_id);
      if (m.player2_id) ids.add(m.player2_id);
      if (m.player3_id) ids.add(m.player3_id);
      if (m.player4_id) ids.add(m.player4_id);
    }
    return Array.from(ids);
  }, [allMatches, selectedMatchIds]);

  const recipients = useMemo(() => {
    if (audience === "tournament") return participantIds;
    if (audience === "officials") return officialIds;
    if (audience === "matches") return matchRecipientIds;
    return customIds;
  }, [audience, participantIds, officialIds, matchRecipientIds, customIds]);

  const toggleChannel = (c: Channel) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const addCustom = () => {
    if (!picker) return;
    setCustomIds((prev) => (prev.includes(picker) ? prev : [...prev, picker]));
    setPicker("");
  };

  // Derived match data
  const availableCourts = useMemo(
    () => Array.from(new Set(allMatches.map((m) => m.court_number).filter(Boolean) as string[])).sort(),
    [allMatches],
  );
  const availableCats = useMemo(
    () => Array.from(new Set(allMatches.map((m) => m.category).filter(Boolean))).sort(),
    [allMatches],
  );

  const filteredMatches = useMemo(() => {
    const now = Date.now();
    return allMatches.filter((m) => {
      if (matchCourtFilter.size > 0 && (!m.court_number || !matchCourtFilter.has(m.court_number))) return false;
      if (matchCatFilter.size > 0 && !matchCatFilter.has(m.category)) return false;
      if (matchTimeWindow === -1) {
        // Today
        if (!m.scheduled_at) return false;
        const d = new Date(m.scheduled_at);
        const today = new Date();
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      }
      if (matchTimeWindow > 0) {
        if (!m.scheduled_at) return false;
        const t = new Date(m.scheduled_at).getTime();
        return t >= now && t <= now + matchTimeWindow * 60000;
      }
      return true;
    });
  }, [allMatches, matchCourtFilter, matchCatFilter, matchTimeWindow]);

  const toggleMatchSelect = (id: string) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      const allSelected = filteredMatches.every((m) => next.has(m.id));
      if (allSelected) {
        filteredMatches.forEach((m) => next.delete(m.id));
      } else {
        filteredMatches.forEach((m) => next.add(m.id));
      }
      return next;
    });
  };

  const autoFillFromMatches = () => {
    const selected = allMatches.filter((m) => selectedMatchIds.has(m.id));
    if (selected.length === 0) return;
    setTitle("Your match is coming up!");
    const lines = selected.map((m) => {
      const time = formatMatchTime(m.scheduled_at);
      const court = m.court_number ? `Court ${m.court_number}` : "TBD";
      const cat = CAT_LABELS_SHORT[m.category] ?? m.category;
      return `${cat} ${m.match_code}: ${m.team1_label ?? "TBD"} vs ${m.team2_label ?? "TBD"} — ${time || "Time TBD"}, ${court}`;
    });
    setBody("Please report to your court.\n\n" + lines.join("\n"));
  };

  const toggleCourtFilter = (court: string) => {
    setMatchCourtFilter((prev) => {
      const next = new Set(prev);
      if (next.has(court)) next.delete(court); else next.add(court);
      return next;
    });
  };

  const toggleCatFilter = (cat: string) => {
    setMatchCatFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const scheduledAt = useMemo(() => {
    if (presetMins === -1) return new Date(customAt);
    return new Date(Date.now() + presetMins * 60000);
  }, [presetMins, customAt]);

  const isImmediate = presetMins === 0;
  const scheduleValid = presetMins !== -1 || !isNaN(scheduledAt.getTime());
  const ready =
    !!title.trim() && !!body.trim() && channels.length > 0 && recipients.length > 0 && scheduleValid;

  const send = async () => {
    if (!title.trim()) return toast.error("Add a title");
    if (!body.trim()) return toast.error("Add a message");
    if (channels.length === 0) return toast.error("Pick at least one channel");
    if (recipients.length === 0) return toast.error("No recipients for this audience");
    if (presetMins === -1 && isNaN(scheduledAt.getTime())) return toast.error("Pick a valid date & time");

    setSending(true);
    try {
      const deliverInAppNow = isImmediate && channels.includes("in_app");

      // 1. Durable queue row. For an immediate in-app send we deliver it
      //    ourselves below, so drop in_app from the queued channels to stop the
      //    future dispatcher double-sending it; keep email/push pending.
      const queuedChannels = deliverInAppNow ? channels.filter((c) => c !== "in_app") : channels;
      const queueRow = {
        tournament_id: tournament.id,
        created_by: profile?.id ?? null,
        title: title.trim(),
        body: body.trim(),
        channels: queuedChannels.length ? queuedChannels : (["in_app"] as Channel[]),
        audience,
        recipient_ids: recipients,
        scheduled_at: scheduledAt.toISOString(),
        status: queuedChannels.length === 0 ? "sent" : "pending",
        sent_at: queuedChannels.length === 0 ? new Date().toISOString() : null,
      };
      const { error: qErr } = await supabase.from("scheduled_notifications").insert(queueRow as any);
      if (qErr) throw qErr;

      // 2. Immediate in-app fan-out (works today without the dispatcher).
      if (deliverInAppNow) {
        const link = tournament.slug ? `/events/${tournament.slug}` : "/pulse";
        const rows = recipients.map((uid) => ({
          user_id: uid,
          title: title.trim(),
          message: body.trim(),
          type: "tournament_reminder",
          link,
          is_read: false,
        }));
        const { error: nErr } = await supabase.from("notifications").insert(rows);
        if (nErr) throw nErr;
        window.dispatchEvent(new Event("notifications_changed"));
      }

      const queuedExtra = queuedChannels.filter((c) => c !== "in_app" || !deliverInAppNow);
      if (isImmediate) {
        toast.success(
          deliverInAppNow
            ? `Sent to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}` +
                (queuedExtra.length ? " · email/push queued" : "")
            : `Queued for ${recipients.length} ${recipients.length === 1 ? "person" : "people"}`,
        );
      } else {
        toast.success(`Scheduled for ${scheduledAt.toLocaleString()}`);
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not send");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const fieldCls =
    "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-800 dark:text-foreground truncate">Send a reminder</h3>
            <p className="text-xs text-muted-foreground truncate">{tournament.name ?? "This tournament"}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {/* Message */}
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title — e.g. Your match starts soon"
              className={`${fieldCls} font-bold`}
              maxLength={120}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message…"
              rows={3}
              className={`${fieldCls} resize-none`}
              maxLength={500}
            />
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Audience</p>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCES.map((a) => {
                const Icon = a.icon;
                const active = audience === a.key;
                const count = a.key === "tournament" ? participantIds.length : a.key === "officials" ? officialIds.length : a.key === "matches" ? matchRecipientIds.length : customIds.length;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAudience(a.key)}
                    className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? "text-primary" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <div className={`text-sm font-black leading-tight ${active ? "text-primary" : "text-slate-700 dark:text-slate-200"}`}>
                        {a.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {loading ? "…" : `${count} ${count === 1 ? "person" : "people"}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {audience === "custom" && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <PlayerSelect value={picker} onChange={setPicker} players={players} placeholder="Add a player…" className={fieldCls} />
                  </div>
                  <button aria-label="Add player"
                    onClick={addCustom}
                    disabled={!picker}
                    className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {customIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {customIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {nameOf(id)}
                        <button onClick={() => setCustomIds((p) => p.filter((x) => x !== id))} className="p-0.5 hover:bg-primary/20 rounded-full">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {audience === "matches" && (
              <div className="space-y-3 pt-1">
                {/* Time window pills */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Time window</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_WINDOWS.map((tw) => (
                      <button key={tw.label} type="button" onClick={() => setMatchTimeWindow(tw.mins)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          matchTimeWindow === tw.mins
                            ? "bg-primary/15 border-primary text-primary"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                        }`}>
                        {tw.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format pills */}
                {availableCats.length > 1 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Format</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCats.map((cat) => (
                        <button key={cat} type="button" onClick={() => toggleCatFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                            matchCatFilter.has(cat)
                              ? "bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                          }`}>
                          {CAT_LABELS_SHORT[cat] ?? cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Court pills — multi-select */}
                {availableCourts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Courts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCourts.map((c) => (
                        <button key={c} type="button" onClick={() => toggleCourtFilter(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                            matchCourtFilter.has(c)
                              ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                          }`}>
                          <MapPin className="w-3 h-3 inline mr-1" />C{c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Match list */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {filteredMatches.length} match{filteredMatches.length !== 1 ? "es" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      {filteredMatches.length > 0 && (
                        <button type="button" onClick={selectAllFiltered}
                          className="text-[10px] font-bold text-primary hover:underline">
                          {filteredMatches.every((m) => selectedMatchIds.has(m.id)) ? "Deselect all" : "Select all"}
                        </button>
                      )}
                      {selectedMatchIds.size > 0 && (
                        <button type="button" onClick={autoFillFromMatches}
                          className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                          Auto-fill message
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5">
                    {filteredMatches.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No matches found for these filters</p>
                    ) : (
                      filteredMatches.map((m) => {
                        const sel = selectedMatchIds.has(m.id);
                        return (
                          <button key={m.id} type="button" onClick={() => toggleMatchSelect(m.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${
                              sel ? "bg-primary/10 border border-primary/30" : "hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"
                            }`}>
                            {sel
                              ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                              : <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black text-primary bg-primary/10 px-1 py-0.5 rounded">
                                  {CAT_LABELS_SHORT[m.category] ?? m.category}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">{m.match_code}</span>
                                {m.court_number && (
                                  <span className="text-[10px] text-slate-400">C{m.court_number}</span>
                                )}
                                {m.scheduled_at && (
                                  <span className="text-[10px] text-slate-400">{formatMatchTime(m.scheduled_at)}</span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                {m.team1_label ?? "TBD"} vs {m.team2_label ?? "TBD"}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Channels */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Channels</p>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                const active = channels.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleChannel(c.key)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-black">{c.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-none text-center">{c.note}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timing */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">When</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = presetMins === p.mins;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPresetMins(p.mins)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    {p.mins === 0 ? <Send className="w-3.5 h-3.5" /> : p.mins === -1 ? <CalendarClock className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {p.label}
                  </button>
                );
              })}
            </div>
            {presetMins === -1 && (
              <input type="datetime-local" value={customAt} onChange={(e) => setCustomAt(e.target.value)} className={fieldCls} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <span className={`text-xs min-w-0 truncate ${recipients.length === 0 && !loading ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>
            {loading
              ? "Loading recipients…"
              : recipients.length === 0
                ? "No recipients for this audience"
                : `${recipients.length} ${recipients.length === 1 ? "recipient" : "recipients"} · ${channels.length} ${channels.length === 1 ? "channel" : "channels"}`}
          </span>
          <button
            onClick={send}
            disabled={sending || loading || !ready}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-black transition disabled:opacity-50 shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isImmediate ? "Send" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
