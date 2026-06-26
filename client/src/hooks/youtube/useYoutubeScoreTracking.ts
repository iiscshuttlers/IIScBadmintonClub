import { useState, useMemo, useEffect, useCallback } from "react";
import type { ScoreLog } from "../useYoutubePlayer";

export interface UseYoutubeScoreTrackingProps {
  scoreLogs: ScoreLog[];
  onScoreLogsChange?: (logs: ScoreLog[]) => void;
  currentTime: number;
  showHint: (text: string) => void;
  teamA: string[];
  teamB: string[];
  playerRef: React.MutableRefObject<any>;
  seekTo: (seconds: number, isPercent?: boolean) => void;
  setPlaying: (p: boolean) => void;
}

export function useYoutubeScoreTracking({
  scoreLogs,
  onScoreLogsChange,
  currentTime,
  showHint,
  teamA,
  teamB,
  playerRef,
  seekTo,
  setPlaying
}: UseYoutubeScoreTrackingProps) {
  const [autoHighlightsMode, setAutoHighlightsMode] = useState(false);

  const currentScore = (() => {
    if (!scoreLogs || scoreLogs.length === 0) return null;
    const pastLogs = scoreLogs.filter(log => currentTime >= log.time);
    if (pastLogs.length === 0) return { time: 0, teamA: 0, teamB: 0 } as ScoreLog;
    return pastLogs[pastLogs.length - 1];
  })();

  const highlightRanges = useMemo(() => {
    if (!scoreLogs || scoreLogs.length === 0) return [];
    const ranges = scoreLogs.map(log => ({ start: Math.max(0, log.time - 12), end: log.time + 3 }));
    const merged: { start: number; end: number }[] = [];
    ranges.forEach(r => {
      if (merged.length === 0) { merged.push({ ...r }); return; }
      const last = merged[merged.length - 1];
      if (r.start <= last.end + 5) last.end = Math.max(last.end, r.end);
      else merged.push({ ...r });
    });
    return merged;
  }, [scoreLogs]);

  useEffect(() => {
    if (!autoHighlightsMode || highlightRanges.length === 0 || !playerRef.current) return;
    const currentIdx = highlightRanges.findIndex(r => currentTime >= r.start && currentTime <= r.end);
    if (currentIdx === -1) {
      const nextRange = highlightRanges.find(r => r.start > currentTime);
      if (nextRange) { 
        seekTo(nextRange.start, false); 
        showHint("Skipping to next highlight ⏭️"); 
      } else { 
        setAutoHighlightsMode(false); 
        playerRef.current.pauseVideo(); 
        setPlaying(false); 
        showHint("End of highlights"); 
      }
    }
  }, [currentTime, autoHighlightsMode, highlightRanges, seekTo, showHint, playerRef, setPlaying]);

  const handleAddPoint = useCallback((team: 'A' | 'B', playerIdx?: number) => {
    if (!onScoreLogsChange) return;
    const lastLog = scoreLogs.length > 0 ? scoreLogs[scoreLogs.length - 1] : { time: 0, teamA: 0, teamB: 0 } as ScoreLog;
    const newLog = { 
      time: Math.floor(currentTime), 
      teamA: team === 'A' ? lastLog.teamA + 1 : lastLog.teamA, 
      teamB: team === 'B' ? lastLog.teamB + 1 : lastLog.teamB, 
      serverIdx: playerIdx !== undefined ? playerIdx : lastLog.serverIdx 
    };
    onScoreLogsChange([...scoreLogs, newLog].sort((a, b) => a.time - b.time));
    showHint(`${team === 'A' ? teamA[0] : teamB[0]} scored!`);
  }, [scoreLogs, onScoreLogsChange, currentTime, showHint, teamA, teamB]);

  const handleSetServer = useCallback((serverIdx: number) => {
    if (!onScoreLogsChange) return;
    const lastLog = scoreLogs.length > 0 ? scoreLogs[scoreLogs.length - 1] : { time: 0, teamA: 0, teamB: 0 } as ScoreLog;
    const newLog = { ...lastLog, time: Math.floor(currentTime), serverIdx };
    const filtered = scoreLogs.filter(l => l.time !== newLog.time);
    onScoreLogsChange([...filtered, newLog].sort((a, b) => a.time - b.time));
    showHint("Server updated!");
  }, [scoreLogs, onScoreLogsChange, currentTime, showHint]);

  const handleUndoScore = useCallback(() => {
    if (!onScoreLogsChange || scoreLogs.length === 0) return;
    onScoreLogsChange(scoreLogs.slice(0, -1));
    showHint("Undo Score");
  }, [scoreLogs, onScoreLogsChange, showHint]);

  return {
    autoHighlightsMode, setAutoHighlightsMode,
    currentScore,
    highlightRanges,
    handleAddPoint, handleSetServer, handleUndoScore
  };
}
