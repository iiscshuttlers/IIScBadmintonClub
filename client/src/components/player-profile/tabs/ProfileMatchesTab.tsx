import { useState } from "react";
import { Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { MatchesSection, type FormatTab } from "@/components/personal/PersonalMatchesSection";

/**
 * The profile Matches tab: every tournament match of the player as a card,
 * live first, then upcoming, then results, with format filters and win rates.
 * (It was Training › Matches, owner-only; the results table stays on Overview.)
 */
export function ProfileMatchesTab({ playerId }: { playerId: string }) {
  const { profile } = useAuth();
  const { matches, loading, error } = usePlayerMatches(playerId);
  const [formatTab, setFormatTab] = useState<FormatTab>("All");

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading matches">
        <div className="h-24 rounded-2xl bg-muted/60 animate-pulse" />
        <div className="h-40 rounded-2xl bg-muted/60 animate-pulse" />
        <div className="h-40 rounded-2xl bg-muted/60 animate-pulse" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-soft">
        Matches could not load. Check your connection and open the tab again.
      </div>
    );
  }
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Trophy className="w-6 h-6 text-muted-foreground mx-auto mb-2" aria-hidden />
        <p className="text-sm font-semibold text-muted-foreground">No tournament matches yet</p>
      </div>
    );
  }
  return (
    <MatchesSection
      matches={[]}
      fullMatches={matches}
      formatTab={formatTab}
      setFormatTab={setFormatTab}
      currentUser={profile}
      playerId={playerId}
    />
  );
}
