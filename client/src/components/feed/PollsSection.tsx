// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, CheckCircle2, Plus, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // array of user IDs who voted
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  created_at: string;
  created_by?: string;
  is_active: boolean;
  is_archived?: boolean;
  start_date?: string;
  end_date?: string;
  results_revealed?: boolean;
}


export const isPollVisible = (poll: Poll) => {
  if (poll.is_archived) return false;
  if (!poll.is_active) return false;
  const now = Date.now();
  if (poll.start_date && now < new Date(poll.start_date).getTime()) return false;
  if (poll.end_date && now > new Date(poll.end_date).getTime()) return false;
  return true;
};
function PollCard({ poll, onVote, onArchive, onDelete, onNotify, onToggleReveal, currentUserId, isAdmin }: { poll: Poll; onVote: (pollId: string, optionId: string) => void; onArchive?: (pollId: string, archive: boolean) => void; onDelete?: (pollId: string) => void; onNotify?: (poll: Poll) => void; onToggleReveal?: (pollId: string, reveal: boolean) => void; currentUserId?: string; isAdmin?: boolean }) {
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
  const userVotedId = currentUserId
    ? poll.options.find(o => o.votes?.includes(currentUserId))?.id
    : null;
  const hasVoted = !!userVotedId || !!poll.is_archived;
  const shouldShowResults = hasVoted || isAdmin || poll.results_revealed || poll.is_archived;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative ${poll.is_archived ? "opacity-75" : ""}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl ${poll.is_archived ? "bg-slate-100 dark:bg-slate-800" : "bg-violet-100 dark:bg-violet-900/50"}`}>
          <BarChart2 className={`w-5 h-5 ${poll.is_archived ? "text-muted-foreground" : "text-violet-600 dark:text-violet-400"}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black uppercase tracking-widest ${poll.is_archived ? "text-muted-foreground" : "text-violet-500"}`}>
            {poll.is_archived ? "Archived Poll" : "Community Poll"}
          </span>
          {isAdmin && !poll.results_revealed && (
            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-widest">
              Hidden from public
            </span>
          )}
        </div>
      </div>
      {isAdmin && (
        <div className="flex flex-wrap justify-end items-center gap-3 mb-4 mt-[-8px]">
          {onToggleReveal && (
            <button
              onClick={() => onToggleReveal(poll.id, !poll.results_revealed)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-emerald-500 transition-colors flex items-center gap-1"
            >
              {poll.results_revealed ? "Hide from Public" : "Reveal to Public"}
            </button>
          )}
          {onNotify && (
            <button
              onClick={() => onNotify(poll)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-indigo-500 transition-colors flex items-center gap-1"
            >
              Notify
            </button>
          )}
          {onArchive && (
            <button
              onClick={() => onArchive(poll.id, !poll.is_archived)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-amber-500 transition-colors flex items-center gap-1"
            >
              {poll.is_archived ? "Unarchive" : "Archive"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(poll.id)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1"
            >
              Delete
            </button>
          )}
          <a href="/admin#polls" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-violet-500 transition-colors flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-3">
            Manage
          </a>
        </div>
      )}
      <h3 className="font-black text-slate-800 dark:text-foreground text-base mb-4 mt-2">{poll.question}</h3>
      <div className="space-y-2.5">
        {poll.options.map((option) => {
          const voteCount = option.votes?.length || 0;
          const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isMyVote = userVotedId === option.id;

          return (
            <button
              key={option.id}
              onClick={() => !hasVoted && onVote(poll.id, option.id)}
              disabled={hasVoted}
              className={`w-full text-left relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                isMyVote
                  ? "border-violet-500 dark:border-violet-400 shadow-sm shadow-violet-500/20"
                  : hasVoted
                  ? "border-slate-200 dark:border-slate-800 cursor-default"
                  : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer"
              }`}
            >
              {/* Progress bar background */}
              {hasVoted && shouldShowResults && (
                <motion.div
                  className={`absolute inset-0 ${isMyVote ? "bg-violet-100 dark:bg-violet-500/25" : "bg-slate-50 dark:bg-slate-800/60"}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ transformOrigin: "left" }}
                />
              )}
              <div className="relative z-10 flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  {isMyVote ? (
                    <CheckCircle2 className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                  )}
                  <span className={`text-sm font-bold ${isMyVote ? "text-violet-800 dark:text-violet-200" : "text-slate-700 dark:text-slate-300"}`}>
                    {option.text}
                  </span>
                </div>
                {hasVoted && shouldShowResults && (
                  <span className={`text-sm font-black ${isMyVote ? "text-violet-700 dark:text-violet-300" : "text-slate-500 dark:text-slate-400"} ml-2 whitespace-nowrap`}>
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {hasVoted && !shouldShowResults && (
        <p className="text-xs text-muted-foreground italic mt-3 text-center">
          🔒 Vote recorded! Poll results will be revealed by admin.
        </p>
      )}
      <div className="mt-3 text-xs text-muted-foreground text-right">
        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        {!currentUserId && " · Sign in to vote"}
      </div>
    </div>
  );
}

function CreatePollForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState(true);
  const { session } = useAuth();

  const addOption = () => setOptions(prev => [...prev, ""]);
  const removeOption = (i: number) => setOptions(prev => prev.filter((_, idx) => idx !== i));
  const updateOption = (i: number, val: string) => setOptions(prev => { const arr = [...prev]; arr[i] = val; return arr; });

  const handleSave = async () => {
    if (!question.trim()) { toast.error("Enter a poll question"); return; }
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) { toast.error("Add at least 2 options"); return; }
    setSaving(true);

    const poll: Poll = {
      id: crypto.randomUUID(),
      question: question.trim(),
      options: validOptions.map(text => ({ id: crypto.randomUUID(), text, votes: [] })),
      created_at: new Date().toISOString(),
      is_active: true,
    };

    const { data: existing } = await supabase.from("site_data").select("value").eq("key", "polls").maybeSingle();
    const polls: Poll[] = existing?.value?.polls || [];
    polls.unshift(poll);

    await supabase.from("site_data").upsert({ key: "polls", value: { polls } }, { onConflict: "key" });
    
    if (notify) {
      toast.info("Sending push notification...");
      try {
        await supabase.functions.invoke("send-announcement", {
          body: {
            title: "New Community Poll!",
            body: question.trim(),
            admin_email: session?.user?.email ?? "admin",
          },
        });
      } catch (err) {
        toast.error("Failed to send push notification");
      }
    }

    toast.success("Poll created!");
    setSaving(false);
    onCreated();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-violet-200 dark:border-violet-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-slate-800 dark:text-foreground flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-violet-500" /> Create Poll
        </h3>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask the community something..."
        className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none text-slate-800 dark:text-foreground placeholder:text-muted-foreground mb-4"
      />
      <div className="space-y-2 mb-3">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none text-slate-800 dark:text-foreground placeholder:text-muted-foreground"
            />
            {options.length > 2 && (
              <button onClick={() => removeOption(i)} className="p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <input 
          type="checkbox" 
          id="notify-poll" 
          checked={notify} 
          onChange={e => setNotify(e.target.checked)} 
          className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer" 
        />
        <label htmlFor="notify-poll" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          Send Push Notification
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={addOption} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition">
          <Plus className="w-3.5 h-3.5" /> Add Option
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-violet-500 hover:bg-violet-600 text-foreground transition disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Publish Poll"}
        </button>
      </div>
    </div>
  );
}

