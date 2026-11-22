import { tournamentLink } from "@/lib/tournamentRoutes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tournamentService } from "@/services/tournamentService";
import { fetchPlayerList } from "@/services/playerService";
import { adminService } from "@/services/adminService";
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

// In-app only lands in the bell list; the phone pop-up comes from Push, which
// dispatch-scheduled-notifications sends on its 2-minute cron.
const CHANNELS: { key: Channel; label: string; icon: typeof Mail; note: string }[] = [
  { key: "in_app", label: "In-app", icon: MonitorSmartphone, note: "Bell list, no pop-up" },
  { key: "push", label: "Push", icon: Smartphone, note: "Phone pop-up, within 2 min" },
  { key: "email", label: "Email", icon: Mail, note: "Within 2 min" },
];

const DEFAULT_CHANNELS: Channel[] = ["in_app", "push"];

/** scheduled_notifications.audience only allows all / tournament / team / custom. */
function storedAudience(a: Audience): "tournament" | "custom" {
  return a === "tournament" ? "tournament" : "custom";
}

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
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
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
    setChannels(DEFAULT_CHANNELS);
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
    try {
      const [plData, partData, offData, matchData] = await Promise.all([
        fetchPlayerList(),
        tournamentService.fetchTournamentParticipants(tournament.id),
        tournamentService.fetchTournamentOfficials(tournament.id),
        tournamentService.fetchTournamentMatches(tournament.id),
      ]);
      setPlayers((plData as any) ?? []);
      setParticipantIds(
        Array.from(new Set((partData ?? []).map((r) => r.player_id).filter(Boolean))),
      );
      setOfficialIds(
        Array.from(new Set((offData ?? []).map((r: any) => r.user_id).filter(Boolean))),
      );
      const filteredMatches = (matchData ?? []).filter((m) =>
        m.status === "scheduled" || m.status === "in_progress"
      );
      setAllMatches(filteredMatches as MatchForReminder[]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load reminder data");
    } finally {
      setLoading(false);
    }
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
        audience: storedAudience(audience),
        recipient_ids: recipients,
        scheduled_at: scheduledAt.toISOString(),
        status: queuedChannels.length === 0 ? "sent" : "pending",
        sent_at: queuedChannels.length === 0 ? new Date().toISOString() : null,
      };
      await adminService.queueScheduledNotification(queueRow);

      // 2. Immediate in-app fan-out (works today without the dispatcher).
      if (deliverInAppNow) {
        const link = tournament.id ? tournamentLink(tournament) : "/tournaments";
        const rows = recipients.map((uid) => ({
          user_id: uid,
          title: title.trim(),
          message: body.trim(),
          type: "tournament_reminder",
          link,
          is_read: false,
        }));
        await adminService.createInAppNotifications(rows);
        window.dispatchEvent(new Event("notifications_changed"));
      }

      if (isImmediate) {
        const who = `${recipients.length} ${recipients.length === 1 ? "person" : "people"}`;
        const later = queuedChannels.includes("push")
          ? "phone pop-up within 2 min"
          : queuedChannels.includes("email")
            ? "email within 2 min"
            : "";
        toast.success(
          deliverInAppNow
            ? `In-app sent to ${who}` + (later ? ` · ${later}` : " · no pop-up (Push was off)")
            : `Sending to ${who} · ${later || "within 2 min"}`,
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
    "w-full bg-muted border border-border-strong rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40 text-foreground";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-media/60 backdrop-blur-sm">
      <div className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl border border-border max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-foreground truncate">Send a reminder</h3>
            <p className="text-xs text-muted-foreground truncate">{tournament.name ?? "This tournament"}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-muted-foreground hover:text-soft rounded-lg hover:bg-muted transition shrink-0"
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
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Audience</p>
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
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <div className={`text-sm font-black leading-tight ${active ? "text-primary" : "text-soft"}`}>
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
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Time window</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_WINDOWS.map((tw) => (
                      <button key={tw.label} type="button" onClick={() => setMatchTimeWindow(tw.mins)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          matchTimeWindow === tw.mins
                            ? "bg-primary/15 border-primary text-primary"
                            : "bg-muted border-border-strong text-soft hover:border-border-strong/90"
                        }`}>
                        {tw.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format pills */}
                {availableCats.length > 1 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Format</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCats.map((cat) => (
                        <button key={cat} type="button" onClick={() => toggleCatFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                            matchCatFilter.has(cat)
                              ? "bg-info/15 border-info text-info"
                              : "bg-muted border-border-strong text-soft hover:border-border-strong/90"
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
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Courts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCourts.map((c) => (
                        <button key={c} type="button" onClick={() => toggleCourtFilter(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                            matchCourtFilter.has(c)
                              ? "bg-success/15 border-success text-success"
                              : "bg-muted border-border-strong text-soft hover:border-border-strong/90"
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
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
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
                          className="text-[10px] font-bold text-warning hover:underline">
                          Auto-fill message
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border-strong p-1.5">
                    {filteredMatches.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No matches found for these filters</p>
                    ) : (
                      filteredMatches.map((m) => {
                        const sel = selectedMatchIds.has(m.id);
                        return (
                          <button key={m.id} type="button" onClick={() => toggleMatchSelect(m.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${
                              sel ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                            }`}>
                            {sel
                              ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                              : <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black text-primary bg-primary/10 px-1 py-0.5 rounded">
                                  {CAT_LABELS_SHORT[m.category] ?? m.category}
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground">{m.match_code}</span>
                                {m.court_number && (
                                  <span className="text-[10px] text-muted-foreground">C{m.court_number}</span>
                                )}
                                {m.scheduled_at && (
                                  <span className="text-[10px] text-muted-foreground">{formatMatchTime(m.scheduled_at)}</span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-soft truncate">
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
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Channels</p>
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
                        : "border-border text-muted-foreground hover:border-border-strong"
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
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">When</p>
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
                        : "border-border text-soft hover:border-border-strong"
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
        <div className="px-4 sm:px-5 py-3 border-t border-border flex items-center justify-between gap-2 shrink-0">
          <span className={`text-xs min-w-0 truncate ${recipients.length === 0 && !loading ? "text-warning font-bold" : "text-muted-foreground"}`}>
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
