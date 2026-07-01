import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, XCircle, Loader2, RefreshCw, Trophy, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { InfoModal } from "@/components/InfoModal";

interface DisputedMatch {
  id: string;
  created_at: string;
  score: string;
  category: string;
  winner_id: string;
  dispute_reason?: string;
  disputed_by?: string;
  player1: { id: string; full_name: string; avatar_url?: string };
  player2: { id: string; full_name: string; avatar_url?: string };
  partner1?: { id: string; full_name: string };
  partner2?: { id: string; full_name: string };
}

export function DisputePanel() {
  const { session } = useAuth();
  const [matches, setMatches] = useState<DisputedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("matches")
      .select("*, player1:players!player1_id(id,full_name,avatar_url), player2:players!player2_id(id,full_name,avatar_url), partner1:players!team1_partner_id(id,full_name,avatar_url), partner2:players!team2_partner_id(id,full_name,avatar_url)")
      .eq("status", "disputed")
      .order("created_at", { ascending: false });
    if (!error && data) setMatches(data as any);
    else if (error) toast.error("Failed to load disputes");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (matchId: string, action: "uphold" | "override", newWinnerId?: string) => {
    setProcessing(matchId);
    try {
      if (action === "uphold") {
        const { error } = await supabase.from("matches").update({ status: "confirmed", dispute_reason: null }).eq("id", matchId);
        if (error) throw error;
        await logAction(`Upheld disputed match ${matchId}`);
        toast.success("Match upheld — result stands");
      } else if (action === "override" && newWinnerId) {
        const { error } = await supabase.from("matches").update({ status: "confirmed", winner_id: newWinnerId, dispute_reason: null }).eq("id", matchId);
        if (error) throw error;
        await logAction(`Overrode winner on match ${matchId} → player ${newWinnerId}`);
        toast.success("Winner overridden — match confirmed");
      }
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (err: any) {
      toast.error(err?.message || "Action failed");
    } finally {
      setProcessing(null);
    }
  };

  const logAction = async (action: string) => {
    const email = session?.user?.email || "admin";
    await supabase.from("admin_logs").insert({ admin_email: email, action, created_at: new Date().toISOString() }).then(() => {});
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (matches.length === 0) return (
    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
      <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
      <h3 className="text-lg font-black text-muted-foreground dark:text-slate-300">No open disputes</h3>
      <p className="text-muted-foreground text-sm mt-1">All match results are confirmed.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-black text-slate-800 dark:text-foreground flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-500" /> Disputed Matches
          <span className="text-sm font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">{matches.length}</span>
          <InfoModal
            title="MATCH DISPUTES"
            items={[
              { badge: "LIFECYCLE", title: "Dispute Process", desc: "Players can flag a match if they disagree with the score entered by the opponent or umpire. The match remains unconfirmed until resolved." },
              { badge: "RESOLVE", title: "Admin Action", desc: "You can either Uphold the original result, or Override the winner based on offline confirmation." }
            ]}
          />
        </h2>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-slate-800 dark:hover:text-foreground transition px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {matches.map((m) => {
        const p1 = m.player1;
        const p2 = m.player2;
        const currentWinner = m.winner_id === p1?.id ? p1 : p2;
        const otherPlayer = m.winner_id === p1?.id ? p2 : p1;
        const isProcessing = processing === m.id;
        const displayScore = m.score?.split(" | ")[0] ?? m.score;

        return (
          <div key={m.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-orange-500" />

            {/* Match info */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {p1?.avatar_url ? (
                  <img src={p1.avatar_url} className="w-9 h-9 rounded-full object-cover border-2 border-slate-100 dark:border-slate-800" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>
                )}
                <div>
                  <p className="font-black text-sm text-slate-800 dark:text-foreground truncate">{p1?.full_name}</p>
                  {m.partner1 && <p className="text-[10px] text-muted-foreground">+ {m.partner1.full_name}</p>}
                </div>
              </div>

              <div className="text-center shrink-0">
                <div className="text-xs font-black font-mono text-muted-foreground dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{displayScore}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{m.category || "Friendly"}</div>
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <div className="text-right">
                  <p className="font-black text-sm text-slate-800 dark:text-foreground truncate">{p2?.full_name}</p>
                  {m.partner2 && <p className="text-[10px] text-muted-foreground">+ {m.partner2.full_name}</p>}
                </div>
                {p2?.avatar_url ? (
                  <img src={p2.avatar_url} className="w-9 h-9 rounded-full object-cover border-2 border-slate-100 dark:border-slate-800" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>
                )}
              </div>
            </div>

            {/* Dispute info */}
            <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl p-3 mb-4 border border-rose-100 dark:border-rose-900/40">
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Dispute Reason
              </p>
              <p className="text-sm text-muted-foreground dark:text-slate-300">{m.dispute_reason || "No reason provided"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Filed: {new Date(m.created_at).toLocaleDateString()} · Current winner: <span className="font-bold text-muted-foreground dark:text-slate-300">{currentWinner?.full_name}</span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={isProcessing}
                onClick={() => resolve(m.id, "uphold")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary text-foreground text-sm font-bold transition disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Uphold Result ({currentWinner?.full_name?.split(" ")[0]} wins)
              </button>
              <button
                disabled={isProcessing}
                onClick={() => resolve(m.id, "override", otherPlayer?.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-foreground text-sm font-bold transition disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                Override → {otherPlayer?.full_name?.split(" ")[0]} wins
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
