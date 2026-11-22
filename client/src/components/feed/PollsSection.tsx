import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, CheckCircle2, Plus, Trash2, Save, X } from "lucide-react";
import { feedService } from "@/services/feedService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";

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
  tournament_id?: string;
}

export const AUGUST_2026_TOURNAMENT_ID = "62c5341c-df12-4511-9253-a9a0e9546667";

export const belongsToTournament = (poll: Poll, targetTournamentId?: string): boolean => {
  if (!targetTournamentId) return true;
  if (poll.tournament_id) {
    return poll.tournament_id === targetTournamentId;
  }
  // Legacy polls without tournament_id were created for the August 2026 tournament
  return targetTournamentId === AUGUST_2026_TOURNAMENT_ID;
};

const isPollVisible = (poll: Poll) => {
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
    <div className={`bg-card rounded-3xl p-6 shadow-sm border border-border relative ${poll.is_archived ? "opacity-75" : ""}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl ${poll.is_archived ? "bg-muted" : "bg-individual/20"}`}>
          <BarChart2 className={`w-5 h-5 ${poll.is_archived ? "text-muted-foreground" : "text-individual"}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black uppercase tracking-widest ${poll.is_archived ? "text-muted-foreground" : "text-individual"}`}>
            {poll.is_archived ? "Archived Poll" : "Community Poll"}
          </span>
          {isAdmin && !poll.results_revealed && (
            <span className="text-[9px] font-bold bg-warning/20 text-warning px-1.5 py-0.5 rounded uppercase tracking-widest">
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
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-success transition-colors flex items-center gap-1"
            >
              {poll.results_revealed ? "Hide from Public" : "Reveal to Public"}
            </button>
          )}
          {onNotify && (
            <button
              onClick={() => onNotify(poll)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-info transition-colors flex items-center gap-1"
            >
              Notify
            </button>
          )}
          {onArchive && (
            <button
              onClick={() => onArchive(poll.id, !poll.is_archived)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-warning transition-colors flex items-center gap-1"
            >
              {poll.is_archived ? "Unarchive" : "Archive"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(poll.id)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-danger transition-colors flex items-center gap-1"
            >
              Delete
            </button>
          )}
          <Link href="/admin?tab=posts#content" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-individual transition-colors flex items-center gap-1 border-l border-border-strong pl-3">
            Manage
          </Link>
        </div>
      )}
      <h3 className="font-black text-foreground text-base mb-4 mt-2">{poll.question}</h3>
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
                  ? "border-individual shadow-sm shadow-individual/20"
                  : hasVoted
                  ? "border-border cursor-default"
                  : "border-border-strong hover:border-individual cursor-pointer"
              }`}
            >
              {/* Progress bar background */}
              {hasVoted && shouldShowResults && (
                <motion.div
                  className={`absolute inset-0 ${isMyVote ? "bg-individual/25" : "bg-muted/60"}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ transformOrigin: "left" }}
                />
              )}
              <div className="relative z-10 flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  {isMyVote ? (
                    <CheckCircle2 className="w-5 h-5 text-individual shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-border-strong shrink-0" />
                  )}
                  <span className={`text-sm font-bold ${isMyVote ? "text-individual" : "text-soft"}`}>
                    {option.text}
                  </span>
                </div>
                {hasVoted && shouldShowResults && (
                  <span className={`text-sm font-black ${isMyVote ? "text-individual" : "text-muted-foreground"} ml-2 whitespace-nowrap`}>
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

function CreatePollForm({ 
  onCreated, 
  onCancel, 
  tournamentId 
}: { 
  onCreated: () => void; 
  onCancel: () => void; 
  tournamentId?: string;
}) {
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
      tournament_id: tournamentId,
    };

    const existingPolls = await feedService.getPolls();
    existingPolls.unshift(poll);
    await feedService.savePolls(existingPolls);
    
    if (notify) {
      toast.info("Sending push notification...");
      try {
        await feedService.sendAnnouncement({
          title: "New Community Poll!",
          body: question.trim(),
          admin_email: session?.user?.email ?? "admin",
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
    <div className="bg-card rounded-3xl border border-individual/40 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-foreground flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-individual" /> Create Poll
        </h3>
        <button aria-label="Cancel poll" onClick={onCancel} className="p-1 rounded-lg hover:bg-muted transition"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask the community something..."
        className="w-full text-sm bg-muted border border-border-strong rounded-xl px-4 py-3 outline-none text-foreground placeholder:text-muted-foreground mb-4"
      />
      <div className="space-y-2 mb-3">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 text-sm bg-muted border border-border-strong rounded-xl px-4 py-2.5 outline-none text-foreground placeholder:text-muted-foreground"
            />
            {options.length > 2 && (
              <button onClick={() => removeOption(i)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition">
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
          className="rounded border-border-strong text-individual focus:ring-individual w-4 h-4 cursor-pointer" 
        />
        <label htmlFor="notify-poll" className="text-sm font-semibold text-soft cursor-pointer select-none">
          Send Push Notification
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={addOption} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-individual bg-individual/10 hover:bg-individual/15 transition">
          <Plus className="w-3.5 h-3.5" /> Add Option
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-individual hover:bg-individual/90 text-on-accent transition disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Publish Poll"}
        </button>
      </div>
    </div>
  );
}

export function PollsSection({ tournamentId }: { tournamentId?: string } = {}) {
  const { profile, session, isMasterAdmin } = useAuth();
  const { confirm } = useConfirm();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPolls = useCallback(async () => {
    try {
      const data = await feedService.getPolls();
      setPolls(data);
    } catch {
      setPolls([]);
    } finally {
      setLoading(false);
    }
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

    const allPolls = await feedService.getPolls();
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
    await feedService.savePolls(updated);
  };

  const handleToggleReveal = async (pollId: string, reveal: boolean) => {
    const updated = polls.map(p => p.id === pollId ? { ...p, results_revealed: reveal } : p);
    setPolls(updated);
    await feedService.savePolls(updated);
    toast.success(reveal ? "Poll results revealed to users" : "Poll results hidden");
  };

  const handleArchive = async (pollId: string, archive: boolean) => {
    const updated = polls.map(p => p.id === pollId ? { ...p, is_archived: archive } : p);
    setPolls(updated);
    await feedService.savePolls(updated);
    toast.success(archive ? "Poll archived" : "Poll restored");
  };

  const handleDelete = async (pollId: string) => {
    const ok = await confirm({
      title: "Delete Poll?",
      description: "Are you sure you want to permanently delete this poll?",
      confirmLabel: "Delete Poll",
      confirmVariant: "danger"
    });
    if (!ok) return;
    const updated = polls.filter(p => p.id !== pollId);
    setPolls(updated);
    await feedService.savePolls(updated);
    toast.success("Poll deleted");
  };

  const handleNotify = async (poll: Poll) => {
    const ok = await confirm({
      title: "Broadcast Notification?",
      description: `Send a push notification to all users about "${poll.question}"?`,
      confirmLabel: "Send Broadcast",
      confirmVariant: "primary"
    });
    if (!ok) return;
    toast.info("Sending push notification...");
    try {
      await feedService.sendAnnouncement({
        title: "New Community Poll!",
        body: poll.question,
        admin_email: session?.user?.email ?? "admin",
      });
      toast.success("Push notification sent!");
    } catch (err) {
      toast.error("Failed to send push notification");
    }
  };

  const scopedPolls = polls.filter(p => belongsToTournament(p, tournamentId));
  const visiblePolls = scopedPolls.filter(isPollVisible);
  const archivedPolls = scopedPolls.filter(p => p.is_archived);

  if (loading) return null;
  if (!isMasterAdmin && visiblePolls.length === 0 && !tournamentId) return null;

  return (
    <div className="space-y-4">
      {/* Admin create button */}
      {isMasterAdmin && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-individual/40 text-individual font-bold text-sm hover:bg-individual/10 transition"
        >
          <Plus className="w-4 h-4" /> Create Community Poll
        </button>
      )}

      <AnimatePresence>
        {showCreate && isMasterAdmin && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <CreatePollForm
              tournamentId={tournamentId}
              onCreated={() => { setShowCreate(false); fetchPolls(); }}
              onCancel={() => setShowCreate(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {visiblePolls.map((poll) => (
        <motion.div key={poll.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <PollCard poll={poll} onVote={handleVote} onArchive={isMasterAdmin ? handleArchive : undefined} onDelete={isMasterAdmin ? handleDelete : undefined} onNotify={isMasterAdmin ? handleNotify : undefined} onToggleReveal={isMasterAdmin ? handleToggleReveal : undefined} currentUserId={profile?.id} isAdmin={isMasterAdmin} />
        </motion.div>
      ))}

      {visiblePolls.length === 0 && (!isMasterAdmin || archivedPolls.length === 0) && !showCreate && (
        <div className="text-center py-12 bg-card rounded-3xl border border-border shadow-sm p-6">
          <div className="w-16 h-16 bg-individual/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-individual/30">
            <BarChart2 className="w-8 h-8 text-individual" />
          </div>
          <h3 className="text-lg font-black text-soft mb-1">
            No Polls for This Tournament
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            There are currently no active community polls for this tournament.
          </p>
        </div>
      )}

      {isMasterAdmin && archivedPolls.length > 0 && (
        <details className="mt-8 group border border-border rounded-2xl bg-card/50">
          <summary className="flex items-center gap-2 p-4 cursor-pointer list-none outline-none">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex-1">Archived Polls</h3>
            <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="p-4 pt-0 space-y-4">
            {archivedPolls.map(poll => (
              <PollCard key={poll.id} poll={poll} onVote={handleVote} onArchive={isMasterAdmin ? handleArchive : undefined} onDelete={isMasterAdmin ? handleDelete : undefined} onNotify={isMasterAdmin ? handleNotify : undefined} onToggleReveal={isMasterAdmin ? handleToggleReveal : undefined} currentUserId={profile?.id} isAdmin={isMasterAdmin} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
