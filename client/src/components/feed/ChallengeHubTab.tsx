import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Swords, Check, X, Clock, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export function ChallengeHubTab({ currentUser }: { currentUser: any }) {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = async () => {
    if (!currentUser) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("challenges")
      .select(`
        *,
        challenger:players!challenger_id(id, full_name, avatar_url, elo_rating),
        challenged:players!challenged_id(id, full_name, avatar_url, elo_rating)
      `)
      .or(`challenger_id.eq.${currentUser.id},challenged_id.eq.${currentUser.id}`)
      .order("created_at", { ascending: false });

    if (!error && data) setChallenges(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchChallenges();
  }, [currentUser]);

  const handleAction = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("challenges")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Challenge ${newStatus}!`);
      fetchChallenges();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDismiss = async (id: string) => {
    // Optimistic removal so the list feels instant
    setChallenges((prev) => prev.filter((c) => c.id !== id));
    try {
      const { error } = await supabase.from("challenges").delete().eq("id", id);
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message);
      fetchChallenges();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const incoming = challenges.filter((c) => c.challenged_id === currentUser?.id && c.status === "pending");
  const outgoing = challenges.filter((c) => c.challenger_id === currentUser?.id && c.status === "pending");
  const accepted = challenges.filter((c) => c.status === "accepted");
  const inactive = challenges
    .filter((c) => c.status === "cancelled" || c.status === "declined")
    .slice(0, 5);
  const history = [...accepted, ...inactive].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Incoming Challenges */}
      {incoming.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Swords className="w-4 h-4 text-orange-500" /> Incoming Challenges
          </h3>
          <div className="space-y-4">
            {incoming.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center gap-3">
                  <img src={c.challenger.avatar_url} className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {c.challenger.full_name} <span className="text-muted-foreground font-normal">challenged you to</span> <span className="text-orange-500">{c.format}</span>
                    </div>
                    {c.scheduled_time && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" /> {new Date(c.scheduled_time).toLocaleString()}
                      </div>
                    )}
                    {c.message && <div className="text-xs italic text-muted-foreground mt-1">"{c.message}"</div>}
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => handleAction(c.id, "accepted")} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary transition">
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                  <button onClick={() => handleAction(c.id, "declined")} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-muted-foreground dark:text-muted-foreground font-bold text-xs rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition">
                    <X className="w-3.5 h-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing Challenges */}
      {outgoing.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" /> Pending Sent Challenges
          </h3>
          <div className="space-y-4">
            {outgoing.map((c) => (
              <div key={c.id} className="flex justify-between items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <img src={c.challenged.avatar_url} className="w-8 h-8 rounded-full" />
                  <div>
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Waiting on {c.challenged.full_name} <span className="text-muted-foreground font-normal">({c.format})</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => handleAction(c.id, "cancelled")} className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-full transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Challenge History</h3>
        {history.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-4">No challenge history yet.</div>
        ) : (
          <div className="space-y-3">
            {history.map((c) => (
              <div key={c.id} className="flex justify-between items-center gap-2 text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <span className="font-bold">{c.challenger_id === currentUser.id ? "You" : c.challenger.full_name}</span> challenged <span className="font-bold">{c.challenged_id === currentUser.id ? "You" : c.challenged.full_name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                    c.status === "accepted" ? "bg-primary/15 text-primary dark:bg-primary/30" :
                    c.status === "declined" ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30" :
                    "bg-slate-200 text-muted-foreground dark:bg-slate-700"
                  }`}>
                    {c.status}
                  </span>
                  <button
                    onClick={() => handleDismiss(c.id)}
                    aria-label="Dismiss"
                    title="Dismiss from history"
                    className="p-1 rounded-full text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
