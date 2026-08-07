import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Trophy, Swords, Sparkles, TrendingUp, Heart, Share2, Video, Edit2, BarChart2, Trash2, Loader2, Bot, Bell } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMatchAlerts } from "@/hooks/useUserMatchAlerts";
import { EditVideoModal } from "./EditVideoModal";
import { MatchScorecardModal } from "./MatchScorecardModal";
import { fetchMatchSummary } from "@/lib/aiPredictor";
import { NotificationModal } from "../events/NotificationModal";

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
}

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
  children
}: MatchCardProps) {
  const p1 = match.player1;
  const p2 = match.player2;
  const isP1Winner = match.winner_id === p1?.id || match.winner_id === match.partner1?.id;
  const { isAdmin } = useAuth();
  const matchAlerts = useUserMatchAlerts(currentUser?.id);

  const [currentVideoUrl, setCurrentVideoUrl] = useState(match.video_url || null);
  const [isEditVideoOpen, setIsEditVideoOpen] = useState(false);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);

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
      const allMale = [g1, g3].every(g => g === "Male");
      const allFemale = [g1, g3].every(g => g === "Female");
      if (allMale) return "Men's Doubles";
      if (allFemale) return "Women's Doubles";
      if (g1 && g3) return "Mixed Doubles";
      return "Doubles";
    }
    if (cat === "Singles" || cat === "singles") {
      if (g1 === "Male" && g2 === "Male") return "Men's Singles";
      if (g1 === "Female" && g2 === "Female") return "Women's Singles";
      if (g1 && g2) return "Mixed Singles";
      return "Singles";
    }
    return cat;
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
  const team1Win = hasWinner && (match.winner_side === 1 || match.winner_id === p1?.id || match.winner_id === match.partner1?.id);
  const team2Win = hasWinner && !team1Win;

  const team1 = [
    { player: actualP1 },
    ...(match.partner1 ? [{ player: match.partner1 }] : []),
  ].filter((m) => m.player);
  const team2 = [
    { player: actualP2 },
    ...(match.partner2 ? [{ player: match.partner2 }] : []),
  ].filter((m) => m.player);

  // Natural-language recap of the result (only when there's a winner)
  const winnerMembers = team1Win ? team1 : team2Win ? team2 : null;
  const loserMembers = team1Win ? team2 : team2Win ? team1 : null;
  const winnerSetCount = team1Win ? setsWonP1 : setsWonP2;
  const loserSetCount = team1Win ? setsWonP2 : setsWonP1;
  const joinNames = (members: { player: any }[]) =>
    members.map((m) => m.player?.full_name?.split(" ")[0]).filter(Boolean).join(" & ");

  // Renders a team's players as stacked avatar + name rows (singles = one row)
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
            <span className={`font-bold text-xs block group-hover/p:underline line-clamp-2 whitespace-normal leading-tight ${win ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-slate-300"}`}>
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
      // Ideally trigger a reload or hide locally
      const el = document.getElementById(`match-card-${match.id}`);
      if (el) el.style.display = 'none';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      id={`match-card-${match.id}`}
      className={`bg-white dark:bg-slate-900 rounded-3xl p-2 shadow-sm relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 ${isMatchOfTheDay
          ? "border-2 border-amber-400 shadow-amber-500/20 shadow-xl hover:shadow-amber-400/30"
          : "border border-slate-100 dark:border-slate-800 hover:shadow-lg dark:hover:shadow-slate-700/40"
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
      {isLiveNow && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-red-500 to-rose-600 text-foreground text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white animate-ping inline-block" />
          LIVE NOW
        </div>
      )}

      {isAdmin && !hideActions && (
        <button
          onClick={deleteMatch}
          title="Delete Match (Admin)"
          className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors z-20"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Match of the Day Badge */}
      {isMatchOfTheDay && !isLiveNow && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-400 to-orange-500 text-foreground text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Match of the Day
        </div>
      )}

      {/* Upset Badge */}
      {upsetDiff > 0 && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-500 to-red-600 text-foreground text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-md z-10 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 animate-bounce" /> MASSIVE UPSET
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 mb-1 mt-1 md:mt-0 flex-wrap">
        <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground dark:text-muted-foreground">
          <Swords className="w-3.5 h-3.5" />
          {match.is_friendly === false ? "Tournament" : "Friendly"}
        </span>
        {(match.match_code || match.match_number) && (
          <span className="text-xs font-black text-amber-500 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
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

      {/* Date */}
      <div className="text-[11px] text-muted-foreground dark:text-muted-foreground font-bold uppercase tracking-widest text-center mb-1">
        {new Date(match.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
      </div>

      {/* Scoreboard */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-1">
        {/* Teams */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 mb-0.5">
          {renderTeam(team1, team1Win, hasWinner && !team1Win, "left")}
          <div className="text-[10px] text-muted-foreground dark:text-muted-foreground font-black uppercase tracking-widest text-center px-1">
            vs
          </div>
          {renderTeam(team2, team2Win, hasWinner && !team2Win, "right")}
        </div>

        {/* Sets-won headline */}
        {parsedSets.length > 0 && (
          <div className="text-center border-t border-slate-200 dark:border-slate-700/60 pt-1 mb-1 relative">
            <div className="flex items-center justify-center gap-2">
              <div className={`flex items-center relative transition-all ${team1Win ? "scale-110" : team2Win ? "opacity-60 grayscale" : ""}`}>
                <span className={`text-4xl sm:text-5xl font-black tracking-tighter leading-none ${team1Win ? "bg-gradient-to-br from-primary to-teal-600 bg-clip-text text-transparent drop-shadow-md" : "text-muted-foreground dark:text-muted-foreground"}`}>
                  {setsWonP1}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center">
                <span className="text-slate-300 dark:text-muted-foreground text-4xl sm:text-5xl font-black tracking-tighter leading-none mx-2">–</span>
              </div>

              <div className={`flex items-center relative transition-all ${team2Win ? "scale-110" : team1Win ? "opacity-60 grayscale" : ""}`}>
                <span className={`text-4xl sm:text-5xl font-black tracking-tighter leading-none ${team2Win ? "bg-gradient-to-br from-primary to-teal-600 bg-clip-text text-transparent drop-shadow-md" : "text-muted-foreground dark:text-muted-foreground"}`}>
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
                  <span className={`text-2xl text-center tabular-nums tracking-tight ${p1Won ? "font-black text-primary dark:text-primary" : "font-bold text-rose-500 dark:text-rose-400"}`}>{s.p1}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground bg-white dark:bg-slate-800 rounded-full px-2 py-0 border border-slate-200 dark:border-slate-700 whitespace-nowrap">Set {i + 1}</span>
                  <span className={`text-2xl text-center tabular-nums tracking-tight ${!p1Won ? "font-black text-primary dark:text-primary" : "font-bold text-rose-500 dark:text-rose-400"}`}>{s.p2}</span>
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
            <a
              href={highlightUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-500 px-2 py-1 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1 hover:scale-105 transition"
            >
              <Video className="w-3 h-3" /> Highlights
            </a>
          </div>
        )}
      </div>

      {/* Result recap */}
      {hasWinner && winnerMembers && loserMembers && (
        <div className="text-center text-[11px] mt-1.5 px-1 leading-snug flex flex-col gap-0.5">
          <span className="block font-black text-primary dark:text-primary">{joinNames(winnerMembers)}</span>
          <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-0.5">defeated</span>
          <span className="block font-semibold text-slate-500 dark:text-slate-400 line-through decoration-slate-400/50 mb-0.5">{joinNames(loserMembers)}</span>
          <span className="block mt-0.5">
            <span style={{ color: 'var(--color-primary)' }} className="font-black">{winnerSetCount}</span>
            <span className="text-slate-400 dark:text-slate-500 mx-1">–</span>
            <span style={{ color: '#ef4444' }} className="font-black dark:text-rose-400">{loserSetCount}</span>
          </span>
          {displayScore && (
            <span className="block tabular-nums text-slate-600 dark:text-slate-400">
              ({parsedSets.map((s, i) => (
                <span key={i}>
                  <span style={{ color: team1Win ? 'var(--color-primary)' : '#ef4444' }} className="font-semibold">{s.p1}</span>
                  <span className="text-slate-400 dark:text-slate-500 mx-0.5">-</span>
                  <span style={{ color: team2Win ? 'var(--color-primary)' : '#ef4444' }} className="font-semibold">{s.p2}</span>
                  {i < parsedSets.length - 1 && <span className="text-slate-400 dark:text-slate-500">, </span>}
                </span>
              ))})
            </span>
          )}
        </div>
      )}

      <EditVideoModal
        isOpen={isEditVideoOpen}
        onClose={() => setIsEditVideoOpen(false)}
        matchId={match.id}
        initialUrl={highlightUrl || ""}
        onSuccess={(url) => setCurrentVideoUrl(url)}
      />

      <MatchScorecardModal
        match={match}
        isOpen={isScorecardOpen}
        onClose={() => setIsScorecardOpen(false)}
        currentUser={currentUser}
      />

      <NotificationModal
        isOpen={isNotifyOpen}
        onClose={() => setIsNotifyOpen(false)}
        matchTime={match.scheduled_at}
        onSave={async (mins) => {
          if (!currentUser) {
            toast.error("Please login to set alerts");
            return;
          }
          try {
            const { error } = await supabase.from("user_match_notifications").upsert({
              user_id: currentUser.id,
              match_id: match.id,
              notify_before_mins: mins
            }, { onConflict: "user_id,match_id" });
            if (error) throw error;
          } catch (e) {
            toast.error("Failed to set alert");
          }
        }}
        title={`Alert: ${match.team1_label || actualP1?.full_name || "TBD"} vs ${match.team2_label || actualP2?.full_name || "TBD"}`}
        defaultMins={15}
      />

      {/* Children (e.g., Accept/Reject buttons) */}
      {children && <div className="mt-4">{children}</div>}

      {/* AI Summary Block */}
      {isGeneratingSummary && (
        <div className="mt-1.5 p-2 rounded-2xl bg-gradient-to-br from-indigo-50 to-primary/5 dark:from-indigo-950/30 dark:to-primary/90/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col items-center justify-center min-h-[80px]">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mb-2" />
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 animate-pulse">Gemini is analyzing the match...</span>
        </div>
      )}

      {aiSummary && !isGeneratingSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 p-2.5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-foreground shadow-lg border border-indigo-500/30 relative overflow-hidden"
        >
          <div className="absolute -top-6 -right-6 text-indigo-500/20">
            <Sparkles className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-2 mb-2 text-indigo-300">
            <Bot className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">AI Recap</span>
          </div>
          <p className="text-sm font-medium leading-relaxed relative z-10 text-slate-100 whitespace-pre-wrap break-words">
            "{aiSummary}"
          </p>
        </motion.div>
      )}

      {/* Reaction Kudos & Edit */}
      {!hideActions && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-0.5 relative z-10">
          {/* Actions Row */}
          <div className="flex justify-between items-center px-1">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary || !!aiSummary}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${aiSummary
                  ? "text-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 opacity-70"
                  : "text-muted-foreground dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              {isGeneratingSummary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Recap
            </button>

            <div className="flex gap-1">
              {(!hasWinner || match.status === "scheduled" || match.status === "pending") && (
                (() => {
                  const alert = matchAlerts.find(a => a.match_id === match.id);
                  if (alert && match.scheduled_at) {
                    const notifyDate = new Date(match.scheduled_at);
                    if (!isNaN(notifyDate.getTime())) {
                      notifyDate.setMinutes(notifyDate.getMinutes() - alert.notify_before_mins);
                      const timeStr = notifyDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold text-accent bg-accent/10 border border-accent/20">
                          <Bell className="w-3.5 h-3.5 fill-current" />
                          <span>Notified at {timeStr}</span>
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsNotifyOpen(true); }}
                            className="ml-0.5 underline hover:text-accent-foreground"
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
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-muted-foreground dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
                    >
                      <Bell className="w-3.5 h-3.5" /> Notify
                    </button>
                  );
                })()
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsScorecardOpen(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-muted-foreground dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                <BarChart2 className="w-3.5 h-3.5" /> Scorecard
              </button>
            </div>
          </div>

          {/* Like / Share */}
          <div className="flex justify-between items-center px-1">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onKudos) onKudos();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${isKudosed
                  ? "text-rose-500 bg-rose-50 dark:bg-rose-500/20"
                  : "text-muted-foreground dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              <Heart className={`w-4 h-4 ${isKudosed ? "scale-110" : ""}`} fill={isKudosed ? "currentColor" : "none"} stroke="currentColor" />
              <span className="kudos-count font-medium ml-0.5">{kudosCount} {kudosCount === 1 ? 'like' : 'likes'}</span>
            </button>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onShare) onShare();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-muted-foreground dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>

          {/* Add Video — last, centered, only for players involved in this match */}
          {isPlayerInMatch && (
            <div className="flex justify-center">
              <button
                onClick={() => setIsEditVideoOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-muted-foreground dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {highlightUrl ? "Edit Video" : "Add Video"}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
