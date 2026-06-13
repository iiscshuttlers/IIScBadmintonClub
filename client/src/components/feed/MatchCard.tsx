import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Trophy, Swords, Sparkles, TrendingUp, Star, Share2, Video, Edit2 } from "lucide-react";
import { EditVideoModal } from "./EditVideoModal";

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
  children
}: MatchCardProps) {
  const p1 = match.player1;
  const p2 = match.player2;
  const isP1Winner = match.winner_id === p1?.id;

  const [currentVideoUrl, setCurrentVideoUrl] = useState(match.video_url || null);
  const [isEditVideoOpen, setIsEditVideoOpen] = useState(false);

  let displayScore = match.score || match.match_score || "";
  let highlightUrl = currentVideoUrl;
  
  // Legacy support where video URL was appended to score
  if (displayScore.includes(" | ")) {
    const parts = displayScore.split(" | ");
    displayScore = parts[0];
    if (!highlightUrl) highlightUrl = parts[1];
  }

  const isPlayerInMatch = currentUser && (
    match.player1_id === currentUser.id ||
    match.player2_id === currentUser.id ||
    match.team1_partner_id === currentUser.id ||
    match.team2_partner_id === currentUser.id
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      id={`match-card-${match.id}`}
      className={`bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 ${
        isMatchOfTheDay
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
        <div className="absolute top-0 left-0 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white animate-ping inline-block" />
          LIVE NOW
        </div>
      )}

      {/* Match of the Day Badge */}
      {isMatchOfTheDay && !isLiveNow && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Match of the Day
        </div>
      )}

      {/* Upset Badge */}
      {upsetDiff > 0 && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-md z-10 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 animate-bounce" /> MASSIVE UPSET
        </div>
      )}

      <div className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 mb-3 flex items-center justify-center gap-1 mt-2 md:mt-0">
        <Swords className="w-3.5 h-3.5" />
        {match.round || (match.is_friendly === false ? "Tournament Match" : "Friendly Match")}
        {match.status === "pending" && (
           <span className="ml-2 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px]">PENDING</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Player 1 (and Partner 1) */}
        <div
          className={`flex-1 flex flex-col sm:flex-row items-center gap-3 p-3 rounded-2xl transition-colors ${
            isP1Winner ? "bg-emerald-50 dark:bg-emerald-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
          }`}
        >
          <div className="relative flex">
            {p1 && (
              <Link href={`/player/${p1.id}`}>
                <img
                  src={p1.avatar_url || ""}
                  loading="lazy"
                  className={`w-12 h-12 rounded-full object-cover shadow-sm relative z-10 ${
                    isP1Winner ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : "grayscale opacity-80"
                  }`}
                />
              </Link>
            )}
            {match.partner1 && (
              <Link href={`/player/${match.partner1.id}`}>
                <img
                  loading="lazy"
                  src={match.partner1.avatar_url || ""}
                  className={`w-12 h-12 rounded-full object-cover shadow-sm -ml-4 relative z-0 ${
                    isP1Winner ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : "grayscale opacity-80"
                  }`}
                />
              </Link>
            )}
            {isP1Winner && (
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm z-20">
                <Trophy className="w-3 h-3" />
              </div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <div
              className={`font-black text-sm ${
                isP1Winner ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {p1 && (
                <Link href={`/player/${p1.id}`} className="hover:underline">
                  {p1.full_name}
                </Link>
              )}
              {match.partner1 && (
                <>
                  <br />
                  <Link href={`/player/${match.partner1.id}`} className="hover:underline">
                    {match.partner1.full_name}
                  </Link>
                </>
              )}
            </div>
            {match.elo_change_p1 && (
              <div
                className={`text-xs font-bold ${
                  match.elo_change_p1 > 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {match.elo_change_p1 > 0 ? "+" : ""}
                {match.elo_change_p1} ELO
              </div>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="shrink-0 flex flex-col items-center">
          <div className="flex flex-col gap-1 items-center bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner text-center min-w-[80px]">
            {displayScore.split(",").map((setScore: string, idx: number, arr: string[]) => (
              <div
                key={idx}
                className={`font-black tracking-tight text-slate-800 dark:text-slate-100 ${
                  arr.length > 1 ? "text-lg leading-none" : "text-2xl"
                }`}
              >
                {setScore.trim()}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
            {new Date(match.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </div>
          {highlightUrl && (
            <a
              href={highlightUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-500 px-2 py-1 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1 hover:scale-105 transition"
            >
              <Video className="w-3 h-3" /> Highlights
            </a>
          )}
        </div>

        {/* Player 2 (and Partner 2) */}
        <div
          className={`flex-1 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 p-3 rounded-2xl transition-colors ${
            !isP1Winner ? "bg-emerald-50 dark:bg-emerald-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
          }`}
        >
          <div className="text-center sm:text-right">
            <div
              className={`font-black text-sm ${
                !isP1Winner ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {p2 && (
                <Link href={`/player/${p2.id}`} className="hover:underline">
                  {p2.full_name}
                </Link>
              )}
              {match.partner2 && (
                <>
                  <br />
                  <Link href={`/player/${match.partner2.id}`} className="hover:underline">
                    {match.partner2.full_name}
                  </Link>
                </>
              )}
            </div>
            {match.elo_change_p2 && (
              <div
                className={`text-xs font-bold ${
                  match.elo_change_p2 > 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {match.elo_change_p2 > 0 ? "+" : ""}
                {match.elo_change_p2} ELO
              </div>
            )}
          </div>
          <div className="relative flex flex-row-reverse">
            {p2 && (
              <Link href={`/player/${p2.id}`}>
                <img
                  loading="lazy"
                  src={p2.avatar_url || ""}
                  className={`w-12 h-12 rounded-full object-cover shadow-sm relative z-10 ${
                    !isP1Winner ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : "grayscale opacity-80"
                  }`}
                />
              </Link>
            )}
            {match.partner2 && (
              <Link href={`/player/${match.partner2.id}`}>
                <img
                  loading="lazy"
                  src={match.partner2.avatar_url || ""}
                  className={`w-12 h-12 rounded-full object-cover shadow-sm -mr-4 relative z-0 ${
                    !isP1Winner ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : "grayscale opacity-80"
                  }`}
                />
              </Link>
            )}
            {!isP1Winner && (
              <div className="absolute -bottom-2 -left-2 sm:-left-2 sm:right-auto bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm z-20">
                <Trophy className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      </div>

      <EditVideoModal
        isOpen={isEditVideoOpen}
        onClose={() => setIsEditVideoOpen(false)}
        matchId={match.id}
        initialUrl={highlightUrl || ""}
        onSuccess={(url) => setCurrentVideoUrl(url)}
      />

      {/* Children (e.g., Accept/Reject buttons) */}
      {children && <div className="mt-4">{children}</div>}

      {/* Reaction Kudos & Edit */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
        <div>
          {isPlayerInMatch && (
            <button
              onClick={() => setIsEditVideoOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" />
              {highlightUrl ? "Edit Video" : "Add Video"}
            </button>
          )}
        </div>
        <div className="flex justify-end">
          <button
          onClick={onKudos}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
            isKudosed
              ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-500/20"
              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Star className="w-4 h-4" fill={isKudosed ? "currentColor" : "none"} stroke="currentColor" />
          Kudos <span className="kudos-count font-medium ml-1">{kudosCount}</span>
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            if (onShare) onShare();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 ml-2"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
        </div>
      </div>
    </motion.div>
  );
}
