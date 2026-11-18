import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import type { PlayerRow } from "@/types";
import { queueOfflineAction } from "@/hooks/useOfflineSync";

/** The pending-match fields used to pick the confirmer's Elo change. */
type PendingMatchSides = {
  id: string;
  player2_id?: string | null;
  team1_partner_id?: string | null;
  team2_partner_id?: string | null;
};

/** Elo deltas returned by confirm_friendly_match. */
type ConfirmEloChanges = {
  p1_elo_change?: number;
  p2_elo_change?: number;
  p3_elo_change?: number;
  p4_elo_change?: number;
};

export function useMatchActions(
  ownPlayerProfile: PlayerRow | null,
  fetchPendingMatches: (userId: string) => void,
  setRawMatches: React.Dispatch<React.SetStateAction<any[]>>,
  pendingMatches: PendingMatchSides[]
) {
  const handleConfirmMatch = async (matchId: string) => {
    if (!ownPlayerProfile) return;
    if (!navigator.onLine) {
      queueOfflineAction({ type: "confirm", matchId, confirmerId: ownPlayerProfile.id });
      toast.info("You're offline — confirmation queued and will sync when reconnected.");
      return;
    }
    try {
      const { data, error } = await supabase.rpc("confirm_friendly_match", {
        match_uuid: matchId,
        confirmer_id: ownPlayerProfile.id,
      });
      if (error) throw error;
      const elo = data as ConfirmEloChanges;
      let myEloChange = elo.p1_elo_change;
      const targetMatch = pendingMatches.find(m => m.id === matchId);
      if (targetMatch) {
        if (targetMatch.player2_id === ownPlayerProfile.id) myEloChange = elo.p2_elo_change;
        if (targetMatch.team1_partner_id === ownPlayerProfile.id) myEloChange = elo.p3_elo_change;
        if (targetMatch.team2_partner_id === ownPlayerProfile.id) myEloChange = elo.p4_elo_change;
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#f59e0b"]
      });

      toast.success("Match Confirmed!", {
        description: `Elo Ratings Updated. Your Elo Change: ${myEloChange || 0}`,
      });
      fetchPendingMatches(ownPlayerProfile.id);
    } catch (e) {
      toast.error("Error confirming match", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    if (!ownPlayerProfile) return;
    if (!navigator.onLine) {
      queueOfflineAction({ type: "reject", matchId, rejecterId: ownPlayerProfile.id });
      toast.info("You're offline — rejection queued and will sync when reconnected.");
      return;
    }
    try {
      const { error } = await supabase.rpc("reject_friendly_match", {
        match_uuid: matchId,
        rejecter_id: ownPlayerProfile.id,
      });
      if (error) throw error;
      toast.success("Match Rejected", {
        description: "The match request has been dismissed.",
      });
      fetchPendingMatches(ownPlayerProfile.id);
    } catch (e) {
      toast.error("Error rejecting match", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleResendRequest = async (match: object) => {
    try {
      const { error } = await supabase.functions.invoke("notify-match", {
        body: { type: "INSERT", table: "matches", record: match },
      });
      if (error) throw error;
      toast.success("Request resent to opponent(s)");
    } catch (e) {
      toast.error("Failed to resend request", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleWithdrawMatch = async (matchId: string) => {
    if (!ownPlayerProfile) return;
    toast("Withdraw this match?", {
      description:
        "Are you sure you want to withdraw this pending match log? It will be deleted permanently.",
      action: {
        label: "Withdraw",
        onClick: async () => {
          if (!navigator.onLine) {
            queueOfflineAction({ type: "withdraw", matchId });
            setRawMatches((prev) => prev.filter((m) => m.id !== matchId));
            toast.info("You're offline — withdrawal queued and will sync when reconnected.");
            return;
          }
          try {
            const { data, error } = await supabase
              .from("matches")
              .delete()
              .eq("id", matchId)
              .select("id");
            if (error) throw error;
            if (!data || data.length === 0) {
              throw new Error(
                "Delete was denied by the server. You may not have permission to withdraw this match.",
              );
            }
            toast.success("Match withdrawn successfully.");
            setRawMatches((prev) => prev.filter((m) => m.id !== matchId));
            fetchPendingMatches(ownPlayerProfile.id);
          } catch (e) {
            toast.error("Error withdrawing match", { description: e instanceof Error ? e.message : String(e) });
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => { } },
    });
  };

  return {
    handleConfirmMatch,
    handleRejectMatch,
    handleResendRequest,
    handleWithdrawMatch,
  };
}
