import React, { useState } from "react";
import { Plus, Trash2, CheckCircle2, Ban, Archive, ArchiveRestore, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/services/adminService";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { inputCls, labelCls, cardCls } from "./shared";
import { Poll } from "../../feed/PollsSection";

export function PollEditor({
  data,
  onChange,
}: {
  data: Poll[];
  onChange: (d: Poll[]) => void;
}) {
  const { session } = useAuth();
  const { confirm } = useConfirm();
  const [sendingPush, setSendingPush] = useState<string | null>(null);

  const sendPushNotification = async (poll: Poll) => {
    if (!poll.question || poll.question === "New Poll") {
      toast.error("Please enter a valid poll question before sending a notification.");
      return;
    }
    if (!(await confirm({
      title: 'Send Push Notification',
      description: 'Send a push notification to all users about this poll?',
      confirmLabel: 'Send Notification'
    }))) return;
    setSendingPush(poll.id);
    try {
      const fnData = await adminService.sendPushBroadcast({
        title: "New Community Poll!",
        body: poll.question,
        url: "/pulse",
        admin_email: session?.user?.email ?? "admin",
      });

      const sent = fnData?.sent ?? 0;
      toast.success(`Push notification sent to ${sent} devices!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send push notification");
    } finally {
      setSendingPush(null);
    }
  };

  const addPoll = () => {
    const p: Poll = {
      id: crypto.randomUUID(),
      question: "New Poll",
      options: [],
      created_at: new Date().toISOString(),
      is_active: true,
    };
    onChange([p, ...data]);
  };

  const removePoll = (i: number) => {
    onChange(data.filter((_, idx) => idx !== i));
  };

  const updatePoll = (i: number, fields: Partial<Poll>) => {
    const arr = [...data];
    arr[i] = { ...arr[i], ...fields };
    onChange(arr);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-foreground">Community Polls</h2>
          <p className="text-sm font-medium text-muted-foreground">
            Manage public polls, set active schedules, and review existing poll configurations.
          </p>
        </div>
        <button
          onClick={addPoll}
          className="flex items-center gap-2 bg-info text-on-accent px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-info/90 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Poll
        </button>
      </div>

      <div className="space-y-4">
        {data.map((poll, i) => (
          <div key={poll.id} className={cardCls + ` p-6 flex flex-col gap-4 relative group ${poll.is_archived ? 'opacity-75 bg-card' : ''}`}>
            <div className="flex justify-end mb-2">
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <button
                  onClick={() => updatePoll(i, { is_archived: !poll.is_archived })}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                    poll.is_archived
                      ? "bg-warning/10 text-warning border-warning/40"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {poll.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  {poll.is_archived ? "Unarchive" : "Archive"}
                </button>
                <button
                  onClick={() => removePoll(i)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-danger/10 text-danger border border-danger/40 hover:bg-danger/15 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-3">
                <div>
                  <label className={labelCls}>Poll Question</label>
                  <input
                    value={poll.question}
                    onChange={(e) => updatePoll(i, { question: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. Who will win the Men's Singles?"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Start Date</label>
                    <input
                      type="datetime-local"
                      value={poll.start_date || ""}
                      onChange={(e) => updatePoll(i, { start_date: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>End Date</label>
                    <input
                      type="datetime-local"
                      value={poll.end_date || ""}
                      onChange={(e) => updatePoll(i, { end_date: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => updatePoll(i, { is_active: !poll.is_active })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      poll.is_active
                        ? "bg-primary/30 text-primary border border-primary/80"
                        : "bg-danger/10 text-danger border border-danger/40"
                    }`}
                  >
                    {poll.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    {poll.is_active ? "Active" : "Inactive (Completed)"}
                  </button>
                  <button
                    onClick={() => updatePoll(i, { results_revealed: !poll.results_revealed })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      poll.results_revealed
                        ? "bg-success/10 text-success border border-success/40"
                        : "bg-warning/10 text-warning border border-warning/40"
                    }`}
                  >
                    {poll.results_revealed ? "Results Public" : "Results Hidden"}
                  </button>
                  <button
                    onClick={() => sendPushNotification(poll)}
                    disabled={sendingPush === poll.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-info/10 text-info border border-info/40 hover:bg-info/20 disabled:opacity-50"
                  >
                    {sendingPush === poll.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                    Broadcast Push
                  </button>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">
                    {poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0)} Total Votes
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <div className="text-center py-12 bg-card/50 rounded-2xl border border-dashed border-border-strong">
            <p className="text-muted-foreground font-bold">No polls configured.</p>
          </div>
        )}
      </div>
    </div>
  );
}
