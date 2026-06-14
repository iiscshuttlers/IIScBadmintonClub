import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, CheckCircle2, Plus, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface PollOption {
  id: string;
  text: string;
  votes: string[]; // array of user IDs who voted
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  created_at: string;
  created_by?: string;
  is_active: boolean;
}

function PollCard({ poll, onVote, currentUserId }: { poll: Poll; onVote: (pollId: string, optionId: string) => void; currentUserId?: string }) {
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
  const userVotedId = currentUserId
    ? poll.options.find(o => o.votes?.includes(currentUserId))?.id
    : null;
  const hasVoted = !!userVotedId;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-violet-500" />
        <span className="text-xs font-black uppercase tracking-widest text-violet-500">Community Poll</span>
      </div>
      <h3 className="font-black text-slate-800 dark:text-white text-base mb-4">{poll.question}</h3>
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
              className={`w-full text-left relative overflow-hidden rounded-xl border transition-all ${
                isMyVote
                  ? "border-violet-400 dark:border-violet-600"
                  : hasVoted
                  ? "border-slate-200 dark:border-slate-700 cursor-default"
                  : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer"
              }`}
            >
              {/* Progress bar background */}
              {hasVoted && (
                <motion.div
                  className={`absolute inset-0 ${isMyVote ? "bg-violet-100 dark:bg-violet-900/30" : "bg-slate-50 dark:bg-slate-800/50"}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ transformOrigin: "left" }}
                />
              )}
              <div className="relative z-10 flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {isMyVote && <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0" />}
                  <span className={`text-sm font-bold ${isMyVote ? "text-violet-700 dark:text-violet-300" : "text-slate-700 dark:text-slate-300"}`}>
                    {option.text}
                  </span>
                </div>
                {hasVoted && (
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400 ml-2 whitespace-nowrap">
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-slate-400 text-right">
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
    toast.success("Poll created!");
    setSaving(false);
    onCreated();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-violet-200 dark:border-violet-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-violet-500" /> Create Poll
        </h3>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask the community something..."
        className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none text-slate-800 dark:text-white placeholder:text-slate-400 mb-4"
      />
      <div className="space-y-2 mb-3">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
            />
            {options.length > 2 && (
              <button onClick={() => removeOption(i)} className="p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={addOption} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition">
          <Plus className="w-3.5 h-3.5" /> Add Option
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-violet-500 hover:bg-violet-600 text-white transition disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Publish Poll"}
        </button>
      </div>
    </div>
  );
}

export function PollsSection() {
  const { profile, isAdmin } = useAuth();
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

  if (loading) return null;
  if (!isAdmin && polls.filter(p => p.is_active).length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Admin create button */}
      {isAdmin && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800 text-violet-500 font-bold text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition"
        >
          <Plus className="w-4 h-4" /> Create Community Poll
        </button>
      )}

      <AnimatePresence>
        {showCreate && isAdmin && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <CreatePollForm
              onCreated={() => { setShowCreate(false); fetchPolls(); }}
              onCancel={() => setShowCreate(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {polls.filter(p => p.is_active).map((poll) => (
        <motion.div key={poll.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <PollCard poll={poll} onVote={handleVote} currentUserId={profile?.id} />
        </motion.div>
      ))}
    </div>
  );
}
