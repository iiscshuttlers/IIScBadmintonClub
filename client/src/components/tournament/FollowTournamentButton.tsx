import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscriptionService } from "@/services/subscriptionService";
import { Bell, BellOff, Check, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface FollowTournamentButtonProps {
  tournamentId: string;
  tournamentName?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function FollowTournamentButton({
  tournamentId,
  tournamentName,
  variant = "outline",
  size = "sm",
  className = "",
}: FollowTournamentButtonProps) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!userId || !tournamentId) {
      setInitialLoading(false);
      return;
    }

    let isMounted = true;
    subscriptionService
      .isFollowingTournament(userId, tournamentId)
      .then((following) => {
        if (isMounted) {
          setIsFollowing(following);
          setInitialLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setInitialLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, tournamentId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userId) {
      toast.error("Please sign in to follow tournaments");
      return;
    }

    setLoading(true);
    try {
      if (isFollowing) {
        await subscriptionService.unfollowTournament(userId, tournamentId);
        setIsFollowing(false);
        toast.success(`Unfollowed ${tournamentName || "tournament"}`);
      } else {
        await subscriptionService.followTournament(userId, tournamentId);
        setIsFollowing(true);
        toast.success(`Following ${tournamentName || "tournament"}! You'll receive match and schedule alerts.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Could not update tournament subscription");
    } finally {
      setLoading(false);
    }
  };

  if (!userId) return null;

  return (
    <Button
      variant={isFollowing ? "default" : variant}
      size={size}
      disabled={loading || initialLoading}
      onClick={handleToggle}
      className={`font-bold transition-all shadow-sm ${
        isFollowing
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "hover:border-primary text-slate-700 dark:text-slate-200"
      } ${className}`}
      title={isFollowing ? "Unfollow tournament" : "Follow tournament for match and result alerts"}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
      ) : isFollowing ? (
        <Check className="w-3.5 h-3.5 mr-1.5 text-primary-foreground" />
      ) : (
        <Bell className="w-3.5 h-3.5 mr-1.5 text-primary" />
      )}
      <span>{isFollowing ? "Following" : "Follow"}</span>
    </Button>
  );
}