export function PollsSection() {
  const { profile, session, isMasterAdmin } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPolls = useCallback(async () => {
    const { data } = await supabase.from("site_data").select("value").eq("key", "polls").maybeSingle();
    setPolls(data?.value?.polls || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const handleVote = async (pollId: string, optionId: string) => {
    if (!profile?.id) { toast.error("Sign in to vote"); return; }
    const userId = profile.id;

    setPolls(prev => prev.map(p => {
      if (p.id !== pollId) return p;
      return {
        ...p,
        options: p.options.map(o => ({
          ...o,
          votes: o.id === optionId
            ? [...(o.votes || []), userId]
            : (o.votes || []).filter(v => v !== userId)
        }))
      };
    }));

    const { data } = await supabase.from("site_data").select("value").eq("key", "polls").maybeSingle();
    const allPolls: Poll[] = data?.value?.polls || [];
    const updated = allPolls.map(p => {
      if (p.id !== pollId) return p;
      return {
        ...p,
        options: p.options.map(o => ({
          ...o,
          votes: o.id === optionId
            ? [...new Set([...(o.votes || []), userId])]
            : (o.votes || []).filter((v: string) => v !== userId)
        }))
      };
    });
    await supabase.from("site_data").upsert({ key: "polls", value: { polls: updated } }, { onConflict: "key" });
  };

  const handleToggleReveal = async (pollId: string, reveal: boolean) => {
    const updated = polls.map(p => p.id === pollId ? { ...p, results_revealed: reveal } : p);
    setPolls(updated);
    await supabase.from("site_data").upsert({ key: "polls", value: { polls: updated } }, { onConflict: "key" });
    toast.success(reveal ? "Poll results revealed to users" : "Poll results hidden");
  };

  const handleArchive = async (pollId: string, archive: boolean) => {
    const updated = polls.map(p => p.id === pollId ? { ...p, is_archived: archive } : p);
    setPolls(updated);
    await supabase.from("site_data").upsert({ key: "polls", value: { polls: updated } }, { onConflict: "key" });
    toast.success(archive ? "Poll archived" : "Poll restored");
  };

  const handleDelete = async (pollId: string) => {
    if (!confirm("Are you sure you want to delete this poll?")) return;
    const updated = polls.filter(p => p.id !== pollId);
    setPolls(updated);
    await supabase.from("site_data").upsert({ key: "polls", value: { polls: updated } }, { onConflict: "key" });
    toast.success("Poll deleted");
  };

  const handleNotify = async (poll: Poll) => {
    if (!confirm("Send a push notification to all users about this poll?")) return;
    toast.info("Sending push notification...");
    try {
      await supabase.functions.invoke("send-announcement", {
        body: {
          title: "New Community Poll!",
          body: poll.question,
          admin_email: session?.user?.email ?? "admin",
        },
      });
      toast.success("Push notification sent!");
    } catch (err) {
      toast.error("Failed to send push notification");
    }
  };

  if (loading) return null;
  if (!isMasterAdmin && polls.filter(isPollVisible).length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Admin create button */}
      {isMasterAdmin && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800 text-violet-500 font-bold text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition"
        >
          <Plus className="w-4 h-4" /> Create Community Poll
        </button>
      )}

      <AnimatePresence>
        {showCreate && isMasterAdmin && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <CreatePollForm
              onCreated={() => { setShowCreate(false); fetchPolls(); }}
              onCancel={() => setShowCreate(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {polls.filter(isPollVisible).map((poll) => (
        <motion.div key={poll.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <PollCard poll={poll} onVote={handleVote} onArchive={isMasterAdmin ? handleArchive : undefined} onDelete={isMasterAdmin ? handleDelete : undefined} onNotify={isMasterAdmin ? handleNotify : undefined} onToggleReveal={isMasterAdmin ? handleToggleReveal : undefined} currentUserId={profile?.id} isAdmin={isMasterAdmin} />
        </motion.div>
      ))}

      {polls.filter(p => p.is_archived).length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4 px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Archived Polls</h3>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
          </div>
          <div className="space-y-4">
            {polls.filter(p => p.is_archived).map(poll => (
              <PollCard key={poll.id} poll={poll} onVote={handleVote} onArchive={isMasterAdmin ? handleArchive : undefined} onDelete={isMasterAdmin ? handleDelete : undefined} onNotify={isMasterAdmin ? handleNotify : undefined} onToggleReveal={isMasterAdmin ? handleToggleReveal : undefined} currentUserId={profile?.id} isAdmin={isMasterAdmin} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
