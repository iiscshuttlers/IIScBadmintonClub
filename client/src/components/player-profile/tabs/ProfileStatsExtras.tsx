import { Activity } from "lucide-react";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { usePlayerPersonal } from "@/hooks/usePlayerPersonal";
import { MotionAnalyticsPanels } from "@/components/personal/PersonalStatsSection";
import { ProfileFormCard } from "@/components/player-profile/tabs/ProfileFormCard";
import type { FormRow } from "@/lib/profileForm";

/** Form & clutch for any profile, from the player's tournament matches. */
export function ProfileStatsForm({ playerId }: { playerId: string }) {
  const { matches, loading } = usePlayerMatches(playerId);
  if (loading) return <div className="h-48 rounded-3xl bg-muted/60 animate-pulse" aria-busy="true" aria-label="Loading form" />;
  return <ProfileFormCard matches={matches as unknown as FormRow[]} playerId={playerId} />;
}

/**
 * Movement from your phone or watch (running, smash sprints, intensity).
 * Sensor data is private: render this only on your own profile.
 */
export function OwnMovementPanels({ playerId }: { playerId: string }) {
  const { data } = usePlayerPersonal(playerId);
  const motionMatches = data?.motionMatches ?? [];
  if (motionMatches.length === 0) return null;
  return (
    <section aria-labelledby="own-movement-heading" className="space-y-3">
      <h2
        id="own-movement-heading"
        className="text-sm font-black uppercase tracking-widest text-foreground/60 flex items-center gap-2"
      >
        <Activity className="w-4 h-4 text-primary" aria-hidden /> Your movement
        <span className="text-[10px] font-bold normal-case tracking-normal text-muted-foreground">· only you see this</span>
      </h2>
      <MotionAnalyticsPanels motionMatches={motionMatches} />
    </section>
  );
}
