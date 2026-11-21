import { winningSide } from "@/lib/matchResult";
import React, { useState, useEffect } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Trophy, Clock, Shield, Edit2, Lock, FileText, CheckCircle2 } from "lucide-react";
import { resolveTeamName } from "@/lib/teamNames";
import { MatchScorecardModal } from "@/components/feed/MatchScorecardModal";

export interface RecentMatchData {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  team1_partner_id: string | null;
  team2_partner_id: string | null;
  winner_id: string | null;
  winner_side?: number | null;
  score: string;
  sets_history?: string[] | null;
  round?: string;
  round_name?: string;
  is_friendly?: boolean | null;
  is_tournament_match?: boolean;
  category: string;
  created_at: string;
  scored_at?: string | null;
  scored_by?: string | null;
  player1: { full_name: string; gender?: string | null } | null;
  player2: { full_name: string; gender?: string | null } | null;
  partner1: { full_name: string; gender?: string | null } | null;
  partner2: { full_name: string; gender?: string | null } | null;
  team1_label?: string;
  team2_label?: string;
  match_code?: string | null;
  rubber_label?: string | null;
  court_number?: string | null;
  court?: string | null;
  tie?: {
    id: string;
    tie_code?: string;
    team_a?: { name: string; short_name?: string };
    team_b?: { name: string; short_name?: string };
  } | null;
}

interface RecentMatchCardProps {
  match: RecentMatchData;
  isAdmin: boolean;
  currentUserId?: string;
  onEdit: (match: any) => void;
}

// BWF-style Category Color Accents
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MS: { bg: "bg-cat-ms/15", text: "text-cat-ms", border: "border-cat-ms/30" },
  WS: { bg: "bg-cat-ws/15", text: "text-cat-ws", border: "border-cat-ws/30" },
  MD: { bg: "bg-cat-md/15", text: "text-cat-md", border: "border-cat-md/30" },
  WD: { bg: "bg-cat-wd/15", text: "text-cat-wd", border: "border-cat-wd/30" },
  XD: { bg: "bg-cat-xd/15", text: "text-cat-xd", border: "border-cat-xd/30" },
};

