import { resolveTeamMembers } from "@/lib/teamNames";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Trophy, Swords, Sparkles, TrendingUp, Heart, Share2, Video, Edit2, BarChart2, Trash2, Loader2, Bot, Bell, Clock, MapPin, PlayCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMatchAlerts } from "@/hooks/useUserMatchAlerts";
import { EditVideoModal } from "./EditVideoModal";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { MatchScorecardModal } from "./MatchScorecardModal";
import { fetchMatchSummary } from "@/lib/aiPredictor";
import { MatchReminderModal } from "../pulse/MatchReminderModal";

const isApp = Capacitor.isNativePlatform();

interface MatchCardProps {
  match: any;
  currentUser: any;
  isLiveNow?: boolean;
  isMatchOfTheDay?: boolean;
  upsetDiff?: number;
  isKudosed: boolean;
  kudosCount: number;
  onKudos?: () => void;
  onShare?: () => void;
  index?: number;
  hideActions?: boolean;
  children?: React.ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
}

const CAT_BOX_COLORS: Record<string, string> = {
  MS: "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40",
  WS: "bg-pink-50/80 dark:bg-pink-900/20 border-pink-200 dark:border-pink-900/40",
  MD: "bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/20",
  WD: "bg-purple-50/80 dark:bg-purple-900/20 border-purple-200 dark:border-purple-900/40",
  XD: "bg-orange-50/80 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/40",
  BS: "bg-teal-50/80 dark:bg-teal-900/20 border-teal-200 dark:border-teal-900/40",
  GS: "bg-rose-50/80 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/40",
  BD: "bg-cyan-50/80 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-900/40",
  GD: "bg-fuchsia-50/80 dark:bg-fuchsia-900/20 border-fuchsia-200 dark:border-fuchsia-900/40",
};

