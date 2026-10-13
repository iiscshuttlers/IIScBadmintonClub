import { useEffect, useState } from "react";
import { ShieldBan, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";

// user_blocks is new; generated types regenerate after migration. Cast until then.
const sb = supabase as any;

interface BlockedRow {
  blocked_id: string;
  player: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

/**
 * #29 Lets a user see and undo the players they've blocked. Blocks are created
 * from the Report modal ("also block"); this is the only place to unblock.
 */
export function BlockedPlayersSection({ myPlayerId }: { myPlayerId: string | null | undefined }) {
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!myPlayerId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    sb.from("user_blocks")
      .select("blocked_id, player:players!blocked_id(id, full_name, avatar_url)")
      .eq("blocker_id", myPlayerId)
      .then(({ data }: any) => {
        if (!cancelled) {
          setRows(data || []);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [myPlayerId]);

  const unblock = async (blockedId: string, name: string) => {
    if (!myPlayerId) return;
    setBusyId(blockedId);
    const { error } = await sb
      .from("user_blocks")
      .delete()
      .eq("blocker_id", myPlayerId)
      .eq("blocked_id", blockedId);
    setBusyId(null);
    if (error) {
      toast.error("Couldn't unblock");
      return;
    }
    setRows((prev) => prev.filter((r) => r.blocked_id !== blockedId));
    queryClient.invalidateQueries({ queryKey: ["blocked-players", myPlayerId] });
    track("player_unblocked");
    toast.success(`Unblocked ${name}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="px-4 py-5 text-sm text-muted-foreground text-center">
        You haven't blocked anyone. Blocked players are hidden from the directory and match-finding.
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((r) => {
        const name = r.player?.full_name || "Unknown player";
        return (
          <div key={r.blocked_id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
              {r.player?.avatar_url ? (
                <img src={r.player.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserRound className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground truncate">{name}</span>
            <button
              onClick={() => unblock(r.blocked_id, name.split(" ")[0])}
              disabled={busyId === r.blocked_id}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-foreground hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"
            >
              {busyId === r.blocked_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Unblock"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
