import { useState, useEffect } from "react";
import { UserPlus, UserCheck, UserMinus, Loader2, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  targetPlayerId: string;
}

type BuddyStatus = "none" | "pending_sent" | "pending_received" | "accepted";

export function BuddyButton({ targetPlayerId }: Props) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<BuddyStatus>("none");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!profile?.id || !targetPlayerId) { setLoading(false); return; }

    const check = async () => {
      const { data } = await supabase
        .from("buddy_requests")
        .select("id, status, sender_id")
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${targetPlayerId}),and(sender_id.eq.${targetPlayerId},receiver_id.eq.${profile.id})`)
        .maybeSingle();

      if (data) {
        setRequestId(data.id);
        if (data.status === "accepted") setStatus("accepted");
        else if (data.sender_id === profile.id) setStatus("pending_sent");
        else setStatus("pending_received");
      } else {
        setStatus("none");
        setRequestId(null);
      }
      setLoading(false);
    };
    check();
  }, [profile?.id, targetPlayerId]);

  if (!profile?.id || profile.id === targetPlayerId) return null;
  if (loading) return <div className="w-24 h-9 rounded-xl shimmer" />;

  const sendRequest = async () => {
    const previousStatus = status;
    setStatus("pending_sent");
    const { data, error } = await supabase.from("buddy_requests").insert({
      sender_id: profile.id,
      receiver_id: targetPlayerId,
    }).select("id").single();
    if (error) { toast.error("Failed to send request"); setStatus(previousStatus); }
    else { setRequestId(data.id); toast.success("Buddy request sent!"); }
  };

  const accept = async () => {
    if (!requestId) return;
    const previousStatus = status;
    setStatus("accepted");
    const { error } = await supabase.from("buddy_requests").update({ status: "accepted" }).eq("id", requestId);
    if (error) { toast.error("Failed to accept"); setStatus(previousStatus); }
    else { toast.success("Buddy request accepted!"); }
  };

  const remove = async () => {
    if (!requestId) return;
    const isAccepted = status === "accepted";
    const isSent = status === "pending_sent";
    const msg = isAccepted ? "Are you sure you want to remove this buddy?" : 
                isSent ? "Are you sure you want to cancel the buddy request?" : 
                "Are you sure you want to decline the buddy request?";
    if (!confirm(msg)) return;

    const previousStatus = status;
    setStatus("none");
    const { error } = await supabase.from("buddy_requests").delete().eq("id", requestId);
    if (error) { toast.error("Failed to remove"); setStatus(previousStatus); }
    else { setRequestId(null); toast.success("Action completed."); }
  };

  if (status === "none") return (
    <button onClick={sendRequest} disabled={acting}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary font-bold text-xs hover:bg-primary/15 dark:hover:bg-primary/90/50 transition disabled:opacity-50">
      {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
      Add Buddy
    </button>
  );

  if (status === "pending_sent") return (
    <button onClick={remove} disabled={acting}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground font-bold text-xs hover:bg-rose-50 hover:text-rose-500 transition disabled:opacity-50">
      {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
      Request Sent
    </button>
  );

  if (status === "pending_received") return (
    <div className="flex items-center gap-2">
      <button onClick={accept} disabled={acting}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-bold text-xs transition disabled:opacity-50">
        {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
        Accept
      </button>
      <button onClick={remove} disabled={acting}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground font-bold text-xs hover:bg-rose-50 hover:text-rose-500 transition disabled:opacity-50">
        Decline
      </button>
    </div>
  );

  return (
    <button onClick={remove} disabled={acting}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary font-bold text-xs hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-50 group">
      {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
        <>
          <UserCheck className="w-3.5 h-3.5 group-hover:hidden" />
          <UserMinus className="w-3.5 h-3.5 hidden group-hover:block" />
        </>
      )}
      <span className="group-hover:hidden">Buddies</span>
      <span className="hidden group-hover:inline">Remove</span>
    </button>
  );
}
