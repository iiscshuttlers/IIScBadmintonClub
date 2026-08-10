import React, { useState } from "react";
import { Plus, Trash2, CheckCircle2, Ban, Archive, ArchiveRestore, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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
      const payload = {
        title: "New Community Poll!",
        body: poll.question,
        url: "/pulse",
      };

      const { data: fnData, error: fnError } = await supabase.functions.invoke("send-announcement", {
        body: {
          ...payload,
          admin_email: session?.user?.email ?? "admin",
        },
      });
      if (fnError) throw fnError;

      await supabase.from("site_data").upsert(
        { key: "admin_push", value: { ...payload, timestamp: Date.now() }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

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
          <h2 className="text-xl font-black text-slate-800 dark:text-foreground">Community Polls</h2>
          <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
            Manage public polls, set active schedules, and review existing poll configurations.
          </p>
        </div>
        <button
          onClick={addPoll}
          className="flex items-center gap-2 bg-indigo-600 text-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-500 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Poll
        </button>
      </div>

      <div className="space-y-4">
        {data.map((poll, i) => (
          <div key={poll.id} className={cardCls + ` p-6 flex flex-col gap-4 relative group ${poll.is_archived ? 'opacity-75 bg-slate-50 dark:bg-slate-900' : ''}`}>
            <div className="flex justify-end mb-2">
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <button
                  onClick={() => updatePoll(i, { is_archived: !poll.is_archived })}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                    poll.is_archived
                      ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {poll.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  {poll.is_archived ? "Unarchive" : "Archive"}
                </button>
                <button
                  onClick={() => removePoll(i)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-800 dark:hover:bg-rose-900/40 shadow-sm"
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
                        ? "bg-primary/10 text-primary border border-primary/40 dark:bg-primary/30 dark:border-primary/80"
                        : "bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-900/30 dark:border-rose-800"
                    }`}
                  >
                    {poll.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    {poll.is_active ? "Active" : "Inactive (Completed)"}
                  </button>
                  <button
                    onClick={() => updatePoll(i, { results_revealed: !poll.results_revealed })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      poll.results_revealed
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800"
                        : "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-800"
                    }`}
                  >
                    {poll.results_revealed ? "Results Public" : "Results Hidden"}
                  </button>
                  <button
                    onClick={() => sendPushNotification(poll)}
                    disabled={sendingPush === poll.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 dark:hover:bg-indigo-900/50 disabled:opacity-50"
                  >
                    {sendingPush === poll.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                    Broadcast Push
                  </button>
                  <span className="text-xs font-bold text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0)} Total Votes
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <div className="text-center py-12 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <p className="text-muted-foreground dark:text-muted-foreground font-bold">No polls configured.</p>
          </div>
        )}
      </div>
    </div>
  );
}
