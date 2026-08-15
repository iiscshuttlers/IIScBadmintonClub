import React, { useState, useRef, useEffect, useCallback } from "react";
import { Trophy, ZoomIn, ZoomOut, X, ChevronRight, Clock, CheckCircle2, Play, Download, ImageIcon } from "lucide-react";
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
  const lowerPlayer = player.toLowerCase();
  const pathMatchIds = new Set<string>(
    matches
      .filter((m) => 
        (m.team1_label ?? "").toLowerCase().includes(lowerPlayer) || 
        (m.team2_label ?? "").toLowerCase().includes(lowerPlayer) ||
        (m.match_code ?? "").toLowerCase().includes(lowerPlayer)
      )
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
    return "";
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
                      <div className="flex items-center gap-0.5 shrink-0 text-right">
                        {statusIcon(m)}
                        <span className={`text-[8px] font-bold ${isLive ? "text-red-400" : isCompleted ? "text-primary" : "text-muted-foreground"}`}>
                          {statusLabel(m)}
                          {isLive || isCompleted || statusLabel(m) === "Advance" ? null : (
                            ((m as any).scheduled_at || m.court_number) ? (
                              <span className="flex items-center gap-1.5 text-[10px] whitespace-nowrap ml-1">
                                {m.court_number && (
                                  <span className={cn("font-black px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-600/50 shadow-sm", getCourtColor(m.court_number))}>
                                    {String(m.court_number).toUpperCase().startsWith('C') ? String(m.court_number).toUpperCase() : `C${m.court_number}`}
                                  </span>
                                )}
                                {(m as any).scheduled_at && (
                                  <span className="text-slate-100 font-black tracking-wide drop-shadow-sm">
                                    {new Date((m as any).scheduled_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                    <span className="font-bold text-amber-400 ml-1">
                                      {new Date((m as any).scheduled_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit" })}
                                    </span>
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-slate-400 ml-1 tracking-widest">TBD</span>
                            )
                          )}
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
  const [searchTerm, setSearchTerm] = useState("");
  const [bracketSegment, setBracketSegment] = useState<string>("full");
  const [hiddenRounds, setHiddenRounds] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
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

  const SLOT_H = Math.max(MATCH_H + 20, 90);

  const getExportFilename = () => {
    const safeName = tournamentName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_Bracket_${category}_Visual`;
  };
  const visibleRounds = rounds.filter((r) => !hiddenRounds.includes(r));
  const totalW = visibleRounds.length * COL_W;

  type Pos = { match: BracketMatch; y: number; cy: number };

  // The 3rd place playoff shares a round number with the semifinal but sits
  // outside the knockout tree, so it must not take part in the slot layout.
  const isPlayoff = (m: BracketMatch) =>
    m.match_number >= 99 || (m.round_name ?? "").toLowerCase().includes("3rd");

  // Matches are placed by their structural slot (match_number), never by array
  // index: a player with more than one bye leaves a match out of the draw
  // entirely, and indexing would then shift everything below the gap upwards.
  const roundShapes = visibleRounds.map((round, ri) => {
    const originalRi = rounds.indexOf(round);
    const inRound = matches.filter((m) => m.round === round);
    const tree = inRound.filter((m) => !isPlayoff(m)).sort((a, b) => a.match_number - b.match_number);
    const slots = Math.max(
      Math.pow(2, rounds.length - 1 - originalRi),
      ...tree.map((m) => m.match_number),
      1
    );
    return { round, ri, tree, playoffs: inRound.filter(isPlayoff), slots };
  });

  const currentBaseSlots = roundShapes[0]?.slots ?? 1;
  let viewStartSlot = 0;
  let viewEndSlot = currentBaseSlots - 1;

  if (bracketSegment === "top-half") { viewEndSlot = Math.floor(currentBaseSlots / 2) - 1; }
  else if (bracketSegment === "bottom-half") { viewStartSlot = Math.floor(currentBaseSlots / 2); }
  else if (bracketSegment === "q1") { viewEndSlot = Math.floor(currentBaseSlots / 4) - 1; }
  else if (bracketSegment === "q2") { viewStartSlot = Math.floor(currentBaseSlots / 4); viewEndSlot = Math.floor(currentBaseSlots / 2) - 1; }
  else if (bracketSegment === "q3") { viewStartSlot = Math.floor(currentBaseSlots / 2); viewEndSlot = Math.floor((currentBaseSlots * 3) / 4) - 1; }
  else if (bracketSegment === "q4") { viewStartSlot = Math.floor((currentBaseSlots * 3) / 4); }

  viewEndSlot = Math.max(viewStartSlot, viewEndSlot);

  const pixelStart = viewStartSlot * SLOT_H;
  const pixelEnd = (viewEndSlot + 1) * SLOT_H;
  const viewH = pixelEnd - pixelStart;

  const treeH = currentBaseSlots * SLOT_H;
  const playoffRows = Math.max(0, ...roundShapes.map((r) => r.playoffs.length));
  
  const isBottomSegment = bracketSegment === "full" || bracketSegment === "bottom-half" || bracketSegment === "q4";
  const totalH = viewH + (isBottomSegment ? playoffRows * SLOT_H : 0);

  const roundData = roundShapes.map(({ round, ri, tree, playoffs, slots }) => {
    const slotH = treeH / slots;
    const bySlot = new Map<number, Pos>();
    const positions: Pos[] = [];
    for (const m of tree) {
      const slot = Math.min(Math.max(m.match_number - 1, 0), slots - 1);
      const cy = slot * slotH + slotH / 2 - pixelStart;
      const pos = { match: m, y: cy - MATCH_H / 2, cy };
      bySlot.set(slot, pos);
      if (cy >= -MATCH_H && cy <= totalH + MATCH_H) {
        positions.push(pos);
      }
    }
    // Playoffs hang below the tree so they can't disturb its spacing.
    playoffs.forEach((m, i) => {
      const cy = treeH + SLOT_H / 2 + i * SLOT_H - pixelStart;
      const pos = { match: m, y: cy - MATCH_H / 2, cy };
      bySlot.set(9999 + i, pos);
      if (cy >= -MATCH_H && cy <= totalH + MATCH_H) {
        positions.push(pos);
      }
    });
    const label = tree[0]?.round_name ?? playoffs[0]?.round_name ?? `R${round}`;
    return { round, ri, positions, bySlot, label };
  });

  // SVG connector lines — driven by the next round's slots, so a missing feeder
  // simply draws no stub instead of pulling the whole column out of alignment.
  const lines: React.ReactNode[] = [];
  for (let ri = 0; ri < roundData.length - 1; ri++) {
    const cur = roundData[ri];
    const next = roundData[ri + 1];
    const x1 = ri * COL_W + MATCH_W;
    const xMid = x1 + COL_GAP / 2;
    const x2 = ri + 1 < roundData.length - 1 ? (ri + 1) * COL_W : xMid + COL_GAP / 2;
    for (const [slot, nm] of next.bySlot) {
      const c1 = cur.bySlot.get(slot * 2);
      const c2 = cur.bySlot.get(slot * 2 + 1);
      if (!c1 && !c2) continue;
      if (c1) lines.push(<line key={`a-${ri}-${slot}`} x1={x1} y1={c1.cy} x2={xMid} y2={c1.cy} stroke="#444" strokeWidth={1.5} />);
      if (c2) lines.push(<line key={`b-${ri}-${slot}`} x1={x1} y1={c2.cy} x2={xMid} y2={c2.cy} stroke="#444" strokeWidth={1.5} />);
      if (c1 && c2) lines.push(<line key={`c-${ri}-${slot}`} x1={xMid} y1={c1.cy} x2={xMid} y2={c2.cy} stroke="#444" strokeWidth={1.5} />);
      lines.push(<line key={`d-${ri}-${slot}`} x1={xMid} y1={nm.cy} x2={x2} y2={nm.cy} stroke="#444" strokeWidth={1.5} />);
    }
  }

  // Player path highlight
  const pathSet = (() => {
    if (!enablePathHighlight || !selectedPlayer) return new Set<string>();
    const lowerPlayer = selectedPlayer.toLowerCase();
    const path = new Set<string>();
    matches.forEach((m) => {
      if (
        (m.team1_label ?? "").toLowerCase().includes(lowerPlayer) || 
        (m.team2_label ?? "").toLowerCase().includes(lowerPlayer) ||
        (m.match_code ?? "").toLowerCase().includes(lowerPlayer)
      )
        path.add(m.id);
    });
    let changed = true;
    while (changed) {
      changed = false;
      matches.forEach((m) => {
        if (path.has(m.id)) return;
        const winner = m.winner_side === 1 ? m.team1_label : m.winner_side === 2 ? m.team2_label : null;
        if (winner?.toLowerCase().includes(lowerPlayer) || (m.match_code ?? "").toLowerCase().includes(lowerPlayer)) { path.add(m.id); changed = true; }
      });
    }
    return path;
  })();

  const scaledH = (totalH + PADDING * 2 + LABEL_H) * scale;
  const scaledW = (totalW + PADDING * 2) * scale;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    
    if (val.length < 2) {
      if (val.length === 0 && enablePathHighlight) setSelectedPlayer(null);
      return;
    }

    const lowerVal = val.toLowerCase();
    let foundPos = null;
    let foundRi = 0;

    for (let ri = 0; ri < roundData.length; ri++) {
      for (const pos of roundData[ri].positions) {
        if (
          pos.match.team1_label?.toLowerCase().includes(lowerVal) ||
          pos.match.team2_label?.toLowerCase().includes(lowerVal) ||
          pos.match.match_code?.toLowerCase().includes(lowerVal)
        ) {
          foundPos = pos;
          foundRi = ri;
          break;
        }
      }
      if (foundPos) break;
    }

    if (foundPos && containerRef.current) {
      if (enablePathHighlight) setSelectedPlayer(val);
      const x = foundRi * COL_W + PADDING;
      const y = foundPos.y + PADDING + LABEL_H;
      
      const scaledX = x * scale;
      const scaledY = y * scale;
      
      containerRef.current.scrollTo({
        left: Math.max(0, scaledX - containerRef.current.clientWidth / 2 + (MATCH_W * scale) / 2),
        top: Math.max(0, scaledY - containerRef.current.clientHeight / 2 + (MATCH_H * scale) / 2),
        behavior: "smooth",
      });
    }
  };

  // Touch target height for player rows (min 44px for mobile)
  const playerRowH = isMobile ? 44 : 36;

  return (
    <div className="rounded-2xl border border-slate-700 overflow-hidden" style={{ background: "#0d1117" }}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 py-2 border-b border-slate-800 gap-2">
        <div className="flex w-full sm:w-auto items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest truncate mr-2">
            {enablePathHighlight && selectedPlayer
              ? <><span className="text-primary font-black">{selectedPlayer}</span><span className="text-muted-foreground"> · roadmap open</span></>
              : enablePathHighlight ? "Tap a player to see roadmap" : "Bracket"
            }
          </span>
          <input
            type="text"
            placeholder="Find player..."
            value={searchTerm}
            onChange={handleSearch}
            className="sm:hidden bg-slate-900/50 text-white text-[10px] sm:text-xs rounded border border-slate-700 px-2 py-1 outline-none focus:border-primary w-28 ml-auto"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-auto sm:mr-4">
          <input
            type="text"
            placeholder="Find player..."
            value={searchTerm}
            onChange={handleSearch}
            className="hidden sm:block bg-slate-900/50 text-white text-[10px] sm:text-xs rounded border border-slate-700 px-2 py-1 outline-none focus:border-primary w-28 mr-2"
          />
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as "tree" | "list")}
            className="bg-slate-900/50 text-slate-300 text-[10px] sm:text-xs rounded border border-slate-700 px-2 py-1 outline-none focus:border-primary mr-2"
          >
            <option value="tree">Tree View</option>
            <option value="list">List View</option>
          </select>
          {currentBaseSlots >= 16 && (
            <select
              value={bracketSegment}
              onChange={(e) => setBracketSegment(e.target.value)}
              className="bg-slate-900/50 text-slate-300 text-[10px] sm:text-xs rounded border border-slate-700 px-2 py-1 outline-none focus:border-primary mr-2"
            >
              <option value="full">Full Tree</option>
              <option value="top-half">Top Half</option>
              <option value="bottom-half">Bottom Half</option>
              {currentBaseSlots >= 32 && (
                <>
                  <option value="q1">Quarter 1</option>
                  <option value="q2">Quarter 2</option>
                  <option value="q3">Quarter 3</option>
                  <option value="q4">Quarter 4</option>
                </>
              )}
            </select>
          )}
          {hiddenRounds.length > 0 && (
            <button
              onClick={() => setHiddenRounds([])}
              className="px-2 py-1 mr-1 flex items-center gap-1 text-[10px] font-bold uppercase rounded-md text-amber-400 hover:text-white hover:bg-amber-500/20 active:bg-amber-500/30 transition-colors border border-amber-500/30"
              title="Show hidden rounds"
            >
              Unhide ({hiddenRounds.length})
            </button>
          )}
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
            PNG
          </button>
          <button
            onClick={() => {
              const el = document.getElementById("bracket-visual-export-container");
              if (el) {
                import("@/utils/exportUtils").then(({ exportElementToJpeg }) => {
                  exportElementToJpeg(el, getExportFilename(), "#0d1117", { transform: 'scale(1)' });
                });
              }
            }}
            className="px-2 py-1 flex items-center gap-1 text-[10px] font-bold uppercase rounded-md text-slate-300 hover:text-white hover:bg-indigo-500/20 active:bg-indigo-500/30 transition-colors"
          >
            JPG
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

      {/* View Content */}
      {viewMode === "list" ? (
        <div className="p-4 space-y-8 overflow-y-auto w-full" style={{ maxHeight: isMobile ? "60vh" : "75vh", background: "#0d1117" }}>
          {roundData.map(({ ri, label, round, positions }) => (
            <div key={ri} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">{label}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {positions.map(({ match: m }) => {
                  const isCompleted = m.status === "completed";
                  const isLive = m.status === "in_progress";
                  const t1 = m.team1_label ?? "TBD";
                  const t2 = m.team2_label ?? "TBD";
                  const t1Won = isCompleted && m.winner_side === 1;
                  const t2Won = isCompleted && m.winner_side === 2;

                  return (
                    <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col hover:border-slate-700 transition-colors">
                      <div className="flex justify-between items-center px-3 py-1.5 bg-slate-950/50 border-b border-slate-800 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <span>{m.match_code}</span>
                        {m.court_number && <span>Court {m.court_number}</span>}
                      </div>
                      <div className="flex flex-col p-3 gap-2 flex-1 justify-center">
                        <div className={`flex justify-between items-center ${t1Won ? "text-primary font-black" : isCompleted ? "text-muted-foreground" : "text-slate-200"}`}>
                          <span className="truncate pr-2 text-xs">{t1}</span>
                          {t1Won && <Trophy size={12} className="text-amber-400 shrink-0" />}
                        </div>
                        <div className={`flex justify-between items-center ${t2Won ? "text-primary font-black" : isCompleted ? "text-muted-foreground" : "text-slate-200"}`}>
                          <span className="truncate pr-2 text-xs">{t2}</span>
                          {t2Won && <Trophy size={12} className="text-amber-400 shrink-0" />}
                        </div>
                      </div>
                      {(m.score || isLive) && (
                        <div className="px-3 py-2 bg-slate-950/30 border-t border-slate-800 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                          {isLive ? (
                            <span className="text-amber-500 animate-pulse flex items-center gap-1"><Play size={10} /> Live Match</span>
                          ) : (
                            <span className="text-slate-400">{m.score}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Scrollable bracket */
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
              {roundData.map(({ ri, label, round }) => (
                <div key={ri} style={{ width: COL_W, flexShrink: 0 }}
                  className="text-[10px] font-black uppercase tracking-widest text-center text-indigo-400 flex items-center justify-center gap-1 group">
                  {label}
                  <button
                    onClick={() => setHiddenRounds(prev => [...prev, round])}
                    className="opacity-50 hover:opacity-100 p-0.5 rounded hover:bg-slate-800 text-indigo-300 hover:text-white transition-all"
                    title="Hide this round"
                  >
                    <X size={12} />
                  </button>
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
                
                const isMatchOnPath = pathSet.has(m.id);
                const opacity = enablePathHighlight && selectedPlayer && !isMatchOnPath ? 0.3 : 1;
                
                const sets = m.sets_history?.length && Array.isArray(m.sets_history)
                  ? m.sets_history.map((s) => {
                      if (typeof s !== "string") return { t1: 0, t2: 0 };
                      const [a, b] = s.split("-").map(Number);
                      return { t1: isNaN(a) ? 0 : a, t2: isNaN(b) ? 0 : b };
                    })
                  : null;

                return (
                  <div
                    key={m.id}
                    className={`absolute flex flex-col justify-center transition-opacity duration-300 ${isMatchOnPath ? 'z-10' : 'z-0'}`}
                    style={{
                      left: PADDING + ri * COL_W,
                      top: PADDING + y + LABEL_H,
                      width: MATCH_W,
                      height: MATCH_H,
                      opacity
                    }}
                  >
                    <div className={`flex flex-col bg-slate-900 border ${isMatchOnPath ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10' : 'border-slate-700/80 shadow-md'} rounded overflow-hidden`}>
                      {/* Match header */}
                      <div className={`flex justify-between items-center px-2 py-1 text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'bg-slate-800 text-slate-400' : isLive ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800/50 text-muted-foreground'}`}>
                        <span>{m.match_code}</span>
                        <span className="flex items-center gap-1">
                          {isCompleted ? (
                            <span className="text-slate-500">Done</span>
                          ) : (
                            isLive ? (
                              <span className="flex items-center gap-1 text-amber-500 font-bold">
                                Live
                                {m.court_number && (
                                  <span className={cn("font-black px-1.5 py-0.5 rounded-md text-[8px] bg-slate-800/80 border border-slate-600/50 shadow-sm", getCourtColor(m.court_number))}>
                                    {String(m.court_number).toUpperCase().startsWith('C') ? String(m.court_number).toUpperCase() : `C${m.court_number}`}
                                  </span>
                                )}
                              </span>
                            ) : (m as any).scheduled_at ? (
                              <span className="flex items-center gap-1 text-[9px]">
                                {m.court_number && (
                                  <span className={cn("font-black px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-600/50 shadow-sm", getCourtColor(m.court_number))}>
                                    {String(m.court_number).toUpperCase().startsWith('C') ? String(m.court_number).toUpperCase() : `C${m.court_number}`}
                                  </span>
                                )}
                                <span className="text-slate-100 font-black tracking-wide drop-shadow-sm">
                                  {new Date((m as any).scheduled_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                  <span className="font-bold text-amber-400 ml-1">
                                    {new Date((m as any).scheduled_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit" })}
                                  </span>
                                </span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-slate-400 tracking-widest">TBD</span>
                            )
                          )}
                          {isLive && <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </span>
                      </div>
                      {/* Players + scores */}
                      <div className="flex">
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div
                            onClick={enablePathHighlight ? () => setSelectedPlayer(selectedPlayer === t1 ? null : t1) : undefined}
                            style={{ minHeight: playerRowH }}
                            className={`flex-1 flex items-center gap-1 px-2 border-b border-slate-700/50 ${t1Won ? "bg-amber-500/20" : ""} ${enablePathHighlight ? "cursor-pointer active:bg-slate-700/50" : ""}`}
                          >
                            <span className={`flex-1 text-[11px] font-bold truncate leading-tight ${t1Won ? "text-amber-300" : "text-slate-300"}`}>{t1}</span>
                            {t1Won && <Trophy size={11} className="text-amber-400 shrink-0" />}
                          </div>
                          <div
                            onClick={enablePathHighlight ? () => setSelectedPlayer(selectedPlayer === t2 ? null : t2) : undefined}
                            style={{ minHeight: playerRowH }}
                            className={`flex-1 flex items-center gap-1 px-2 ${t2Won ? "bg-amber-500/20" : ""} ${enablePathHighlight ? "cursor-pointer active:bg-slate-700/50" : ""}`}
                          >
                            <span className={`flex-1 text-[11px] font-bold truncate leading-tight ${t2Won ? "text-amber-300" : "text-slate-300"}`}>{t2}</span>
                            {t2Won && <Trophy size={11} className="text-amber-400 shrink-0" />}
                          </div>
                        </div>
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
      )}

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