export function RecentMatchCard({ match, isAdmin, currentUserId, onEdit }: RecentMatchCardProps) {
  const [showScorecard, setShowScorecard] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const scoredTime = match.scored_at || match.created_at;
  const matchTimestamp = scoredTime ? new Date(scoredTime).getTime() : Date.now();
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  // Live Countdown Timer Hook
  useEffect(() => {
    const updateCountdown = () => {
      const elapsed = Date.now() - matchTimestamp;
      const left = TEN_MINUTES_MS - elapsed;
      setTimeRemaining(left > 0 ? left : 0);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [matchTimestamp]);

  const isEditable = isAdmin || (timeRemaining !== null && timeRemaining > 0);
  const minutesLeft = timeRemaining !== null ? Math.floor(timeRemaining / 60000) : 0;
  const secondsLeft = timeRemaining !== null ? Math.floor((timeRemaining % 60000) / 1000) : 0;
  const isUrgent = timeRemaining !== null && timeRemaining > 0 && timeRemaining <= 2 * 60 * 1000;

  // Resolve Category
  const p1g = match.player1?.gender?.toLowerCase();
  const p2g = match.player2?.gender?.toLowerCase();
  const p3g = match.partner1?.gender?.toLowerCase();
  const p4g = match.partner2?.gender?.toLowerCase();

  let resolvedCategory = (match.category || "").toUpperCase();
  if (resolvedCategory === "DOUBLES" || (!resolvedCategory && (match.partner1 || match.partner2))) {
    const t1HasM = p1g === "male" || p3g === "male";
    const t1HasF = p1g === "female" || p3g === "female";
    const t2HasM = p2g === "male" || p4g === "male";
    const t2HasF = p2g === "female" || p4g === "female";
    if (t1HasM && t1HasF && t2HasM && t2HasF) resolvedCategory = "XD";
    else if (p1g === "female" && p3g === "female") resolvedCategory = "WD";
    else resolvedCategory = "MD";
  } else if (resolvedCategory === "SINGLES" || !resolvedCategory) {
    if (p1g === "female" || p2g === "female") resolvedCategory = "WS";
    else resolvedCategory = "MS";
  }

  // Parse Sets: extract { s1, s2, s1Won, s2Won }[]
  const rawScore = match.score || "";
  const parsedSets = rawScore
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const parts = s.split("-");
      if (parts.length !== 2) return null;
      const s1 = parseInt(parts[0].trim(), 10);
      const s2 = parseInt(parts[1].trim(), 10);
      if (Number.isNaN(s1) || Number.isNaN(s2)) return null;
      return {
        s1,
        s2,
        s1Won: s1 > s2,
        s2Won: s2 > s1,
      };
    })
    .filter(Boolean) as { s1: number; s2: number; s1Won: boolean; s2Won: boolean }[];

  // Determine winner sides
  // The recorded result wins; games decide only when none is recorded.
  const recordedSide = winningSide(match);
  const side1Won = recordedSide != null
    ? recordedSide === 1
    : parsedSets.filter(s => s.s1Won).length > parsedSets.filter(s => s.s2Won).length;

  const side2Won = recordedSide != null
    ? recordedSide === 2
    : !side1Won && parsedSets.filter(s => s.s2Won).length > parsedSets.filter(s => s.s1Won).length;

  // Names
  const team1DisplayName = resolveTeamName(match.player1, match.partner1, match.team1_label);
  const team2DisplayName = resolveTeamName(match.player2, match.partner2, match.team2_label);

  const catStyle = CATEGORY_COLORS[resolvedCategory] || {
    bg: "bg-muted-strong/30",
    text: "text-soft",
    border: "border-border-strong",
  };

  const isScoredByMe = Boolean(currentUserId && match.scored_by === currentUserId);
  const courtText = match.court_number || match.court;

  return (
    <>
      <div className="bg-card/90 rounded-2xl border border-border hover:border-border-strong/80 transition-all shadow-sm overflow-hidden flex flex-col justify-between">
        
        {/* 1. Header Bar: Category, Rubber/Stage, Court & Scored Time */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-background/40 border-b border-border/80 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Pill */}
            <span className={`px-2 py-0.5 rounded-md font-black text-[11px] tracking-wider border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
              {resolvedCategory}
            </span>

            {/* Match Code / Rubber Label */}
            {match.match_code && (
              <span className="font-mono font-bold text-[11px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded border border-border-strong/60">
                {match.match_code}
              </span>
            )}

            {/* Team Tie Context or Stage */}
            {match.rubber_label && (
              <span className="font-bold text-[11px] text-primary/90">
                {match.rubber_label}
              </span>
            )}

            {match.tie && (
              <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
                ({match.tie.team_a?.short_name || match.tie.team_a?.name || "Team A"} vs {match.tie.team_b?.short_name || match.tie.team_b?.name || "Team B"})
              </span>
            )}

            {match.round && !match.rubber_label && (
              <span className="text-[11px] text-muted-foreground font-medium">
                {match.round}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 text-muted-foreground text-[11px] font-medium">
            {courtText && (
              <span className="px-2 py-0.5 rounded bg-muted/60 border border-border-strong/50 font-semibold text-soft">
                Court {courtText}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span title={format(new Date(matchTimestamp), "PPPpp")}>
                {formatDistanceToNowStrict(new Date(matchTimestamp), { addSuffix: true })}
              </span>
            </span>
          </div>
        </div>

        {/* 2. Main 2-Row BWF Scoreboard Display */}
        <div className="p-4 space-y-2">
          
          {/* Side 1 Row */}
          <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
            side1Won
              ? "bg-success/10 border-success/30 text-foreground"
              : "bg-muted/40 border-border/80 text-soft"
          }`}>
            <div className="flex items-center gap-2.5 min-w-0 pr-3">
              <div className="w-5 flex justify-center shrink-0">
                {side1Won ? (
                  <Trophy className="w-4 h-4 text-gold drop-shadow-sm" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-faint" />
                )}
              </div>
              <div className="min-w-0">
                <span className={`text-sm truncate block ${side1Won ? "font-black text-foreground" : "font-semibold text-soft"}`}>
                  {team1DisplayName}
                </span>
                {match.team1_label && match.team1_label.trim().toLowerCase() !== team1DisplayName.trim().toLowerCase() && (
                  <span className="text-[10px] text-muted-foreground font-mono block">
                    {match.team1_label}
                  </span>
                )}
              </div>
            </div>

            {/* Set Columns */}
            <div className="flex items-center gap-1.5 shrink-0 font-mono">
              {parsedSets.map((s, idx) => (
                <div
                  key={idx}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border transition-all ${
                    s.s1Won
                      ? "bg-success/20 text-success border-success/40 shadow-xs"
                      : "bg-card/60 text-muted-foreground border-border-strong/60"
                  }`}
                >
                  {s.s1}
                </div>
              ))}
            </div>
          </div>

          {/* Side 2 Row */}
          <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
            side2Won
              ? "bg-success/10 border-success/30 text-foreground"
              : "bg-muted/40 border-border/80 text-soft"
          }`}>
            <div className="flex items-center gap-2.5 min-w-0 pr-3">
              <div className="w-5 flex justify-center shrink-0">
                {side2Won ? (
                  <Trophy className="w-4 h-4 text-gold drop-shadow-sm" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-faint" />
                )}
              </div>
              <div className="min-w-0">
                <span className={`text-sm truncate block ${side2Won ? "font-black text-foreground" : "font-semibold text-soft"}`}>
                  {team2DisplayName}
                </span>
                {match.team2_label && match.team2_label.trim().toLowerCase() !== team2DisplayName.trim().toLowerCase() && (
                  <span className="text-[10px] text-muted-foreground font-mono block">
                    {match.team2_label}
                  </span>
                )}
              </div>
            </div>

            {/* Set Columns */}
            <div className="flex items-center gap-1.5 shrink-0 font-mono">
              {parsedSets.map((s, idx) => (
                <div
                  key={idx}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border transition-all ${
                    s.s2Won
                      ? "bg-success/20 text-success border-success/40 shadow-xs"
                      : "bg-card/60 text-muted-foreground border-border-strong/60"
                  }`}
                >
                  {s.s2}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* 3. Footer Bar: Edit Countdown Status & Action Buttons */}
        <div className="px-4 py-2.5 bg-background/30 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          
          {/* Status info & Scored attribution */}
          <div className="flex items-center gap-2 flex-wrap">
            {isScoredByMe && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Scored by You
              </span>
            )}

            {/* Grace Period Timer */}
            {isAdmin ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-individual/10 text-individual border border-individual/30 flex items-center gap-1">
                <Shield className="w-3 h-3 text-individual" /> Admin Override Active
              </span>
            ) : timeRemaining !== null && timeRemaining > 0 ? (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                isUrgent
                  ? "bg-danger/15 text-danger border-danger/30 animate-pulse"
                  : "bg-warning/10 text-warning border-warning/30"
              }`}>
                <Clock className="w-3 h-3" /> {minutesLeft}m {secondsLeft}s left to edit
              </span>
            ) : (
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> Edit window closed (10m passed)
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowScorecard(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-soft bg-muted hover:bg-muted-strong hover:text-foreground border border-border-strong/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              Scorecard
            </button>

            {isEditable ? (
              <button
                type="button"
                onClick={() => onEdit({ ...match, is_edit_mode: true })}
                className="px-3.5 py-1.5 rounded-xl text-xs font-black text-primary-foreground bg-primary hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/20"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Score
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-faint bg-card border border-border cursor-not-allowed flex items-center gap-1.5"
                title="Editing is locked 10 minutes after match completion. Contact an administrator to adjust scores."
              >
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Locked
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Point-by-Point Scorecard Modal */}
      {showScorecard && (
        <MatchScorecardModal
          match={{
            ...match,
            match_score: match.score,
          }}
          isOpen={showScorecard}
          onClose={() => setShowScorecard(false)}
        />
      )}
    </>
  );
}
