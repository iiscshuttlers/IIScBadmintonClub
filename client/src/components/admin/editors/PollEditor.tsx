import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Ban, Bell, CheckCircle2, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/services/adminService";
import { fetchTournaments } from "@/services/tournamentService";
import { tournamentPath } from "@/lib/tournamentRoutes";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { inputCls, labelCls, cardCls } from "./shared";
import { AUGUST_2026_TOURNAMENT_ID, type Poll } from "../../feed/PollsSection";
import { pollStatus } from "../content/contentModel";
import { StatusChip } from "../content/ContentSection";

export interface TournamentOption {
  id: string;
  name: string;
  status: string;
}

/** Tournaments a poll can belong to, newest first (drafts left out). */
export function useTournamentOptions(): TournamentOption[] {
  const [list, setList] = useState<TournamentOption[]>([]);
  useEffect(() => {
    let live = true;
    fetchTournaments()
      .then((ts) => {
        if (live) setList(ts.filter((t) => t.status !== "draft").map((t) => ({ id: t.id, name: t.name, status: t.status })));
      })
      .catch(() => {
        /* the picker falls back to "Not linked" */
      });
    return () => {
      live = false;
    };
  }, []);
  return list;
}

/** The tournament a new poll should default to: the newest one still running. */
export function defaultPollTournament(list: TournamentOption[]): string | undefined {
  return (list.find((t) => t.status !== "completed" && t.status !== "cancelled") ?? list[0])?.id;
}

export function newPoll(tournamentId?: string): Poll {
  return {
    id: crypto.randomUUID(),
    question: "",
    options: [
      { id: crypto.randomUUID(), text: "", votes: [] },
      { id: crypto.randomUUID(), text: "", votes: [] },
    ],
    created_at: new Date().toISOString(),
    is_active: true,
    tournament_id: tournamentId,
  };
}

const votesOf = (p: Poll) => (p.options ?? []).reduce((sum, o) => sum + (o.votes?.length || 0), 0);

/**
 * Tournament prediction polls (shown in a tournament's Live → Predict panel).
 * Votes are never written from here: on save they are taken from the database.
 */
