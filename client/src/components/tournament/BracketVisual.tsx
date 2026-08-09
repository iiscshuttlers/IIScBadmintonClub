import React, { useState, useRef, useEffect, useCallback } from "react";
import { Trophy, ZoomIn, ZoomOut, X, ChevronRight, Clock, CheckCircle2, Play } from "lucide-react";
import { getCourtColor, cn } from "@/lib/utils";

export interface BracketMatch {
  id: string;
  match_code: string;
  round: number;
  round_name: string | null;
  match_number: number;
  team1_label: string | null;
  team2_label: string | null;
  winner_side: 1 | 2 | null;
  score: string | null;
  sets_history: string[] | null;
  status: string;
  court_number?: string | null;
}

interface BracketVisualProps {
  matches: BracketMatch[];
  rounds: number[];
  enablePathHighlight?: boolean;
  onExportExcel?: () => void;
  tournamentName?: string;
  category?: string;
}

const MATCH_W = 180;
const MATCH_H = 90;
const COL_GAP = 40;
const COL_W = MATCH_W + COL_GAP;
const PADDING = 16;
const LABEL_H = 26;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ── Player Roadmap Modal ──────────────────────────────────────────────────────

interface RoadmapPanelProps {
  player: string;
  matches: BracketMatch[];
  isMobile: boolean;
  onClose: () => void;
}

