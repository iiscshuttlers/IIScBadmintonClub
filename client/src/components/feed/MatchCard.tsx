import { winningSide } from "@/lib/matchResult";
import { resolveTeamMembers } from "@/lib/teamNames";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Trophy, Swords, Sparkles, TrendingUp, Share2, Video, Edit2, BarChart2, Trash2, Bell, Clock, MapPin, PlayCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { deleteTournamentMatch } from "@/services/tournamentService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useUserMatchAlerts } from "@/hooks/useUserMatchAlerts";
import { EditVideoModal } from "./EditVideoModal";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { MatchScorecardModal } from "./MatchScorecardModal";
import { MatchReminderModal } from "../pulse/MatchReminderModal";
import { courtLabel, matchOutcome } from "@/lib/matchView";
import { MatchStatusBadge, MatchTimes } from "@/components/match/MatchPrimitives";
import { matchPath } from "@/lib/tournamentRoutes";

const isApp = Capacitor.isNativePlatform();

interface MatchCardProps {
  match: any;
  currentUser: any;
  isLiveNow?: boolean;
  isMatchOfTheDay?: boolean;
  upsetDiff?: number;
  onShare?: () => void;
  index?: number;
  hideActions?: boolean;
  children?: React.ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
}

const CAT_BOX_COLORS: Record<string, string> = {
  MS: "bg-cat-ms/10 border-cat-ms/25",
  WS: "bg-cat-ws/10 border-cat-ws/25",
  MD: "bg-cat-md/10 border-cat-md/20",
  WD: "bg-cat-wd/10 border-cat-wd/25",
  XD: "bg-cat-xd/10 border-cat-xd/25",
  BS: "bg-team/10 border-team/25",
  GS: "bg-danger/10 border-danger/25",
  BD: "bg-accent/10 border-accent/25",
  GD: "bg-individual/10 border-individual/25",
};