export function PollEditor({
  data,
  onChange,
  tournaments,
  savedIds,
}: {
  data: Poll[];
  onChange: (d: Poll[]) => void;
  tournaments: TournamentOption[];
  /** Polls already in the database; a push for an unsaved poll would lead nowhere. */
  savedIds: Set<string>;
}) {
  const { session } = useAuth();
  const { confirm } = useConfirm();
  const [sendingPush, setSendingPush] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const updatePoll = (id: string, fields: Partial<Poll>) =>
    onChange(data.map((p) => (p.id === id ? { ...p, ...fields } : p)));

  const removePoll = async (poll: Poll) => {
    const votes = votesOf(poll);
    if (
      votes > 0 &&
      !(await confirm({
        title: "Delete poll",
        description: `“${poll.question || "Untitled poll"}” has ${votes} vote${votes === 1 ? "" : "s"}. Deleting it removes them too. Archive keeps the result instead.`,
        confirmLabel: "Delete",
      }))
    )
      return;
    onChange(data.filter((p) => p.id !== poll.id));
  };

  const setOption = (poll: Poll, optionId: string, text: string) =>
    updatePoll(poll.id, { options: poll.options.map((o) => (o.id === optionId ? { ...o, text } : o)) });
  const addOption = (poll: Poll) =>
    updatePoll(poll.id, { options: [...(poll.options ?? []), { id: crypto.randomUUID(), text: "", votes: [] }] });
  const removeOption = async (poll: Poll, optionId: string) => {
    const opt = poll.options.find((o) => o.id === optionId);
    const n = opt?.votes?.length ?? 0;
    if (
      n > 0 &&
      !(await confirm({
        title: "Remove option",
        description: `“${opt?.text || "This option"}” has ${n} vote${n === 1 ? "" : "s"}. Removing it deletes them.`,
        confirmLabel: "Remove",
      }))
    )
      return;
    updatePoll(poll.id, { options: poll.options.filter((o) => o.id !== optionId) });
  };

  const sendPush = async (poll: Poll) => {
    if (!poll.question.trim()) {
      toast.error("Write the question before notifying members.");
      return;
    }
    if (!savedIds.has(poll.id)) {
      toast.error("Save this poll first, so the notification opens it.");
      return;
    }
    if (
      !(await confirm({
        title: "Send push notification",
        description: "Tell every member with notifications on about this poll?",
        confirmLabel: "Send",
      }))
    )
      return;
    setSendingPush(poll.id);
    try {
      const res = await adminService.sendPushBroadcast({
        title: "New prediction poll",
        body: poll.question,
        url: tournamentPath(poll.tournament_id || AUGUST_2026_TOURNAMENT_ID, "live", { panel: "polls" }),
        admin_email: session?.user?.email ?? "admin",
      });
      toast.success(`Push sent to ${res?.sent ?? 0} devices.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send push");
    } finally {
      setSendingPush(null);
    }
  };

  const visible = data.filter((p) => showArchived || !p.is_archived);
  const archivedCount = data.length - data.filter((p) => !p.is_archived).length;

  return (
    <div className="space-y-4">
      {archivedCount > 0 && (
        <label className="flex w-max items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-3.5 w-3.5" />
          Show {archivedCount} archived poll{archivedCount === 1 ? "" : "s"}
        </label>
      )}

      {visible.map((poll) => {
        const total = votesOf(poll);
        const status = pollStatus(poll);
        return (
          <div key={poll.id} className={`${cardCls} space-y-4 ${poll.is_archived ? "opacity-75" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={status} />
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                {total} vote{total === 1 ? "" : "s"}
              </span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => updatePoll(poll.id, { is_archived: !poll.is_archived })}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  {poll.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" aria-hidden /> : <Archive className="h-3.5 w-3.5" aria-hidden />}
                  {poll.is_archived ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  onClick={() => removePoll(poll)}
                  className="flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-bold text-danger hover:bg-danger/15"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor={`poll-q-${poll.id}`}>Question</label>
              <input
                id={`poll-q-${poll.id}`}
                value={poll.question}
                onChange={(e) => updatePoll(poll.id, { question: e.target.value })}
                className={inputCls}
                placeholder="e.g. Who will win the Men's Singles?"
              />
            </div>

            <div>
              <span className={labelCls}>Options</span>
              <ul className="space-y-2">
                {(poll.options ?? []).map((o, n) => {
                  const pct = total ? Math.round(((o.votes?.length ?? 0) / total) * 100) : 0;
                  return (
                    <li key={o.id} className="flex items-center gap-2">
                      <input
                        value={o.text}
                        onChange={(e) => setOption(poll, o.id, e.target.value)}
                        className={inputCls}
                        placeholder={`Option ${n + 1}`}
                        aria-label={`Option ${n + 1}`}
                      />
                      <span className="w-16 shrink-0 text-right text-xs font-bold text-muted-foreground tabular-nums">
                        {o.votes?.length ?? 0} · {pct}%
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOption(poll, o.id)}
                        aria-label={`Remove option ${n + 1}`}
                        className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => addOption(poll)}
                className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add option
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls} htmlFor={`poll-t-${poll.id}`}>Tournament</label>
                <select
                  id={`poll-t-${poll.id}`}
                  value={poll.tournament_id ?? ""}
                  onChange={(e) => updatePoll(poll.id, { tournament_id: e.target.value || undefined })}
                  className={inputCls}
                >
                  <option value="">Not linked (August 2026 only)</option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  {poll.tournament_id && !tournaments.some((t) => t.id === poll.tournament_id) && (
                    <option value={poll.tournament_id}>Linked tournament</option>
                  )}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor={`poll-s-${poll.id}`}>Opens</label>
                <input
                  id={`poll-s-${poll.id}`}
                  type="datetime-local"
                  value={poll.start_date || ""}
                  onChange={(e) => updatePoll(poll.id, { start_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`poll-e-${poll.id}`}>Closes</label>
                <input
                  id={`poll-e-${poll.id}`}
                  type="datetime-local"
                  value={poll.end_date || ""}
                  min={poll.start_date || undefined}
                  onChange={(e) => updatePoll(poll.id, { end_date: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => updatePoll(poll.id, { is_active: !poll.is_active })}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  poll.is_active ? "border-primary/60 bg-primary/15 text-primary" : "border-danger/40 bg-danger/10 text-danger"
                }`}
              >
                {poll.is_active ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Ban className="h-3.5 w-3.5" aria-hidden />}
                {poll.is_active ? "Active" : "Completed"}
              </button>
              <button
                type="button"
                onClick={() => updatePoll(poll.id, { results_revealed: !poll.results_revealed })}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  poll.results_revealed ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"
                }`}
              >
                {poll.results_revealed ? "Results public" : "Results hidden until voting"}
              </button>
              <button
                type="button"
                onClick={() => sendPush(poll)}
                disabled={sendingPush === poll.id}
                className="flex items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs font-bold text-info hover:bg-info/20 disabled:opacity-50"
              >
                {sendingPush === poll.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Bell className="h-3.5 w-3.5" aria-hidden />}
                Notify members
              </button>
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border-strong py-8 text-center text-sm font-bold text-muted-foreground">
          No polls yet. Use “Add poll” to start one.
        </p>
      )}
    </div>
  );
}
