import { useState } from "react";
import {
  Trophy,
  Clock,
  ChevronRight,
  Activity,
  CheckCircle2,
  Calendar,
  Users,
} from "lucide-react";

const FORMAT_LABELS: Record<string, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

const FORMAT_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  MS: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-100 dark:border-blue-900/50",
    dot: "bg-blue-500",
  },
  WS: {
    bg: "bg-pink-50 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-100 dark:border-pink-900/50",
    dot: "bg-pink-500",
  },
  MD: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-100 dark:border-emerald-900/50",
    dot: "bg-emerald-500",
  },
  WD: {
    bg: "bg-purple-50 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-100 dark:border-purple-900/50",
    dot: "bg-purple-500",
  },
  XD: {
    bg: "bg-orange-50 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-100 dark:border-orange-900/50",
    dot: "bg-orange-500",
  },
};

const POOL_COLORS: Record<string, string> = {
  Finals:
    "from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-900/50",
  "League A":
    "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-100 dark:border-blue-900/50",
  "League B":
    "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-100 dark:border-emerald-900/50",
  League:
    "from-slate-50 dark:from-slate-900 to-gray-50 border-slate-200 dark:border-slate-700",
  KO: "from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 border-rose-100 dark:border-rose-900/50",
};

interface ScheduleViewProps {
  tournamentData: any;
  dateFilter?: string;
}

