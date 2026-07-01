import { useEffect, useRef, useState } from "react";
import { X, Clock } from "lucide-react";
import {
  YoutubePlayer,
  type Chapter,
  type YoutubePlayerHandle,
  type ScoreLog,
} from "./YoutubePlayer";

interface VideoItem {
  id: string;
  title: string;
  videoId: string;
  category?: string;
  chapters?: Chapter[];
  scoreLogs?: ScoreLog[];
}

interface Props {
  video: VideoItem;
  onClose: () => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VideoPlayerModal({ video, onClose }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [scoreLogs, setScoreLogs] = useState<ScoreLog[]>(video.scoreLogs || []);
  const [enableScoringMode, setEnableScoringMode] = useState(false);
  const [teamA, setTeamA] = useState<string[]>(["Team A"]);
  const [teamB, setTeamB] = useState<string[]>(["Team B"]);
  const backdropRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YoutubePlayerHandle>(null);
  const chapters = video.chapters ?? [];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Parse names from title (e.g. "Radhika and Kaling vs Tanisha and Aneesh")
  useEffect(() => {
    try {
       const matchStr = video.title.split("||")[0].trim();
       if (matchStr.includes(" vs ")) {
          const teams = matchStr.split(" vs ");
          if (teams.length === 2) {
             const parseTeam = (str: string) => str.split(" and ").map(s => s.trim()).filter(Boolean);
             const a = parseTeam(teams[0]);
             const b = parseTeam(teams[1]);
             if (a.length > 0) setTeamA(a);
             if (b.length > 0) setTeamB(b);
          }
       }
    } catch (e) {}
  }, [video.title]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const activeChapterIdx =
    chapters.length > 0
      ? ([...chapters]
          .map((c, i) => ({ ...c, i }))
          .reverse()
          .find((c) => currentTime >= c.time)?.i ?? 0)
      : -1;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-6"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="relative w-full max-w-6xl flex flex-col lg:flex-row gap-0 rounded-2xl overflow-hidden shadow-2xl bg-black">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 text-foreground/70 hover:text-foreground bg-black/60 hover:bg-black/80 rounded-full p-2 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Player */}
        <div className="flex-1 min-w-0">
          {/* Title bar */}
          <div className="px-4 py-3 bg-gray-950 border-b border-white/5 flex justify-between items-center">
            <div>
              {video.category && (
                <p className="text-primary text-xs font-bold uppercase tracking-widest mb-0.5">
                  {video.category}
                </p>
              )}
              <h2 className="text-foreground font-bold text-sm md:text-base leading-tight pr-8">
                {video.title}
              </h2>
            </div>
            <button 
              onClick={() => setEnableScoringMode(v => !v)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors shrink-0 ${enableScoringMode ? 'bg-rose-500 text-foreground shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-white/10 text-foreground/70 hover:bg-white/20'}`}
            >
              {enableScoringMode ? 'Exit Scoring' : 'Score Mode'}
            </button>
          </div>

          {/* Aspect-ratio box */}
          <div className="aspect-video w-full bg-black">
            <YoutubePlayer
              ref={playerRef}
              videoId={video.videoId}
              chapters={chapters}
              onCloseRequest={onClose}
              className="w-full h-full"
              onTimeUpdate={setCurrentTime}
              scoreLogs={scoreLogs}
              onScoreLogsChange={setScoreLogs}
              enableScoringMode={enableScoringMode}
              teamA={teamA}
              teamB={teamB}
            />
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="hidden md:flex px-4 py-2 bg-gray-950 gap-4 text-foreground/30 text-[11px] border-t border-white/5">
            <span>Space / K — play/pause</span>
            <span>← / → — skip 10s</span>
            <span>F — fullscreen</span>
            <span>M — mute</span>
          </div>
        </div>

        {/* Chapter sidebar — only shown if there are chapters */}
        {chapters.length > 0 && (
          <div className="w-full lg:w-64 bg-gray-950 border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col max-h-52 lg:max-h-none overflow-y-auto">
            <div className="px-4 py-3 border-b border-white/5 sticky top-0 bg-gray-950 z-10">
              <h3 className="text-foreground/50 text-xs font-bold uppercase tracking-widest">
                Chapters
              </h3>
            </div>
            <div className="flex-1">
              {chapters.map((ch, idx) => {
                const isActive = idx === activeChapterIdx;
                return (
                  <button
                    key={ch.time}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-white/5 last:border-0 ${isActive ? "bg-primary/10" : "hover:bg-white/5"}`}
                    onClick={() => playerRef.current?.seekTo(ch.time)}
                  >
                    <Clock
                      className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-primary" : "text-foreground/30"}`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold leading-snug truncate ${isActive ? "text-primary" : "text-foreground/70"}`}
                      >
                        {ch.title}
                      </p>
                      <p className="text-foreground/30 text-xs tabular-nums mt-0.5">
                        {fmt(ch.time)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