function RoadmapPanel({ player, matches, isMobile, onClose }: RoadmapPanelProps) {
  const byCode = new Map<string, BracketMatch>();
  matches.forEach((m) => byCode.set(m.match_code, m));

  // Seed path with matches where player appears directly
  const pathMatchIds = new Set<string>(
    matches
      .filter((m) => (m.team1_label ?? "").includes(player) || (m.team2_label ?? "").includes(player))
      .map((m) => m.id)
  );

  // Trace forward via "Winner of <code>" references
  let changed = true;
  while (changed) {
    changed = false;
    matches.forEach((m) => {
      if (pathMatchIds.has(m.id)) return;
      const refs = (label: string) => {
        const ref = label.match(/Winner of (\S+)/i);
        if (!ref) return false;
        const refM = byCode.get(ref[1]);
        return !!refM && pathMatchIds.has(refM.id);
      };
      if (refs(m.team1_label ?? "") || refs(m.team2_label ?? "")) {
        pathMatchIds.add(m.id);
        changed = true;
      }
    });
  }

  const roadmap = matches
    .filter((m) => pathMatchIds.has(m.id))
    .sort((a, b) => a.round - b.round);

  const cardW = isMobile ? 155 : 200;

  const statusIcon = (m: BracketMatch) => {
    if (m.status === "completed") return <CheckCircle2 size={12} className="text-primary shrink-0" />;
    if (m.status === "in_progress") return <Play size={12} className="text-red-400 shrink-0 animate-pulse" />;
    return <Clock size={12} className="text-muted-foreground shrink-0" />;
  };

  const statusLabel = (m: BracketMatch) => {
    if (m.status === "completed") return "Done";
    if (m.status === "in_progress") return "Live";
    if (m.team1_label === "BYE" || m.team2_label === "BYE") return "Advance";
    return "Soon";
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Centered modal — sits in the middle of the viewport */}
      <div
        className="fixed inset-x-3 z-50 rounded-2xl border border-slate-700 shadow-2xl"
        style={{
          background: "#0d1117",
          top: "50%",
          transform: "translateY(-50%)",
          maxWidth: 700,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          maxHeight: isMobile ? "52vh" : "60vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">Player Roadmap</p>
            <p className={`font-black text-primary truncate ${isMobile ? "text-sm" : "text-sm"}`}>{player}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-3 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-700 active:bg-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scroll hint label */}
        <p className="px-4 pt-2 pb-0 text-[9px] text-muted-foreground uppercase tracking-widest shrink-0">
          ← swipe to see full path →
        </p>

        {/* Horizontally scrollable cards */}
        <div
          className="overflow-x-auto overflow-y-hidden flex-1"
          style={{ WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}
        >
          <div className="flex items-stretch gap-2 px-4 py-3" style={{ minWidth: "max-content" }}>
            {roadmap.map((m, idx) => {
              const isCompleted = m.status === "completed";
              const isLive = m.status === "in_progress";

              const t1 = m.team1_label ?? "TBD";
              const t2 = m.team2_label ?? "TBD";
              const playerIsT1 = t1.includes(player);
              const playerIsT2 = t2.includes(player);

              const slotRefersToPath = (label: string) => {
                const ref = label.match(/Winner of (\S+)/i);
                if (!ref) return false;
                const refM = byCode.get(ref[1]);
                return !!refM && pathMatchIds.has(refM.id);
              };
              const pathIsT1 = !playerIsT1 && !playerIsT2 && slotRefersToPath(t1);
              const pathIsT2 = !playerIsT1 && !playerIsT2 && slotRefersToPath(t2);

              const playerName = playerIsT1 ? t1 : playerIsT2 ? t2 : pathIsT1 ? t1 : pathIsT2 ? t2 : player;
              const opponentName = playerIsT1 ? t2 : playerIsT2 ? t1 : pathIsT1 ? t2 : pathIsT2 ? t1 : "TBD";
              const effectivePlayerIsT1 = playerIsT1 || pathIsT1;

              const playerWon = isCompleted && ((effectivePlayerIsT1 && m.winner_side === 1) || (!effectivePlayerIsT1 && m.winner_side === 2));
              const playerLost = isCompleted && !playerWon;

              const sets = m.sets_history?.length && Array.isArray(m.sets_history)
                ? m.sets_history.map((s) => {
                    if (typeof s !== "string") return { me: 0, opp: 0 };
                    const [a, b] = s.split("-").map(Number);
                    return effectivePlayerIsT1 ? { me: a, opp: b } : { me: b, opp: a };
                  })
                : null;

              const borderColor = isLive
                ? "border-red-500 ring-1 ring-red-500"
                : playerWon
                ? "border-primary"
                : "border-slate-700";

              return (
                <React.Fragment key={m.id}>
                  {idx > 0 && (
                    <div className="flex items-center shrink-0">
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  )}

                  <div
                    className={`rounded-xl border ${borderColor} overflow-hidden shrink-0 flex flex-col`}
                    style={{ background: "#161b22", width: cardW }}
                  >
                    {/* Card header */}
                    <div className="px-2.5 py-1.5 border-b border-slate-700/50 flex items-center justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-wider text-amber-400 truncate">
                          {m.round_name ?? `Round ${m.round}`}
                        </p>
                        <p className="text-[8px] text-muted-foreground">{m.match_code}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {statusIcon(m)}
                        <span className={`text-[8px] font-bold ${isLive ? "text-red-400" : isCompleted ? "text-primary" : "text-muted-foreground"}`}>
                          {statusLabel(m)}
                        </span>
                      </div>
                    </div>

                    {/* Player row */}
                    <div className={`px-2.5 flex items-center justify-between gap-1 border-b border-slate-700/30 ${playerWon ? "bg-primary/10" : ""}`} style={{ minHeight: 36 }}>
                      <div className="flex items-center gap-1 min-w-0">
                        {playerWon && <Trophy size={9} className="text-amber-400 shrink-0" />}
                        <span className={`text-[10px] font-black truncate ${playerWon ? "text-amber-300" : playerLost ? "text-muted-foreground" : "text-foreground"}`}>
                          {playerName}
                        </span>
                      </div>
                      {sets && (
                        <div className="flex gap-0.5 shrink-0">
                          {sets.map((s, i) => (
                            <span key={i} className={`text-[10px] font-mono font-bold ${s.me > s.opp ? "text-foreground" : "text-muted-foreground"}`}>
                              {s.me}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Opponent row */}
                    <div className={`px-2.5 flex items-center justify-between gap-1 ${playerLost ? "bg-amber-500/10" : ""}`} style={{ minHeight: 36 }}>
                      <span className={`text-[10px] font-semibold truncate ${playerLost ? "text-amber-300" : "text-muted-foreground"}`}>
                        {opponentName}
                      </span>
                      {sets && (
                        <div className="flex gap-0.5 shrink-0">
                          {sets.map((s, i) => (
                            <span key={i} className={`text-[10px] font-mono font-bold ${s.opp > s.me ? "text-foreground" : "text-muted-foreground"}`}>
                              {s.opp}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Court */}
                    {m.court_number && (
                      <div className="px-2.5 py-1 border-t border-slate-700/30">
                        <span className="text-[8px] text-blue-400">Court {m.court_number}</span>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {/* Trophy cap or elimination notice */}
            {roadmap.length > 0 && (() => {
              const last = roadmap[roadmap.length - 1];
              if (last.round_name?.toLowerCase() === "final") return null;
              const isEliminated = last.status === "completed" && (() => {
                const t1 = last.team1_label ?? "";
                const t2 = last.team2_label ?? "";
                const playerIsT1 = t1.includes(player);
                return !((playerIsT1 && last.winner_side === 1) || (!playerIsT1 && last.winner_side === 2 && t2.includes(player)));
              })();

              return (
                <>
                  <div className="flex items-center shrink-0">
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </div>
                  {isEliminated ? (
                    <div
                      className="flex items-center justify-center rounded-xl border border-slate-700/30 shrink-0"
                      style={{ background: "#161b22", width: 72, minHeight: 80 }}
                    >
                      <div className="text-center px-1">
                        <p className="text-base leading-none mb-1">🏸</p>
                        <p className="text-[8px] text-muted-foreground uppercase tracking-widest leading-tight">Good game!</p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-xl border border-slate-700/40 shrink-0"
                      style={{ background: "#161b22", width: 60, minHeight: 80 }}
                    >
                      <div className="text-center">
                        <Trophy size={18} className="text-amber-400/25 mx-auto mb-0.5" />
                        <p className="text-[8px] text-muted-foreground uppercase tracking-widest">Final</p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main BracketVisual ────────────────────────────────────────────────────────

class BracketVisualErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900/50 text-red-200 font-mono text-xs whitespace-pre-wrap">
          BracketVisual Crash: {this.state.error?.message}
          <br />
          {this.state.error?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

export function BracketVisual(props: BracketVisualProps) {
  return (
    <BracketVisualErrorBoundary>
      <BracketVisualInner {...props} />
    </BracketVisualErrorBoundary>
  );
}

function BracketVisualInner({ matches, rounds, enablePathHighlight = false, onExportExcel, tournamentName = "Tournament", category = "All" }: BracketVisualProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Auto-scale to fit screen width on mount / resize
  const computeScale = useCallback(() => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.offsetWidth;
    const totalW = rounds.length * COL_W + PADDING * 2;
    if (totalW > containerW) {
      const auto = Math.min(1, Math.max(0.4, (containerW * 0.95) / totalW));
      setScale(auto);
    } else {
      setScale(1);
    }
  }, [rounds.length]);

  useEffect(() => {
    computeScale();
    window.addEventListener("resize", computeScale);
    return () => window.removeEventListener("resize", computeScale);
  }, [computeScale]);

  const r1Count = matches.filter((m) => m.round === rounds[0]).length;
  const SLOT_H = Math.max(MATCH_H + 20, 90);
  const totalH = r1Count * SLOT_H;

  const getExportFilename = () => {
    const safeName = tournamentName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_Bracket_${category}_Visual`;
  };
  const totalW = rounds.length * COL_W;

  type Pos = { match: BracketMatch; y: number; cy: number };

  const roundData = rounds.map((round, ri) => {
    const roundMatches = matches
      .filter((m) => m.round === round)
      .sort((a, b) => a.match_number - b.match_number);
    const slotH = totalH / roundMatches.length;
    const positions: Pos[] = roundMatches.map((m, mi) => ({
      match: m,
      y: mi * slotH + slotH / 2 - MATCH_H / 2,
      cy: mi * slotH + slotH / 2,
    }));
    return { round, ri, positions, label: roundMatches[0]?.round_name ?? `R${round}` };
  });

  // SVG connector lines
  const lines: React.ReactNode[] = [];
  for (let ri = 0; ri < roundData.length - 1; ri++) {
    const cur = roundData[ri];
    const x1 = ri * COL_W + MATCH_W;
    const xMid = x1 + COL_GAP / 2;
    for (let i = 0; i < cur.positions.length; i += 2) {
      const m1 = cur.positions[i];
      const m2 = cur.positions[i + 1];
      const nm = roundData[ri + 1]?.positions[Math.floor(i / 2)];
      if (!nm) continue;
      lines.push(<line key={`a-${ri}-${i}`} x1={x1} y1={m1?.cy || 0} x2={xMid} y2={m1?.cy || 0} stroke="#444" strokeWidth={1.5} />);
      if (m2) {
        lines.push(<line key={`b-${ri}-${i}`} x1={x1} y1={m2.cy || 0} x2={xMid} y2={m2.cy || 0} stroke="#444" strokeWidth={1.5} />);
        lines.push(<line key={`c-${ri}-${i}`} x1={xMid} y1={m1?.cy || 0} x2={xMid} y2={m2.cy || 0} stroke="#444" strokeWidth={1.5} />);
      }
      const x2 = ri + 1 < roundData.length - 1 ? (ri + 1) * COL_W : xMid + COL_GAP / 2;
      lines.push(<line key={`d-${ri}-${i}`} x1={xMid} y1={nm.cy || 0} x2={x2} y2={nm.cy || 0} stroke="#444" strokeWidth={1.5} />);
    }
  }

  // Player path highlight
  const pathSet = (() => {
    if (!enablePathHighlight || !selectedPlayer) return new Set<string>();
    const path = new Set<string>();
    matches.forEach((m) => {
      if ((m.team1_label ?? "").includes(selectedPlayer) || (m.team2_label ?? "").includes(selectedPlayer))
        path.add(m.id);
    });
    let changed = true;
    while (changed) {
      changed = false;
      matches.forEach((m) => {
        if (path.has(m.id)) return;
        const winner = m.winner_side === 1 ? m.team1_label : m.winner_side === 2 ? m.team2_label : null;
        if (winner?.includes(selectedPlayer)) { path.add(m.id); changed = true; }
      });
    }
    return path;
  })();

  const scaledH = (totalH + PADDING * 2 + LABEL_H) * scale;
  const scaledW = (totalW + PADDING * 2) * scale;

  // Touch target height for player rows (min 44px for mobile)
  const playerRowH = isMobile ? 44 : 36;

  return (
    <div className="rounded-2xl border border-slate-700 overflow-hidden" style={{ background: "#0d1117" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest truncate mr-2">
          {enablePathHighlight && selectedPlayer
            ? <><span className="text-primary font-black">{selectedPlayer}</span><span className="text-muted-foreground"> · roadmap open</span></>
            : enablePathHighlight ? "Tap a player to see roadmap" : "Bracket"
          }
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-auto mr-4">
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="px-2 py-1 flex items-center gap-1 text-[10px] font-bold uppercase rounded-md text-slate-300 hover:text-white hover:bg-green-500/20 active:bg-green-500/30 transition-colors"
            >
              Excel
            </button>
          )}
          <button
            onClick={() => {
              const el = document.getElementById("bracket-visual-export-container");
              if (el) {
                import("@/utils/exportUtils").then(({ exportElementToPDF }) => {
                  exportElementToPDF(el, getExportFilename(), "#0d1117", { transform: 'scale(1)' });
                });
              }
            }}
            className="px-2 py-1 flex items-center gap-1 text-[10px] font-bold uppercase rounded-md text-slate-300 hover:text-white hover:bg-red-500/20 active:bg-red-500/30 transition-colors"
          >
            PDF
          </button>
          <button
            onClick={() => {
              const el = document.getElementById("bracket-visual-export-container");
              if (el) {
                import("@/utils/exportUtils").then(({ exportElementToImage }) => {
                  exportElementToImage(el, getExportFilename(), "#0d1117", { transform: 'scale(1)' });
                });
              }
            }}
            className="px-2 py-1 flex items-center gap-1 text-[10px] font-bold uppercase rounded-md text-slate-300 hover:text-white hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors"
          >
            Image
          </button>
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setScale((s) => Math.max(0.4, +(s - 0.1).toFixed(1)))}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-700 active:bg-slate-600 transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <span className="text-[10px] text-muted-foreground w-8 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(1.5, +(s + 0.1).toFixed(1)))}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-700 active:bg-slate-600 transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={computeScale}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-slate-700 transition-colors"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Scrollable bracket */}
      <div
        ref={containerRef}
        style={{
          overflowX: "auto",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
          touchAction: "pan-x pan-y",
          maxHeight: isMobile ? "60vh" : "75vh",
        }}
      >
        <div
          id="bracket-visual-export-container"
          className="bracket-export-bg"
          style={{
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            width: totalW + PADDING * 2,
            height: totalH + PADDING * 2 + LABEL_H,
            minWidth: scaledW,
            minHeight: scaledH,
            position: "relative",
            backgroundColor: "#0d1117"
          }}
        >
          {/* Round labels */}
          <div className="flex absolute top-0 left-0" style={{ paddingLeft: PADDING, paddingTop: PADDING / 2 }}>
            {roundData.map(({ ri, label }) => (
              <div key={ri} style={{ width: COL_W, flexShrink: 0 }}
                className="text-[10px] font-black uppercase tracking-widest text-center text-amber-400">
                {label}
              </div>
            ))}
          </div>

          {/* SVG connectors */}
          <svg style={{ position: "absolute", left: PADDING, top: PADDING + LABEL_H, pointerEvents: "none" }}
            width={totalW} height={totalH} overflow="visible">
            {lines}
          </svg>

          {/* Match cards */}
          {roundData.map(({ ri, positions }) =>
            positions.map(({ match: m, y }) => {
              const isCompleted = m.status === "completed";
              const isLive = m.status === "in_progress";
              const t1 = m.team1_label ?? "TBD";
              const t2 = m.team2_label ?? "TBD";
              const t1Won = isCompleted && m.winner_side === 1;
              const t2Won = isCompleted && m.winner_side === 2;
              const sets = m.sets_history?.length && Array.isArray(m.sets_history)
                ? m.sets_history.map((s) => {
                    if (typeof s !== "string") return { t1: 0, t2: 0 };
                    const [a, b] = s.split("-").map(Number);
                    return { t1: isNaN(a) ? 0 : a, t2: isNaN(b) ? 0 : b };
                  })
                : null;

              const isOnPath = pathSet.has(m.id);
              const isDirectMatch = isOnPath && (t1.includes(selectedPlayer ?? "") || t2.includes(selectedPlayer ?? ""));

              const borderCls = isLive
                ? "border-red-500 shadow-red-900/40 shadow-lg ring-1 ring-red-500"
                : isDirectMatch ? "border-primary ring-2 ring-primary"
                : isOnPath ? "border-primary ring-1 ring-primary"
                : "border-slate-700";

              return (
                <div key={m.id}
                  style={{ position: "absolute", left: ri * COL_W + PADDING, top: y + PADDING + LABEL_H, width: MATCH_W }}>
                  <div className={`rounded-lg overflow-hidden border ${borderCls} transition-all`} style={{ background: "#161b22" }}>
                    {/* Match header */}
                    <div className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b border-slate-700/50 flex justify-between items-center">
                      <span>{m.match_code}</span>
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        {(m as any).scheduled_at && (
                          <span className="text-slate-400 font-bold">
                            {new Date((m as any).scheduled_at).toLocaleString("en-GB", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {m.court_number && <span className={getCourtColor(m.court_number)}>C{m.court_number}</span>}
                        {isLive && <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-red-500" />}
                      </span>
                    </div>
                    {/* Players + scores */}
                    <div className="flex">
                      <div className="flex-1 min-w-0 flex flex-col">
                        {/* Team 1 */}
                        <div
                          onClick={enablePathHighlight ? () => setSelectedPlayer(selectedPlayer === t1 ? null : t1) : undefined}
                          style={{ minHeight: playerRowH }}
                          className={`flex-1 flex items-center gap-1 px-2 border-b border-slate-700/50 ${t1Won ? "bg-amber-500/20" : ""} ${enablePathHighlight ? "cursor-pointer active:bg-slate-700/50" : ""}`}
                        >
                          <span className={`flex-1 text-[11px] font-bold truncate leading-tight ${t1Won ? "text-amber-300" : "text-slate-300"}`}>{t1}</span>
                          {t1Won && <Trophy size={11} className="text-amber-400 shrink-0" />}
                        </div>
                        {/* Team 2 */}
                        <div
                          onClick={enablePathHighlight ? () => setSelectedPlayer(selectedPlayer === t2 ? null : t2) : undefined}
                          style={{ minHeight: playerRowH }}
                          className={`flex-1 flex items-center gap-1 px-2 ${t2Won ? "bg-amber-500/20" : ""} ${enablePathHighlight ? "cursor-pointer active:bg-slate-700/50" : ""}`}
                        >
                          <span className={`flex-1 text-[11px] font-bold truncate leading-tight ${t2Won ? "text-amber-300" : "text-slate-300"}`}>{t2}</span>
                          {t2Won && <Trophy size={11} className="text-amber-400 shrink-0" />}
                        </div>
                      </div>
                      {/* Set scores */}
                      {isCompleted && sets && (
                        <div className="flex shrink-0 border-l border-slate-700/50">
                          {sets.map((s, i) => (
                            <div key={i} className={`flex flex-col${i < sets.length - 1 ? " border-r border-slate-700/30" : ""}`} style={{ width: 22 }}>
                              <div style={{ minHeight: playerRowH }} className={`flex items-center justify-center text-[11px] font-mono font-bold border-b border-slate-700/50 ${t1Won ? "bg-amber-500/10" : ""} ${s.t1 > s.t2 ? "text-foreground" : "text-muted-foreground"}`}>
                                {s.t1}
                              </div>
                              <div style={{ minHeight: playerRowH }} className={`flex items-center justify-center text-[11px] font-mono font-bold ${t2Won ? "bg-amber-500/10" : ""} ${s.t2 > s.t1 ? "text-foreground" : "text-muted-foreground"}`}>
                                {s.t2}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Roadmap modal */}
      {enablePathHighlight && selectedPlayer && (
        <RoadmapPanel
          player={selectedPlayer}
          matches={matches}
          isMobile={isMobile}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