export function ScheduleView({ tournamentData, dateFilter }: ScheduleViewProps) {
  if (!tournamentData) return null;

  const [activeFormat, setActiveFormat] = useState<string>("ALL");

  const allMatches = Object.entries(tournamentData.matches).flatMap(
    ([format, matches]: [string, any]) =>
      (matches as any[]).map((m) => ({ ...m, format })),
  );

  let filtered =
    activeFormat === "ALL"
      ? allMatches
      : allMatches.filter((m) => m.format === activeFormat);

  if (dateFilter) {
    filtered = filtered.filter((m) => m.Date === dateFilter);
  }

  filtered.sort((a, b) => {
    const toMins = (t: string) => {
      if (!t) return 9999;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    return toMins(a.Time) - toMins(b.Time);
  });

  const byTime: Record<string, any[]> = {};
  filtered.forEach((m) => {
    const key = m.Time || "TBD";
    if (!byTime[key]) byTime[key] = [];
    byTime[key].push(m);
  });

  const getPlayers = (m: any) => {
    const p1Raw = m.Player_1 || m.Players_1 || "TBD";
    const p2Raw = m.Player_2 || m.Players_2 || "TBD";
    const p1List = p1Raw
      .split(/[&/]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    const p2List = p2Raw
      .split(/[&/]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    return { p1List, p2List };
  };

  const parseSets = (m: any) => {
    const scoreStr = m.Score_1 || "";
    if (!scoreStr) return [];
    return scoreStr.split(/[, ]+/).map((set: string) => {
      const parts = set.split("-");
      return {
        s1: parts[0] || "0",
        s2: parts[1] || "0",
      };
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 font-sans text-slate-900 dark:text-white">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Match Schedule
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mt-1 flex items-center gap-2">
            <Calendar size={14} className="sm:w-4 sm:h-4" />
            Tournament Timeline & Live Updates
          </p>
        </div>

        {/* Filter Pills - Scrollable on mobile */}
        <div className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex gap-1 border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm w-max sm:w-auto">
            <button
              onClick={() => setActiveFormat("ALL")}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                activeFormat === "ALL"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:text-white dark:bg-slate-800/50"
              }`}
            >
              All Events
            </button>
            {Object.entries(FORMAT_LABELS).map(([code, label]) =>
              tournamentData.formats.includes(code) ? (
                <button
                  key={code}
                  onClick={() => setActiveFormat(code)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                    activeFormat === code
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:text-white dark:bg-slate-800/50"
                  }`}
                >
                  {code}
                </button>
              ) : null,
            )}
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative">
        {/* Vertical Timeline Line - Hidden on very small screens, shown from sm up */}
        <div className="absolute left-[23px] sm:left-[31px] md:left-[79px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-slate-200 dark:from-slate-800 via-slate-200 dark:via-slate-800 to-transparent hidden xs:block" />

        <div className="space-y-8 sm:space-y-10">
          {Object.entries(byTime).map(([time, matches]) => (
            <div
              key={time}
              className="relative flex flex-col xs:flex-row gap-3 sm:gap-4 md:gap-8"
            >
              {/* Time Label */}
              <div className="xs:w-12 sm:w-20 flex-shrink-0 pt-1">
                <div className="sticky top-8 flex items-center xs:justify-end gap-2 sm:gap-3">
                  <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded xs:bg-transparent xs:p-0">
                    {time}
                  </span>
                  <div className="hidden xs:block w-3 h-3 sm:w-4 sm:h-4 rounded-full border-[3px] sm:border-4 border-white bg-slate-300 dark:bg-slate-600 shadow-sm z-10" />
                </div>
              </div>

              {/* Match Cards Group */}
              <div className="flex-1 space-y-4">
                {matches.map((m, idx) => {
                  const { p1List, p2List } = getPlayers(m);
                  const isLive = m.Status === "in-progress";
                  const isDone = m.Status === "completed";

                  const p1Won =
                    isDone &&
                    p1List.some((p) =>
                      m.Winner?.includes(p.split("(")[0].trim()),
                    );
                  const p2Won =
                    isDone &&
                    p2List.some((p) =>
                      m.Winner?.includes(p.split("(")[0].trim()),
                    );

                  const formatStyle = FORMAT_COLORS[m.format] || {
                    bg: "bg-slate-50 dark:bg-slate-800",
                    text: "text-slate-600 dark:text-slate-300",
                    border: "border-slate-100 dark:border-slate-700",
                    dot: "bg-slate-400",
                  };
                  const poolGradient =
                    POOL_COLORS[m.Pool] ||
                    POOL_COLORS[m.Round] ||
                    "from-white to-white dark:from-slate-900 dark:to-slate-900 border-slate-200 dark:border-slate-700";

                  const sets = parseSets(m);

                  return (
                    <div
                      key={idx}
                      className={`group relative bg-gradient-to-br ${poolGradient} border rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg ${
                        isLive
                          ? "ring-2 ring-rose-500 ring-offset-1 shadow-lg shadow-rose-100"
                          : "shadow-sm"
                      }`}
                    >
                      {isLive && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500 animate-pulse" />
                      )}

                      {/* Card Header - More compact on mobile */}
                      <div className="px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between border-b border-black/5 bg-white dark:bg-slate-900/40 backdrop-blur-sm">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-[8px] sm:text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                            {m.Match_ID}
                          </span>
                          <div
                            className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md border ${formatStyle.bg} ${formatStyle.border} ${formatStyle.text} text-[8px] sm:text-[10px] font-black uppercase tracking-wider`}
                          >
                            <div
                              className={`w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full ${formatStyle.dot}`}
                            />
                            <span className="hidden xs:inline">
                              {FORMAT_LABELS[m.format] || m.format}
                            </span>
                            <span className="xs:hidden">{m.format}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                            {m.Pool || m.Round}
                          </span>
                          {isLive ? (
                            <span className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-500 text-white text-[8px] sm:text-[10px] font-black animate-pulse">
                              <Activity
                                size={8}
                                className="sm:w-2.5 sm:h-2.5"
                              />{" "}
                              LIVE
                            </span>
                          ) : isDone ? (
                            <span className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] sm:text-[10px] font-black">
                              <CheckCircle2
                                size={8}
                                className="sm:w-2.5 sm:h-2.5"
                              />{" "}
                              DONE
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[8px] sm:text-[10px] font-black">
                              <Clock size={8} className="sm:w-2.5 sm:h-2.5" />{" "}
                              UPCOMING
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Players & Score Section - Redesigned for Mobile */}
                      <div className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
                          {/* Team 1 */}
                          <div
                            className={`w-full flex items-center md:justify-end gap-3 sm:gap-4 ${p1Won ? "md:scale-105 md:origin-right" : ""}`}
                          >
                            <div
                              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold flex-shrink-0 ${p1Won ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/50" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}
                            >
                              {p1List.length > 1 ? (
                                <Users size={18} className="sm:w-5 sm:h-5" />
                              ) : (
                                p1List[0]?.charAt(0)
                              )}
                            </div>
                            <div className="text-left md:text-right flex-1">
                              {p1List.map((player, pIdx) => (
                                <p
                                  key={pIdx}
                                  className={`text-sm sm:text-base font-bold leading-tight ${p1Won ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}
                                >
                                  {player}
                                </p>
                              ))}
                              {p1Won && (
                                <span className="text-[8px] sm:text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1 md:justify-end pt-0.5">
                                  <Trophy
                                    size={8}
                                    className="sm:w-2.5 sm:h-2.5"
                                  />{" "}
                                  Winner
                                </span>
                              )}
                            </div>
                          </div>

                          {/* VS Separator - Hidden on mobile, shown on md */}
                          <div className="hidden md:flex flex-col items-center justify-center gap-4">
                            <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                            <div className="bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 tracking-[0.3em] uppercase">
                                VS
                              </span>
                            </div>
                            <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                          </div>

                          {/* Mobile VS Separator - Horizontal line */}
                          <div className="md:hidden w-full flex items-center gap-3">
                            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                            <span className="text-[8px] font-black text-slate-200 dark:text-slate-700 tracking-[0.2em] uppercase">
                              VS
                            </span>
                            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                          </div>

                          {/* Team 2 */}
                          <div
                            className={`w-full flex items-center gap-3 sm:gap-4 ${p2Won ? "md:scale-105 md:origin-left" : ""}`}
                          >
                            <div
                              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold flex-shrink-0 ${p2Won ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/50" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}
                            >
                              {p2List.length > 1 ? (
                                <Users size={18} className="sm:w-5 sm:h-5" />
                              ) : (
                                p2List[0]?.charAt(0)
                              )}
                            </div>
                            <div className="text-left flex-1">
                              {p2List.map((player, pIdx) => (
                                <p
                                  key={pIdx}
                                  className={`text-sm sm:text-base font-bold leading-tight ${p2Won ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}
                                >
                                  {player}
                                </p>
                              ))}
                              {p2Won && (
                                <span className="text-[8px] sm:text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1 pt-0.5">
                                  <Trophy
                                    size={8}
                                    className="sm:w-2.5 sm:h-2.5"
                                  />{" "}
                                  Winner
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Set-based Scoreboard UI - Optimized for Mobile */}
                        {sets.length > 0 && (
                          <div className="mt-6 sm:mt-10 flex flex-wrap justify-center gap-2 sm:gap-3">
                            {sets.map((set, sIdx) => {
                              const s1Num = parseInt(set.s1);
                              const s2Num = parseInt(set.s2);
                              const s1Won = s1Num > s2Num;
                              const s2Won = s2Num > s1Num;

                              return (
                                <div
                                  key={sIdx}
                                  className="flex flex-col items-center gap-1 sm:gap-1.5"
                                >
                                  <span className="text-[7px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    Set {sIdx + 1}
                                  </span>
                                  <div className="flex items-center bg-slate-900 rounded-lg sm:rounded-xl overflow-hidden shadow-md sm:shadow-lg border border-white/10">
                                    <div
                                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-base sm:text-xl font-black font-mono min-w-[40px] sm:min-w-[50px] text-center ${s1Won ? "text-amber-400 bg-white dark:bg-slate-900/5" : "text-slate-400 dark:text-slate-500"}`}
                                    >
                                      {set.s1}
                                    </div>
                                    <div className="w-px h-4 sm:h-6 bg-white dark:bg-slate-900/10" />
                                    <div
                                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-base sm:text-xl font-black font-mono min-w-[40px] sm:min-w-[50px] text-center ${s2Won ? "text-amber-400 bg-white dark:bg-slate-900/5" : "text-slate-400 dark:text-slate-500"}`}
                                    >
                                      {set.s2}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