export function MatchCard({
  match,
  currentUser,
  isLiveNow = false,
  isMatchOfTheDay = false,
  upsetDiff = 0,
  onShare,
  index = 0,
  hideActions = false,
  children,
  isExpanded: controlledIsExpanded,
  onToggleExpand
}: MatchCardProps) {
  const p1 = match.player1;
  const p2 = match.player2;
  const { isAdmin } = useAuth();
  const { confirm } = useConfirm();
  const matchAlerts = useUserMatchAlerts(currentUser?.id);

  const [currentVideoUrl, setCurrentVideoUrl] = useState(match.video_url || null);
  const [isEditVideoOpen, setIsEditVideoOpen] = useState(false);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(isLiveNow || isMatchOfTheDay);

  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : localExpanded;

  const handleSetExpanded = (val: boolean) => {
    if (onToggleExpand) {
      onToggleExpand(val);
    } else {
      setLocalExpanded(val);
    }
  };

  let displayScore = match.score || match.match_score || "";
  let highlightUrl = currentVideoUrl;

  // Legacy support where video URL was appended to score
  if (displayScore.includes(" | ")) {
    const parts = displayScore.split(" | ");
    displayScore = parts[0];
    if (!highlightUrl) highlightUrl = parts[1];
  }

  // Strip a trailing team annotation (e.g. "21-15 [Mixed Doubles: ...]")
  displayScore = displayScore.replace(/\s*\[.*$/, "").trim();

  const getDisplayCategory = () => {
    const cat = match.category || "";
    // Already has a full label (from umpire submissions)
    if (cat.includes("Mixed") || cat.includes("Men's") || cat.includes("Women's")) return cat;

    const g1 = p1?.gender;
    const g2 = p2?.gender;
    const g3 = match.partner1?.gender;
    const g4 = match.partner2?.gender;

    if (cat === "Doubles" || cat === "doubles") {
      if (g1 === "Male" && g2 === "Male" && g3 === "Male" && g4 === "Male") return "Men's Doubles";
      if (g1 === "Female" && g2 === "Female" && g3 === "Female" && g4 === "Female") return "Women's Doubles";
      return "Mixed Doubles";
    }

    if (cat === "Singles" || cat === "singles") {
      if (g1 === "Male" && g2 === "Male") return "Men's Singles";
      if (g1 === "Female" && g2 === "Female") return "Women's Singles";
    }
    return cat;
  };

  const getMatchCodeColor = (code: string | undefined) => {
    if (!code) return { text: "text-warning", bg: "bg-warning/10 border-warning/20 group-hover/header:bg-warning/20" };
    const c = code.toUpperCase();
    if (c.startsWith("MS")) return { text: "text-cat-ms", bg: "bg-cat-ms/10 border-cat-ms/20 group-hover/header:bg-cat-ms/20" };
    if (c.startsWith("MD")) return { text: "text-cat-md", bg: "bg-cat-md/10 border-cat-md/20 group-hover/header:bg-cat-md/20" };
    if (c.startsWith("WS")) return { text: "text-cat-ws", bg: "bg-cat-ws/10 border-cat-ws/20 group-hover/header:bg-cat-ws/20" };
    if (c.startsWith("WD")) return { text: "text-cat-wd", bg: "bg-cat-wd/10 border-cat-wd/20 group-hover/header:bg-cat-wd/20" };
    if (c.startsWith("XD")) return { text: "text-cat-xd", bg: "bg-cat-xd/10 border-cat-xd/20 group-hover/header:bg-cat-xd/20" };
    return { text: "text-warning", bg: "bg-warning/10 border-warning/20 group-hover/header:bg-warning/20" };
  };



  const isPlayerInMatch = currentUser && (
    match.player1_id === currentUser.id ||
    match.player2_id === currentUser.id ||
    match.team1_partner_id === currentUser.id ||
    match.team2_partner_id === currentUser.id
  );

  // Tournament rows use the shared WP6 rules: status from the `status` column,
  // winners only for completed/walkover, games via parseGames. Other rows
  // fall back to lib/matchResult (winner_side first).
  const isTournamentRow =
    match.is_friendly === false && !!match.tournament_id && typeof match.status === "string" && "winner_side" in match;
  const outcome = isTournamentRow ? matchOutcome(match) : null;
  if (outcome) displayScore = outcome.scoreText ?? (outcome.games.length ? displayScore : "");

  // Parse set scores from "15-21, 22-20, 19-21" into per-side points
  const parsedSets = outcome
    ? outcome.games.map((g) => ({ p1: g.side1, p2: g.side2 }))
    : displayScore
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .map((s: string) => {
      const [a, b] = s.split("-").map((n: string) => parseInt(n.trim(), 10));
      if (Number.isNaN(a) || Number.isNaN(b)) return null;
      return { p1: a, p2: b };
    })
    .filter(Boolean) as { p1: number; p2: number }[];

  const setsWonP1 = parsedSets.filter((s) => s.p1 > s.p2).length;
  const setsWonP2 = parsedSets.filter((s) => s.p2 > s.p1).length;

  const mockPlayer = (label: string | null) => label ? { id: `mock-${label}`, full_name: label, avatar_url: null, gender: "Unknown" } : null;
  const actualP1 = p1 || mockPlayer(match.team1_label);
  const actualP2 = p2 || mockPlayer(match.team2_label);

  const fallbackSide = outcome ? null : winningSide(match);
  const hasWinner = outcome ? outcome.t1Won || outcome.t2Won : fallbackSide != null;
  const actualIsLiveNow = isLiveNow && !hasWinner;

  const team1Win = outcome ? outcome.t1Won : fallbackSide === 1;
  const team2Win = outcome ? outcome.t2Won : hasWinner && !team1Win;
  const courtText = match.court_number ? (outcome ? courtLabel(String(match.court_number)) : `Court ${match.court_number}`) : null;

  // A doubles partner who was never linked to a player record comes back null
  // from the join, so resolve against team*_label as well. See lib/teamNames.
  const team1 = resolveTeamMembers(p1, match.partner1, match.team1_label).map((player) => ({ player }));
  const team2 = resolveTeamMembers(p2, match.partner2, match.team2_label).map((player) => ({ player }));

  const winnerMembers = team1Win ? team1 : team2Win ? team2 : null;
  const loserMembers = team1Win ? team2 : team2Win ? team1 : null;
  const winnerSetCount = team1Win ? setsWonP1 : setsWonP2;
  const loserSetCount = team1Win ? setsWonP2 : setsWonP1;
  const joinNames = (members: { player: any }[]) =>
    members.map((m) => m.player?.full_name).filter(Boolean).join(" & ");

  const renderTeam = (
    members: { player: any }[],
    win: boolean,
    dim: boolean,
    align: "left" | "right"
  ) => (
    <div className="flex flex-col gap-1.5">
      {members.map(({ player }, i) => {
        const nameEl = (
          <div className="flex-1 min-w-0">
            <span className={`font-bold text-xs block group-hover/p:underline break-words whitespace-normal leading-tight ${align === "right" ? "text-right" : "text-left"} ${win ? "text-primary" : "text-soft"}`}>
              {player.full_name}
            </span>
          </div>
        );
        const avatarEl = (
          <div className="relative shrink-0">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                loading="lazy"
                className={`w-7 h-7 rounded-full object-cover shadow-sm ${win ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : dim ? "grayscale opacity-70" : ""}`}
              />
            ) : (
              <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground shadow-sm ${win ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : dim ? "grayscale opacity-70" : ""}`}>
                {player.full_name?.substring(0, 2).toUpperCase() || "??"}
              </div>
            )}
            {win && (
              <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 border border-border shadow-sm">
                <Trophy className="w-2 h-2" />
              </div>
            )}
          </div>
        );
        return (
          <Link key={i} href={`/player/${player.id}`} className="flex items-center gap-1.5 group/p">
            {align === "right" ? (<>{nameEl}{avatarEl}</>) : (<>{avatarEl}{nameEl}</>)}
          </Link>
        );
      })}
    </div>
  );

  const deleteMatch = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete Match?",
      description: "Are you sure you want to permanently delete this match record?",
      confirmLabel: "Delete",
      confirmVariant: "danger"
    });
    if (!ok) return;
    try {
      await deleteTournamentMatch(match.id);
      toast.success("Match deleted");
      const el = document.getElementById(`match-card-${match.id}`);
      if (el) el.style.display = 'none';
    } catch {
      toast.error("Failed to delete match");
    }
  };

  const formatBoxClass = CAT_BOX_COLORS[match.category] || "bg-card border-border";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      id={`match-card-${match.id}`}
      className={`${formatBoxClass} rounded-3xl p-1 sm:p-2 shadow-sm relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 border ${isMatchOfTheDay
          ? "border-2 border-info shadow-info/20 shadow-xl hover:shadow-media/40"
          : "hover:shadow-lg"
        }`}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, info) => {
        if (info.offset.x < -100 && onShare) {
          onShare();
        }
      }}
    >
      {/* LIVE NOW Badge */}
      {actualIsLiveNow && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-live to-live text-on-accent text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-foreground animate-ping inline-block" />
          LIVE NOW
        </div>
      )}



      {/* Match of the Day Badge */}
      {isMatchOfTheDay && !actualIsLiveNow && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-info to-individual text-on-accent text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Match of the Day
        </div>
      )}

      {/* Upset Badge */}
      {upsetDiff > 0 && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-danger to-danger text-on-accent text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-md z-10 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 animate-bounce" /> MASSIVE UPSET
        </div>
      )}

      {!isExpanded ? (
        <div className={`cursor-pointer select-none ${actualIsLiveNow || isMatchOfTheDay ? 'pt-6 sm:pt-4' : ''}`} onClick={() => handleSetExpanded(true)}>
          <div className="flex flex-row items-stretch px-1 py-1 mt-1 sm:mt-0 gap-2 w-full">
            {/* Main 2-row content */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              {/* Row 1: Tournament label + match code on left, category + round on right */}
              <div className="flex flex-row items-center justify-between w-full min-w-0">
                <div className={`flex items-center gap-1.5 font-black uppercase tracking-widest text-[9px] sm:text-[10px] min-w-0 ${match.status === "finished" || hasWinner ? "text-muted-foreground" : "text-primary"}`}>
                  {match.status === "finished" || hasWinner ? <Trophy className="w-3 h-3 shrink-0" /> : <Swords className="w-3 h-3 shrink-0" />}
                  <span className="truncate">Tournament</span>
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span className={`${getMatchCodeColor(match.match_code).text} truncate font-black`}>{match.match_code || `Match #${match.match_number}`}</span>
                </div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground font-bold shrink-0 ml-2 flex items-center gap-2">
                  {highlightUrl && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsVideoPlayerOpen(true); }}
                      className="text-danger hover:text-danger/80 transition-colors"
                      title="Play Highlights"
                    >
                      <PlayCircle className="w-4 h-4 animate-pulse" />
                    </button>
                  )}
                  <span className="truncate">{getDisplayCategory()}{match.round_name ? ` • ${match.round_name}` : ""}</span>
                  {outcome && <MatchStatusBadge view={outcome} />}
                </div>
              </div>

              {/* Schedule & Court Info */}
              {(match.scheduled_at || match.court_number) && (
                <div className="flex flex-row items-center justify-start gap-3 w-full min-w-0 mb-0.5">
                  {match.scheduled_at && (
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(match.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                  {match.court_number && (
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {courtText}
                    </span>
                  )}
                </div>
              )}

              {/* Row 2: Name | Score | Name */}
              <div className="flex flex-row items-center justify-between gap-1.5 font-bold">
                <span className={`text-xs sm:text-sm leading-tight text-right break-words w-full ${team1Win ? 'text-gold' : 'text-soft'}`}>
                  {joinNames(team1)}
                </span>

                <div className="shrink-0">
                  <div className={`text-xs sm:text-sm font-black tracking-widest px-2 sm:px-3 py-0.5 rounded-lg border shadow-inner whitespace-nowrap ${hasWinner ? 'text-gold bg-gold/10 border-gold/20' : 'text-foreground bg-muted/50 border-border-strong'}`}>
                    {parsedSets.length > 0 ? (
                      <span>{setsWonP1}-{setsWonP2}</span>
                    ) : (
                      displayScore || "—"
                    )}
                  </div>
                </div>

                <span className={`text-xs sm:text-sm leading-tight text-left break-words w-full ${team2Win ? 'text-gold' : 'text-soft'}`}>
                  {joinNames(team2)}
                </span>
              </div>
            </div>

            {/* Expand chevron — spans both rows */}
            <div className="flex items-center justify-center shrink-0 pl-1 border-l border-border/50">
              <button aria-label="Expand match" className="w-11 h-11 flex items-center justify-center bg-muted/50 text-muted-foreground rounded-full group-hover:bg-muted-strong group-hover:text-foreground transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col relative pt-2 sm:pt-0">
          
          <div 
            className="cursor-pointer group/header transition-opacity hover:opacity-80" 
            onClick={() => handleSetExpanded(false)}
            title="Collapse Match"
          >
            <div className="flex items-center justify-center gap-1.5 mb-1 mt-1 md:mt-0 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                <Swords className="w-3.5 h-3.5" />
                Tournament
              </span>
              {(match.match_code || match.match_number) && (
                <span className={`text-xs font-black ${getMatchCodeColor(match.match_code).text} ${getMatchCodeColor(match.match_code).bg} px-2 py-0.5 rounded-full border transition-colors`}>
                  {match.match_code || `Match #${match.match_number}`}
                </span>
              )}
              {match.category && (
                <span className="text-xs font-black text-soft bg-muted px-2 py-0.5 rounded-full">
                  {getDisplayCategory()}
                </span>
              )}
              {match.round_name && (
                <span className="text-[11px] font-semibold text-muted-foreground">
                  • {match.round_name}
                </span>
              )}
              {outcome && <MatchStatusBadge view={outcome} />}
            </div>

            {/* Schedule & Court Info */}
            {outcome ? (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center mb-2 mt-1">
                <MatchTimes
                  view={{
                    state: outcome.state,
                    scheduledAt: match.scheduled_at ?? null,
                    startedAt: match.started_at ?? null,
                    endedAt: match.ended_at ?? null,
                  }}
                />
                {courtText && (
                  <span className="flex items-center gap-1 text-xs font-bold text-primary">
                    <MapPin className="w-3 h-3" />
                    {courtText}
                  </span>
                )}
              </div>
            ) : (
            <div className="flex flex-row items-center justify-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center mb-2 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(match.scheduled_at || match.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              {match.court_number && (
                <span className="flex items-center gap-1 text-primary">
                  <MapPin className="w-3 h-3" />
                  Court {match.court_number}
                </span>
              )}
            </div>
            )}
          </div>

          {/* Scoreboard */}
      <div className="rounded-2xl border border-border bg-muted/30 p-1">
        {/* Teams */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-0.5">
          <div className="flex justify-start w-full min-w-0">
            {renderTeam(team1, team1Win, hasWinner && !team1Win, "left")}
          </div>
          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center px-1 py-0.5 sm:py-0">
            vs
          </div>
          <div className="flex justify-end w-full min-w-0">
            {renderTeam(team2, team2Win, hasWinner && !team2Win, "right")}
          </div>
        </div>

        {/* Sets-won headline */}
        {parsedSets.length > 0 && (
          <div className="text-center border-t border-border-strong/60 pt-1 mb-1 relative">
            <div className="flex items-center justify-center gap-2">
              <div className={`flex items-center relative transition-all ${team1Win ? "scale-110" : team2Win ? "opacity-60 grayscale" : ""}`}>
                <span className={`text-3xl font-black tracking-tighter leading-none ${team1Win ? "bg-gradient-to-br from-primary to-team bg-clip-text text-transparent drop-shadow-md" : "text-muted-foreground"}`}>
                  {setsWonP1}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center">
                <span className="text-muted-foreground text-3xl font-black tracking-tighter leading-none mx-2">–</span>
              </div>

              <div className={`flex items-center relative transition-all ${team2Win ? "scale-110" : team1Win ? "opacity-60 grayscale" : ""}`}>
                <span className={`text-3xl font-black tracking-tighter leading-none ${team2Win ? "bg-gradient-to-br from-primary to-team bg-clip-text text-transparent drop-shadow-md" : "text-muted-foreground"}`}>
                  {setsWonP2}
                </span>
              </div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">sets</div>
          </div>
        )}

        {/* Set-by-set */}
        {parsedSets.length > 0 ? (
          <div className="space-y-0.5">
            {parsedSets.map((s, i) => {
              const p1Won = s.p1 > s.p2;
              return (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                  <span className={`text-xl text-center tabular-nums tracking-tight ${p1Won ? "font-black text-primary" : "font-bold text-danger"}`}>{s.p1}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted rounded-full px-2 py-0 border border-border-strong whitespace-nowrap">Set {i + 1}</span>
                  <span className={`text-xl text-center tabular-nums tracking-tight ${!p1Won ? "font-black text-primary" : "font-bold text-danger"}`}>{s.p2}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-t border-border-strong/60 pt-3 text-center text-2xl font-black tracking-tight text-foreground">
            {displayScore || "—"}
          </div>
        )}

        {highlightUrl && (
          <div className="flex justify-center mt-1.5">
            <button
              onClick={() => setIsVideoPlayerOpen(true)}
              className="text-[10px] font-bold bg-danger/10 text-danger px-2 py-1 rounded-full border border-danger/40 flex items-center gap-1 hover:scale-105 transition"
            >
              <Video className="w-3 h-3" /> Highlights
            </button>
          </div>
        )}
          {/* Result recap - Single Sentence */}
      {hasWinner && winnerMembers && loserMembers && (
        <div className="text-center text-[12px] sm:text-[13px] mt-2 px-2 leading-snug">
          <span className="font-black text-primary">{joinNames(winnerMembers)}</span>
          <span className="text-success font-bold mx-1.5 uppercase text-[10px] sm:text-xs tracking-wider">defeated</span>
          <span className="font-semibold text-muted-foreground">{joinNames(loserMembers)}</span>

        </div>
      )}

      <EditVideoModal
        isOpen={isEditVideoOpen}
        onClose={() => setIsEditVideoOpen(false)}
        matchId={match.id}
        tableName="tournament_matches"
        initialUrl={highlightUrl || ""}
        onSuccess={(url) => setCurrentVideoUrl(url)}
      />
      
      <VideoPlayerModal
        isOpen={isVideoPlayerOpen}
        onClose={() => setIsVideoPlayerOpen(false)}
        videoUrl={highlightUrl || ""}
      />

      <MatchScorecardModal
        match={match}
        isOpen={isScorecardOpen}
        onClose={() => setIsScorecardOpen(false)}
      />

      {currentUser && (
        <MatchReminderModal
          isOpen={isNotifyOpen}
          onClose={() => setIsNotifyOpen(false)}
          matchId={match.id}
          userId={currentUser.id}
          initialGlobalMins={currentUser.default_match_reminder_mins}
        />
      )}

      {/* Children (e.g., Accept/Reject buttons) */}
      {children && <div className="mt-4">{children}</div>}



      {/* Grid Actions & Score Row */}
      {!hideActions && (
        <div className="mt-2 pt-2 border-t border-border/50 flex flex-col items-center gap-1.5 relative z-10 px-0.5">
          

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between w-full">
            {/* Left: spacer keeps the scoreboard button centred */}
            <div className="flex-1 min-w-0" />

            {/* Center: Scoreboard */}
            <div className="flex items-center justify-center flex-1 min-w-0">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsScorecardOpen(true); }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full text-[11px] font-bold text-soft bg-muted/80 hover:bg-muted-strong ring-1 ring-border-strong/50 transition-all active:scale-95 shadow-sm max-w-full"
              >
                <BarChart2 className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                <span className="truncate">Scoreboard</span>
              </button>
            </div>

            {/* Right: Share, Notify */}
            <div className="flex items-center justify-end gap-1 flex-1 min-w-0">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onShare) onShare(); }}
                className="flex items-center justify-end gap-1.5 px-2 py-1.5 min-h-[44px] rounded-full text-[11px] font-bold text-muted-foreground hover:bg-muted transition-all active:scale-95 max-w-full"
              >
                <span className="truncate">Share</span>
                <Share2 className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
              
              {(!hasWinner || match.status === "scheduled" || match.status === "pending") && (
                (() => {
                  const alert = matchAlerts.find(a => a.match_id === match.id);
                  if (alert && match.scheduled_at) {
                    const notifyDate = new Date(match.scheduled_at);
                    if (!isNaN(notifyDate.getTime())) {
                      notifyDate.setMinutes(notifyDate.getMinutes() - alert.remind_before_mins);
                      const timeStr = notifyDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div className="flex items-center justify-end gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 max-w-full">
                          <span className="truncate">At {timeStr}</span>
                          <Bell className="w-3 h-3 fill-current flex-shrink-0" />
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsNotifyOpen(true); }}
                            className="ml-0.5 underline hover:text-accent-foreground flex-shrink-0 min-h-[44px] px-1"
                          >
                            Edit
                          </button>
                        </div>
                      );
                    }
                  }
                  return (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsNotifyOpen(true); }}
                      className="flex items-center justify-end gap-1.5 px-2 py-1.5 min-h-[44px] rounded-full text-[11px] font-bold text-muted-foreground hover:bg-muted transition-all active:scale-95 max-w-full"
                    >
                      <span className="truncate">Notify</span>
                      <Bell className="w-3.5 h-3.5 flex-shrink-0" />
                    </button>
                  );
                })()
              )}
            </div>
          </div>

          {outcome && (
            <Link
              href={matchPath(match.tournament_id, match.id)}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center min-h-[44px] px-3 rounded-full text-[11px] font-black text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Match details →
            </Link>
          )}

          {/* Add Video — span full width, centered, only for players involved in this match or admins */}
          {(isPlayerInMatch || isAdmin) && (
            <div className="col-span-3 flex justify-center mt-0.5">
              <button
                onClick={() => setIsEditVideoOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 min-h-[44px] rounded-full text-[11px] font-bold text-muted-foreground hover:bg-muted transition-all active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {highlightUrl ? "Edit Video" : "Add Video"}
              </button>
            </div>
          )}
        </div>
      )}

      </div>

          <div className="mt-2 flex items-center justify-center border-t border-border/50 pt-1 px-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleSetExpanded(false); }}
              aria-label="Collapse match"
              className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full transition shadow-sm"
              title="Collapse"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