export function MatchCard({
  match,
  currentUser,
  isLiveNow = false,
  isMatchOfTheDay = false,
  upsetDiff = 0,
  isKudosed,
  kudosCount,
  onKudos,
  onShare,
  index = 0,
  hideActions = false,
  children,
  isExpanded: controlledIsExpanded,
  onToggleExpand
}: MatchCardProps) {
  const p1 = match.player1;
  const p2 = match.player2;
  const isP1Winner = match.winner_id === p1?.id || match.winner_id === match.partner1?.id;
  const { isAdmin } = useAuth();
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

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const handleGenerateSummary = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (aiSummary || isGeneratingSummary) return;

    setIsGeneratingSummary(true);
    try {
      const summary = await fetchMatchSummary(match);
      setAiSummary(summary);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI summary.");
    } finally {
      setIsGeneratingSummary(false);
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

  // Strip team annotation appended by umpire_submit_match (e.g. "21-15 [Mixed Doubles: ...]")
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
    if (!code) return { text: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20 group-hover/header:bg-amber-500/20" };
    const c = code.toUpperCase();
    if (c.startsWith("MS")) return { text: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20 group-hover/header:bg-blue-500/20" };
    if (c.startsWith("MD")) return { text: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20 group-hover/header:bg-emerald-500/20" };
    if (c.startsWith("WS")) return { text: "text-pink-500 dark:text-pink-400", bg: "bg-pink-500/10 border-pink-500/20 group-hover/header:bg-pink-500/20" };
    if (c.startsWith("WD")) return { text: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/20 group-hover/header:bg-purple-500/20" };
    if (c.startsWith("XD")) return { text: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/20 group-hover/header:bg-orange-500/20" };
    return { text: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20 group-hover/header:bg-amber-500/20" };
  };



  const isPlayerInMatch = currentUser && (
    match.player1_id === currentUser.id ||
    match.player2_id === currentUser.id ||
    match.team1_partner_id === currentUser.id ||
    match.team2_partner_id === currentUser.id
  );

  // Parse set scores from "15-21, 22-20, 19-21" into per-side points
  const parsedSets = displayScore
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

  const hasWinner = !!match.winner_id || !!match.winner_side;
  const actualIsLiveNow = isLiveNow && !hasWinner;

  const team1Win = hasWinner && (match.winner_side === 1 || match.winner_id === p1?.id || match.winner_id === match.partner1?.id);
  const team2Win = hasWinner && !team1Win;

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
            <span className={`font-bold text-xs block group-hover/p:underline line-clamp-2 whitespace-normal leading-tight ${align === "right" ? "text-right" : "text-left"} ${win ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-slate-300"}`}>
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
                className={`w-7 h-7 rounded-full object-cover shadow-sm ${win ? "ring-2 ring-primary ring-offset-1 dark:ring-offset-slate-900" : dim ? "grayscale opacity-70" : ""}`}
              />
            ) : (
              <div className={`w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-muted-foreground shadow-sm ${win ? "ring-2 ring-primary ring-offset-1 dark:ring-offset-slate-900" : dim ? "grayscale opacity-70" : ""}`}>
                {player.full_name?.substring(0, 2).toUpperCase() || "??"}
              </div>
            )}
            {win && (
              <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 border border-white dark:border-slate-900 shadow-sm">
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
    if (!confirm("Are you sure you want to permanently delete this match?")) return;
    const tableName = match.is_friendly === false ? "tournament_matches" : "matches";
    const { error } = await supabase.from(tableName).delete().eq("id", match.id);
    if (error) {
      toast.error("Failed to delete match");
    } else {
      toast.success("Match deleted");
      const el = document.getElementById(`match-card-${match.id}`);
      if (el) el.style.display = 'none';
    }
  };

  const formatBoxClass = CAT_BOX_COLORS[match.category] || "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      id={`match-card-${match.id}`}
      className={`${formatBoxClass} rounded-3xl p-1 sm:p-2 shadow-sm relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 border ${isMatchOfTheDay
          ? "border-2 border-indigo-500 shadow-indigo-500/20 shadow-xl hover:shadow-indigo-500/30"
          : "hover:shadow-lg dark:hover:shadow-slate-700/40"
        }`}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, info) => {
        if (info.offset.x > 100 && onKudos) {
          onKudos();
        } else if (info.offset.x < -100 && onShare) {
          onShare();
        }
      }}
    >
      {/* LIVE NOW Badge */}
      {actualIsLiveNow && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-red-500 to-rose-600 text-on-accent text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white animate-ping inline-block" />
          LIVE NOW
        </div>
      )}



      {/* Match of the Day Badge */}
      {isMatchOfTheDay && !actualIsLiveNow && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Match of the Day
        </div>
      )}

      {/* Upset Badge */}
      {upsetDiff > 0 && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-500 to-red-600 text-on-accent text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-md z-10 flex items-center gap-1.5">
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
                <div className={`flex items-center gap-1.5 font-black uppercase tracking-widest text-[9px] sm:text-[10px] min-w-0 ${match.status === "finished" || hasWinner ? "text-slate-400 dark:text-slate-500" : "text-primary"}`}>
                  {match.status === "finished" || hasWinner ? <Trophy className="w-3 h-3 shrink-0" /> : <Swords className="w-3 h-3 shrink-0" />}
                  <span className="truncate">{match.is_friendly === false ? "Tournament" : "Friendly"}</span>
                  <span className="text-slate-600 shrink-0">•</span>
                  <span className={`${getMatchCodeColor(match.match_code).text} truncate font-black`}>{match.match_code || `Match #${match.match_number}`}</span>
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 font-bold shrink-0 ml-2 flex items-center gap-2">
                  {highlightUrl && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsVideoPlayerOpen(true); }}
                      className="text-rose-500 hover:text-rose-600 transition-colors"
                      title="Play Highlights"
                    >
                      <PlayCircle className="w-4 h-4 animate-pulse" />
                    </button>
                  )}
                  <span className="truncate">{getDisplayCategory()}{match.round_name ? ` • ${match.round_name}` : ""}</span>
                </div>
              </div>

              {/* Schedule & Court Info */}
              {(match.scheduled_at || match.court_number) && (
                <div className="flex flex-row items-center justify-start gap-3 w-full min-w-0 mb-0.5">
                  {match.scheduled_at && (
                    <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(match.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                  {match.court_number && (
                    <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Court {match.court_number}
                    </span>
                  )}
                </div>
              )}

              {/* Row 2: Name | Score | Name */}
              <div className="flex flex-row items-center justify-between gap-1.5 font-bold">
                <span className={`text-xs sm:text-sm leading-tight text-right break-words w-full ${team1Win ? 'text-amber-500 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {joinNames(team1)}
                </span>

                <div className="shrink-0">
                  <div className={`text-xs sm:text-sm font-black tracking-widest px-2 sm:px-3 py-0.5 rounded-lg border shadow-inner whitespace-nowrap ${hasWinner ? 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : 'text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                    {parsedSets.length > 0 ? (
                      <span>{setsWonP1}-{setsWonP2}</span>
                    ) : (
                      displayScore || "—"
                    )}
                  </div>
                </div>

                <span className={`text-xs sm:text-sm leading-tight text-left break-words w-full ${team2Win ? 'text-amber-500 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {joinNames(team2)}
                </span>
              </div>
            </div>

            {/* Expand chevron — spans both rows */}
            <div className="flex items-center justify-center shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800/50">
              <button className="p-1.5 sm:p-2 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded-full group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
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
              <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground dark:text-muted-foreground">
                <Swords className="w-3.5 h-3.5" />
                {match.is_friendly === false ? "Tournament" : "Friendly"}
              </span>
              {(match.match_code || match.match_number) && (
                <span className={`text-xs font-black ${getMatchCodeColor(match.match_code).text} ${getMatchCodeColor(match.match_code).bg} px-2 py-0.5 rounded-full border transition-colors`}>
                  {match.match_code || `Match #${match.match_number}`}
                </span>
              )}
              {match.category && (
                <span className="text-xs font-black text-muted-foreground dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {getDisplayCategory()}
                </span>
              )}
              {match.round_name && (
                <span className="text-[11px] font-semibold text-muted-foreground dark:text-slate-400">
                  • {match.round_name}
                </span>
              )}
            </div>

            {/* Schedule & Court Info */}
            <div className="flex flex-row items-center justify-center gap-4 text-[10px] text-muted-foreground dark:text-muted-foreground font-bold uppercase tracking-widest text-center mb-2 mt-1">
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
          </div>

          {/* Scoreboard */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-1">
        {/* Teams */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-0.5">
          <div className="flex justify-start w-full min-w-0">
            {renderTeam(team1, team1Win, hasWinner && !team1Win, "left")}
          </div>
          <div className="text-[10px] text-muted-foreground dark:text-muted-foreground font-black uppercase tracking-widest text-center px-1 py-0.5 sm:py-0">
            vs
          </div>
          <div className="flex justify-end w-full min-w-0">
            {renderTeam(team2, team2Win, hasWinner && !team2Win, "right")}
          </div>
        </div>

        {/* Sets-won headline */}
        {parsedSets.length > 0 && (
          <div className="text-center border-t border-slate-200 dark:border-slate-700/60 pt-1 mb-1 relative">
            <div className="flex items-center justify-center gap-2">
              <div className={`flex items-center relative transition-all ${team1Win ? "scale-110" : team2Win ? "opacity-60 grayscale" : ""}`}>
                <span className={`text-3xl font-black tracking-tighter leading-none ${team1Win ? "bg-gradient-to-br from-primary to-teal-600 bg-clip-text text-transparent drop-shadow-md" : "text-muted-foreground dark:text-muted-foreground"}`}>
                  {setsWonP1}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center">
                <span className="text-slate-300 dark:text-muted-foreground text-3xl font-black tracking-tighter leading-none mx-2">–</span>
              </div>

              <div className={`flex items-center relative transition-all ${team2Win ? "scale-110" : team1Win ? "opacity-60 grayscale" : ""}`}>
                <span className={`text-3xl font-black tracking-tighter leading-none ${team2Win ? "bg-gradient-to-br from-primary to-teal-600 bg-clip-text text-transparent drop-shadow-md" : "text-muted-foreground dark:text-muted-foreground"}`}>
                  {setsWonP2}
                </span>
              </div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground mt-0.5">sets</div>
          </div>
        )}

        {/* Set-by-set */}
        {parsedSets.length > 0 ? (
          <div className="space-y-0.5">
            {parsedSets.map((s, i) => {
              const p1Won = s.p1 > s.p2;
              return (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                  <span className={`text-xl text-center tabular-nums tracking-tight ${p1Won ? "font-black text-primary dark:text-primary" : "font-bold text-rose-500 dark:text-rose-400"}`}>{s.p1}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground bg-white dark:bg-slate-800 rounded-full px-2 py-0 border border-slate-200 dark:border-slate-700 whitespace-nowrap">Set {i + 1}</span>
                  <span className={`text-xl text-center tabular-nums tracking-tight ${!p1Won ? "font-black text-primary dark:text-primary" : "font-bold text-rose-500 dark:text-rose-400"}`}>{s.p2}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-t border-slate-200 dark:border-slate-700/60 pt-3 text-center text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            {displayScore || "—"}
          </div>
        )}

        {highlightUrl && (
          <div className="flex justify-center mt-1.5">
            <button
              onClick={() => setIsVideoPlayerOpen(true)}
              className="text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-500 px-2 py-1 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1 hover:scale-105 transition"
            >
              <Video className="w-3 h-3" /> Highlights
            </button>
          </div>
        )}
          {/* Result recap - Single Sentence */}
      {hasWinner && winnerMembers && loserMembers && (
        <div className="text-center text-[12px] sm:text-[13px] mt-2 px-2 leading-snug">
          <span className="font-black text-primary dark:text-primary">{joinNames(winnerMembers)}</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold mx-1.5 uppercase text-[10px] sm:text-xs tracking-wider">defeated</span>
          <span className="font-semibold text-slate-500 dark:text-slate-400">{joinNames(loserMembers)}</span>

        </div>
      )}

      <EditVideoModal
        isOpen={isEditVideoOpen}
        onClose={() => setIsEditVideoOpen(false)}
        matchId={match.id}
        tableName={match.is_friendly === false ? "tournament_matches" : "matches"}
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
        currentUser={currentUser}
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
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/50 flex flex-col items-center gap-1.5 relative z-10 px-0.5">
          

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between w-full">
            {/* Left: Like */}
            <div className="flex items-center justify-start flex-1 min-w-0">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onKudos) onKudos(); }}
                className={`flex items-center justify-start gap-1.5 px-2 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 max-w-full ${isKudosed
                    ? "text-rose-500 bg-rose-50 dark:bg-rose-500/20"
                    : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
              >
                <Heart className={`w-3.5 h-3.5 flex-shrink-0 ${isKudosed ? "scale-110" : ""}`} fill={isKudosed ? "currentColor" : "none"} stroke="currentColor" />
                <span className="truncate">{kudosCount} {kudosCount === 1 ? 'like' : 'likes'}</span>
              </button>
            </div>

            {/* Center: Scoreboard */}
            <div className="flex items-center justify-center flex-1 min-w-0">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsScorecardOpen(true); }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-700/50 transition-all active:scale-95 shadow-sm max-w-full"
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
                className="flex items-center justify-end gap-1.5 px-2 py-1.5 rounded-full text-[11px] font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 max-w-full"
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
                            className="ml-0.5 underline hover:text-accent-foreground flex-shrink-0"
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
                      className="flex items-center justify-end gap-1.5 px-2 py-1.5 rounded-full text-[11px] font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 max-w-full"
                    >
                      <span className="truncate">Notify</span>
                      <Bell className="w-3.5 h-3.5 flex-shrink-0" />
                    </button>
                  );
                })()
              )}
            </div>
          </div>

          {/* Add Video — span full width, centered, only for players involved in this match or admins */}
          {(isPlayerInMatch || isAdmin) && (
            <div className="col-span-3 flex justify-center mt-0.5">
              <button
                onClick={() => setIsEditVideoOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {highlightUrl ? "Edit Video" : "Add Video"}
              </button>
            </div>
          )}
        </div>
      )}

      </div>

          <div className="mt-2 flex items-center justify-center border-t border-slate-100 dark:border-slate-800/50 pt-1 px-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleSetExpanded(false); }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition shadow-sm"
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
