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
    setActing(true);
    const { data, error } = await supabase.from("buddy_requests").insert({
      sender_id: profile.id,
      receiver_id: targetPlayerId,
    }).select("id").single();
    if (error) { toast.error("Failed to send request"); }
    else { setStatus("pending_sent"); setRequestId(data.id); toast.success("Buddy request sent!"); }
    setActing(false);
  };

  const accept = async () => {
    if (!requestId) return;
    setActing(true);
    const { error } = await supabase.from("buddy_requests").update({ status: "accepted" }).eq("id", requestId);
    if (error) { toast.error("Failed to accept"); }
    else { setStatus("accepted"); toast.success("Buddy request accepted!"); }
    setActing(false);
  };

  const remove = async () => {
    if (!requestId) return;
    setActing(true);
    const { error } = await supabase.from("buddy_requests").delete().eq("id", requestId);
    if (error) { toast.error("Failed to remove"); }
    else { setStatus("none"); setRequestId(null); toast.success("Buddy removed."); }
    setActing(false);
  };

  if (status === "none") return (
    <button onClick={sendRequest} disabled={acting}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition disabled:opacity-50">
      {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
      Add Buddy
    </button>
  );

  if (status === "pending_sent") return (
    <button onClick={remove} disabled={acting}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs hover:bg-rose-50 hover:text-rose-500 transition disabled:opacity-50">
      {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
      Request Sent
    </button>
  );

  if (status === "pending_received") return (
    <div className="flex items-center gap-2">
      <button onClick={accept} disabled={acting}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50">
        {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
        Accept
      </button>
      <button onClick={remove} disabled={acting}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs hover:bg-rose-50 hover:text-rose-500 transition disabled:opacity-50">
        Decline
      </button>
    </div>
  );

  return (
    <button onClick={remove} disabled={acting}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-50 group">
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
