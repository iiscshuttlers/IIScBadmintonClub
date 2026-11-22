import React, { useState, useRef, useEffect, useCallback } from "react";
import { Trophy, ZoomIn, ZoomOut, X, ChevronRight, Clock, CheckCircle2, Play, Download, ImageIcon, ChevronDown, Maximize2, Minimize2, Printer } from "lucide-react";
import { getCourtColor, cn } from "@/lib/utils";
import { matchOutcome } from "@/lib/matchView";
import { seedForSide, type PublishedSeeds } from "@/lib/seeding";
import { cssVar, themeColor, themeColorFor } from "@/lib/themeColors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COL_W,
  LABEL_H,
  MATCH_H,
  MATCH_W,
  PADDING,
  PLAYER_ROW_H_DESKTOP,
  PLAYER_ROW_H_MOBILE,
  bracketConnectors,
  bracketPathIds,
  computeBracketLayout,
  findInBracket,
  fitScale,
  initialHiddenRounds,
  isEliminatedAt,
  isPlayoffMatch,
  playerRoadmap,
  roadmapCardSides,
  shortRoundName,
} from "./bracketLayout";

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
  /** Side 1 = player1 (+ player3 partner), side 2 = player2 (+ player4). Used for seed marks. */
  player1_id?: string | null;
  player2_id?: string | null;
  player3_id?: string | null;
  player4_id?: string | null;
}

interface BracketVisualProps {
  matches: BracketMatch[];
  rounds: number[];
  enablePathHighlight?: boolean;
  onExportExcel?: () => void;
  tournamentName?: string;
  category?: string;
  /** Published seeds of this category (lib/seeding); shown as [n] after the name. */
  seeds?: PublishedSeeds | null;
}

const sideSeeds = (m: BracketMatch, seeds: PublishedSeeds | null | undefined): [number | null, number | null] => [
  seedForSide(seeds, [m.player1_id, m.player3_id], m.team1_label),
  seedForSide(seeds, [m.player2_id, m.player4_id], m.team2_label),
];

/** Published seed after a name: stays visible when the name truncates. */
function SeedTag({ seed }: { seed: number | null }) {
  if (seed == null) return null;
  return (
    <span className="shrink-0 text-[10px] font-black text-primary tabular-nums" title={`Seed ${seed}`}>
      [{seed}]<span className="sr-only"> seed {seed}</span>
    </span>
  );
}

const CAT_BOX_COLORS_DARK: Record<string, string> = {
  MS: "bg-cat-ms/10 border-cat-ms/25 hover:border-cat-ms/50 hover:shadow-cat-ms/20",
  WS: "bg-cat-ws/10 border-cat-ws/25 hover:border-cat-ws/50 hover:shadow-cat-ws/20",
  MD: "bg-cat-md/10 border-cat-md/20 hover:border-cat-md/50 hover:shadow-cat-md/20",
  WD: "bg-cat-wd/10 border-cat-wd/25 hover:border-cat-wd/50 hover:shadow-cat-wd/20",
  XD: "bg-cat-xd/10 border-cat-xd/25 hover:border-cat-xd/50 hover:shadow-cat-xd/20",
  BS: "bg-team/10 border-team/25 hover:border-team/50 hover:shadow-team/20",
  GS: "bg-danger/10 border-danger/25 hover:border-danger/50 hover:shadow-danger/20",
  BD: "bg-accent/10 border-accent/25 hover:border-accent/50 hover:shadow-accent/20",
  GD: "bg-individual/10 border-individual/25 hover:border-individual/50 hover:shadow-individual/20",
};

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
  const road = playerRoadmap(matches, player);
  const { roadmap } = road;

  const cardW = isMobile ? 155 : 200;

  const statusIcon = (m: BracketMatch) => {
    if (matchOutcome(m).decided) return <CheckCircle2 size={12} className="text-primary shrink-0" />;
    if (matchOutcome(m).state === "live") return <Play size={12} className="text-live shrink-0 animate-pulse" />;
    return <Clock size={12} className="text-muted-foreground shrink-0" />;
  };

  const statusLabel = (m: BracketMatch) => {
    const o = matchOutcome(m);
    if (o.decided || o.state === "live" || o.state === "cancelled") return o.statusLabel;
    if (m.team1_label === "BYE" || m.team2_label === "BYE") return "Advance";
    return "";
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-media/50 backdrop-blur-sm" onClick={onClose} />

      {/* Centered modal — sits in the middle of the viewport */}
      <div
        className="fixed inset-x-3 z-50 rounded-2xl border border-border-strong shadow-2xl"
        style={{
          background: cssVar("background"),
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">Player Roadmap</p>
            <p className={`font-black text-primary truncate ${isMobile ? "text-sm" : "text-sm"}`}>{player}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-3 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted-strong active:bg-faint transition-colors"
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
              const outcome = matchOutcome(m);
              const isCompleted = outcome.decided;
              const isLive = outcome.state === "live";

              const { playerName, opponentName, effectivePlayerIsT1, playerWon, playerLost } = roadmapCardSides(m, player, road);

              const sets = outcome.games.length
                ? outcome.games.map((g) => (effectivePlayerIsT1 ? { me: g.side1, opp: g.side2 } : { me: g.side2, opp: g.side1 }))
                : null;

              const borderColor = isLive
                ? "border-live ring-1 ring-live"
                : playerWon
                ? "border-primary"
                : "border-border-strong";

              return (
                <React.Fragment key={m.id}>
                  {idx > 0 && (
                    <div className="flex items-center shrink-0">
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  )}

                  <div
                    className={`rounded-xl border ${borderColor} overflow-hidden shrink-0 flex flex-col`}
                    style={{ background: cssVar("card"), width: cardW }}
                  >
                    {/* Card header */}
                    <div className="px-2.5 py-1.5 border-b border-border-strong/50 flex items-center justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-wider text-warning truncate">
                          {m.round_name ?? `Round ${m.round}`}
                        </p>
                        <p className="text-[8px] text-muted-foreground">{m.match_code}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 text-right">
                        {statusIcon(m)}
                        <span className={`text-[8px] font-bold ${isLive ? "text-live" : isCompleted ? "text-primary" : "text-muted-foreground"}`}>
                          {statusLabel(m)}
                          {isLive || isCompleted || statusLabel(m) === "Advance" ? null : (
                            ((m as any).scheduled_at || m.court_number) ? (
                              <span className="flex items-center gap-1.5 text-[10px] whitespace-nowrap ml-1">
                                {m.court_number && (
                                  <span className={cn("font-black px-1.5 py-0.5 rounded-md bg-muted/80 border border-border-strong/50 shadow-sm", getCourtColor(m.court_number))}>
                                    {String(m.court_number).toUpperCase().startsWith('C') ? String(m.court_number).toUpperCase() : `C${m.court_number}`}
                                  </span>
                                )}
                                {(m as any).scheduled_at && (
                                  <span className="text-foreground font-black tracking-wide drop-shadow-sm">
                                    {new Date((m as any).scheduled_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                    <span className="font-bold text-warning ml-1">
                                      {new Date((m as any).scheduled_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit" })}
                                    </span>
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">TBD</span>
                            )
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Player row */}
                    <div className={`px-2.5 flex items-center justify-between gap-1 border-b border-border-strong/30 ${playerWon ? "bg-primary/10" : ""}`} style={{ minHeight: 36 }}>
                      <div className="flex items-center gap-1 min-w-0">
                        {playerWon && <Trophy size={9} className="text-gold shrink-0" />}
                        <span className={`text-[10px] font-black truncate ${playerWon ? "text-gold" : playerLost ? "text-muted-foreground" : "text-foreground"}`}>
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
                    <div className={`px-2.5 flex items-center justify-between gap-1 ${playerLost ? "bg-warning/10" : ""}`} style={{ minHeight: 36 }}>
                      <span className={`text-[10px] font-semibold truncate ${playerLost ? "text-warning" : "text-muted-foreground"}`}>
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
                      <div className="px-2.5 py-1 border-t border-border-strong/30">
                        <span className="text-[8px] text-info">Court {m.court_number}</span>
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
              const isEliminated = isEliminatedAt(last, player);

              return (
                <>
                  <div className="flex items-center shrink-0">
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </div>
                  {isEliminated ? (
                    <div
                      className="flex items-center justify-center rounded-xl border border-border-strong/30 shrink-0"
                      style={{ background: cssVar("card"), width: 72, minHeight: 80 }}
                    >
                      <div className="text-center px-1">
                        <p className="text-base leading-none mb-1">🏸</p>
                        <p className="text-[8px] text-muted-foreground uppercase tracking-widest leading-tight">Good game!</p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-xl border border-border-strong/40 shrink-0"
                      style={{ background: cssVar("card"), width: 60, minHeight: 80 }}
                    >
                      <div className="text-center">
                        <Trophy size={18} className="text-gold/25 mx-auto mb-0.5" />
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
        <div className="p-4 bg-danger/20 text-danger font-mono text-xs whitespace-pre-wrap">
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
      <BracketVisualInner key={props.category} {...props} />
    </BracketVisualErrorBoundary>
  );
}

function BracketVisualInner({ matches, rounds, enablePathHighlight = false, onExportExcel, tournamentName = "Tournament", category = "All", seeds }: BracketVisualProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [bracketSegment, setBracketSegment] = useState<string>("full");
  const [hiddenRounds, setHiddenRounds] = useState<number[]>(() => initialHiddenRounds(matches, rounds));
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const normalContainerRef = useRef<HTMLDivElement>(null);
  const fsContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Pinch-to-zoom state
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: scale };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.startDist;
      const newScale = Math.min(2.5, Math.max(0.3, +(pinchRef.current.startScale * ratio).toFixed(2)));
      setScale(newScale);
    }
  }, []);

  const handleTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  // Android hardware back button closes fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    let cleanup: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("backButton", () => setIsFullscreen(false)).then((handle) => {
        cleanup = () => handle.remove();
      });
    }).catch(() => {/* web — no-op */});
    // Web keyboard Escape
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      cleanup?.();
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  // Fit the VISIBLE rounds to the width (hidden early rounds used to count,
  // which shrank a 4-round view to ~40%). Never below a readable 70% — past
  // that the draw scrolls sideways — and up to 125% when there is room.
  const visibleCount = Math.max(1, rounds.length - hiddenRounds.length);
  const computeScale = useCallback(() => {
    const el = isFullscreen ? fsContainerRef.current : normalContainerRef.current;
    if (!el) return;
    setScale(fitScale(el.clientWidth, visibleCount));
  }, [visibleCount, isFullscreen]);

  useEffect(() => {
    computeScale();
    window.addEventListener("resize", computeScale);
    return () => window.removeEventListener("resize", computeScale);
  }, [computeScale, viewMode]);


  const getExportFilename = () => {
    const safeName = tournamentName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_Bracket_${category}_Visual`;
  };
  const visibleRounds = rounds.filter((r) => !hiddenRounds.includes(r));
  // Slot layout, segment window and playoff rows: see bracketLayout.ts.
  const { roundData, baseSlots: currentBaseSlots, totalW, totalH } = computeBracketLayout(matches, rounds, visibleRounds, bracketSegment);

  // SVG connector lines — driven by the next round's slots, so a missing feeder
  // simply draws no stub instead of pulling the whole column out of alignment.
  const lines: React.ReactNode[] = bracketConnectors(roundData).map((l) => (
    <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={cssVar("border-strong")} strokeWidth={1.5} />
  ));

  // Player path highlight
  const pathSet = !enablePathHighlight || !selectedPlayer ? new Set<string>() : bracketPathIds(matches, selectedPlayer);

  const scaledH = (totalH + PADDING * 2 + LABEL_H) * scale;
  const scaledW = (totalW + PADDING * 2) * scale;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    
    if (val.length < 2) {
      if (val.length === 0 && enablePathHighlight) setSelectedPlayer(null);
      return;
    }

    const hit = findInBracket(roundData, val);

    if (hit) {
      const { pos: foundPos, ri: foundRi, playerName: exactPlayerName } = hit;
      if (exactPlayerName) {
        setSelectedPlayer(exactPlayerName);
        if (enablePathHighlight) setShowRoadmap(true);
      }
      const x = foundRi * COL_W + PADDING;
      const y = foundPos.y + PADDING + LABEL_H;
      
      const scaledX = x * scale;
      const scaledY = y * scale;
      
      const scrollOpts = (el: HTMLDivElement) => ({
        left: Math.max(0, scaledX - el.clientWidth / 2 + (MATCH_W * scale) / 2),
        top: Math.max(0, scaledY - el.clientHeight / 2 + (MATCH_H * scale) / 2),
        behavior: "smooth" as ScrollBehavior,
      });

      normalContainerRef.current?.scrollTo(scrollOpts(normalContainerRef.current));
      fsContainerRef.current?.scrollTo(scrollOpts(fsContainerRef.current));
    } else {
      if (val.length >= 2) {
        setSelectedPlayer(null);
        setShowRoadmap(false);
      }
    }
  };

  // Touch target height for player rows (min 44px for mobile)
  const playerRowH = isMobile ? PLAYER_ROW_H_MOBILE : PLAYER_ROW_H_DESKTOP;

  // ── Shared toolbar renderer (used in both normal and fullscreen mode) ──────
  const toolbar = (
    <div className="flex flex-col md:flex-row gap-2 px-3 py-2 border-b border-border bg-background shadow-sm relative z-10">
      
      {/* --- ROW 1 --- */}
      <div className="flex items-center gap-2 w-full md:w-auto md:flex-1">
        {/* 1. Search & View */}
        <div className="flex items-center gap-1 bg-card/80 p-1 rounded-md border border-border-strong/60 shadow-sm flex-1 min-w-0 overflow-x-auto">
          <input
            type="text"
            placeholder="Find player..."
            value={searchTerm}
            onChange={handleSearch}
            className="bg-transparent text-foreground text-[10px] px-2 py-1 outline-none focus:text-primary w-24 shrink-0 placeholder:text-muted-foreground"
          />
          <div className="w-px h-3 bg-muted-strong mx-1 shrink-0" />
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as "tree" | "list")}
            className="bg-transparent text-soft text-[10px] outline-none cursor-pointer shrink-0"
          >
            <option value="tree" className="bg-card">Tree</option>
            <option value="list" className="bg-card">List</option>
          </select>
          {currentBaseSlots >= 16 && (
            <>
              <div className="w-px h-3 bg-muted-strong mx-1 shrink-0" />
              <select
                value={bracketSegment}
                onChange={(e) => setBracketSegment(e.target.value)}
                className="bg-transparent text-soft text-[10px] outline-none cursor-pointer shrink-0"
              >
                <option value="full" className="bg-card">Full</option>
                <option value="top-half" className="bg-card">Top ½</option>
                <option value="bottom-half" className="bg-card">Bot ½</option>
                {currentBaseSlots >= 32 && (
                  <>
                    <option value="q1" className="bg-card">Q1</option>
                    <option value="q2" className="bg-card">Q2</option>
                    <option value="q3" className="bg-card">Q3</option>
                    <option value="q4" className="bg-card">Q4</option>
                  </>
                )}
              </select>
            </>
          )}
        </div>

        {/* 2. Export Controls (Print & Download) */}
        <div className="flex items-center gap-1 bg-card/80 p-1 rounded-md border border-border-strong/60 shadow-sm shrink-0">
          {/* Print Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted-strong active:bg-faint transition-colors shrink-0"
                title="Print..."
              >
                <Printer size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-44">
              {[1, 2, 4].map(pages => (
                <DropdownMenuItem
                  key={pages}
                  onClick={async () => {
                    const el = document.getElementById("bracket-visual-export-container");
                    if (el) {
                      el.classList.add("print-light-theme");
                      await new Promise(r => setTimeout(r, 50));
                      const paperCard = themeColorFor("paper", "card");
                      import("@/utils/exportUtils").then(({ exportElementToPDF }) => {
                        exportElementToPDF(el, `${getExportFilename()}_Print_${pages}Pg`, paperCard, { transform: 'scale(1)', backgroundColor: paperCard }, pages).finally(() => {
                          el.classList.remove("print-light-theme");
                        });
                      });
                    }
                  }}
                  className="text-xs cursor-pointer"
                >
                  {pages === 1 ? "Single Page (Full)" : pages === 2 ? "2 Pages (Halves)" : "4 Pages (Quarters)"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-3 bg-muted-strong mx-0.5 shrink-0" />

          {/* Download Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted-strong active:bg-faint transition-colors shrink-0"
                title="Download..."
              >
                <Download size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem
                onClick={() => {
                  const el = document.getElementById("bracket-visual-export-container");
                  if (el) import("@/utils/exportUtils").then(({ exportElementToPDF }) => exportElementToPDF(el, getExportFilename(), themeColor("background"), { transform: 'scale(1)' }));
                }}
                className="text-xs cursor-pointer"
              >
                As PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const el = document.getElementById("bracket-visual-export-container");
                  if (el) import("@/utils/exportUtils").then(({ exportElementToImage }) => exportElementToImage(el, getExportFilename(), themeColor("background"), { transform: 'scale(1)' }));
                }}
                className="text-xs cursor-pointer"
              >
                As PNG
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const el = document.getElementById("bracket-visual-export-container");
                  if (el) import("@/utils/exportUtils").then(({ exportElementToJpeg }) => exportElementToJpeg(el, getExportFilename(), themeColor("background"), { transform: 'scale(1)' }));
                }}
                className="text-xs cursor-pointer"
              >
                As JPG
              </DropdownMenuItem>
              {onExportExcel && (
                <DropdownMenuItem
                  onClick={onExportExcel}
                  className="text-xs cursor-pointer text-success focus:text-success/80"
                >
                  As Excel
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Fullscreen Close Button (inline with toolbar) */}
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-full bg-card/90 text-soft border border-border-strong shadow-sm hover:bg-danger/20 hover:text-danger active:scale-95 transition-all shrink-0"
            title="Exit Fullscreen"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* --- ROW 2 --- */}
      <div className="flex items-center justify-between gap-2 w-full md:w-auto shrink-0">
        {/* 3. Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1 bg-card/80 p-1 rounded-md border border-border-strong/60 shadow-sm shrink-0 overflow-x-auto">
          <button
            onClick={() => setScale((s) => Math.max(0.3, +(s - 0.1).toFixed(1)))}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted-strong active:bg-faint transition-colors shrink-0"
            aria-label="Zoom out"
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-[9px] font-mono font-medium text-muted-foreground w-7 text-center tabular-nums shrink-0">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, +(s + 0.1).toFixed(1)))}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted-strong active:bg-faint transition-colors shrink-0"
            aria-label="Zoom in"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={computeScale}
            className="text-[9px] font-bold uppercase text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted-strong active:bg-faint transition-colors shrink-0"
          >
            Fit
          </button>
          
          {/* Fullscreen toggle */}
          {!isFullscreen && (
            <>
              <div className="w-px h-3 bg-muted-strong mx-0.5 shrink-0" />
              <button
                onClick={() => setIsFullscreen(true)}
                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted-strong active:bg-faint transition-colors shrink-0"
                title="Fullscreen"
              >
                <Maximize2 size={12} />
              </button>
            </>
          )}
        </div>

        {/* 4. Start the draw at a round (early, finished rounds start hidden) */}
        {rounds.length > 2 && (
          <label className="flex items-center gap-1.5 bg-card/80 px-2 py-1 rounded-md border border-border-strong/60 shadow-sm shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
            From
            <select
              value={visibleRounds[0] ?? rounds[0]}
              onChange={(e) => {
                const from = Number(e.target.value);
                setHiddenRounds(rounds.filter((r) => r < from));
              }}
              className="bg-transparent text-foreground text-[11px] font-black normal-case outline-none cursor-pointer"
              aria-label="Show the draw from round"
            >
              {rounds.map((r) => {
                const name = matches.find((m) => m.round === r && !isPlayoffMatch(m))?.round_name;
                return (
                  <option key={r} value={r} className="bg-card">
                    {shortRoundName(name, r)}
                  </option>
                );
              })}
            </select>
          </label>
        )}
      </div>
    </div>
  );

  return (
    <>
    {/* ── Fullscreen overlay ────────────────────────────────────────────── */}
    {isFullscreen && (
      <div
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ background: cssVar("background") }}
      >
        {/* Fullscreen toolbar (reused) */}
        <div className="shrink-0">{toolbar}</div>
        {/* Bracket canvas — fills remaining space */}
        {viewMode === "list" ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-8">
            {/* list content rendered below */}
          </div>
        ) : (
          <div
            ref={fsContainerRef}
            className="flex-1"
            style={{
              overflowX: "auto",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
              touchAction: pinchRef.current ? "none" : "pan-x pan-y",
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              id="bracket-visual-export-container"
              className="bracket-export-bg"
              style={{
                transformOrigin: "top left",
                transform: `scale(${scale})`,
                width: totalW + PADDING * 2,
                height: totalH + PADDING * 2 + LABEL_H,
                minWidth: (totalW + PADDING * 2) * scale,
                minHeight: (totalH + PADDING * 2 + LABEL_H) * scale,
                position: "relative",
              }}
            >
              {/* Round labels */}
              <div className="flex absolute top-0 left-0" style={{ paddingLeft: PADDING, paddingTop: PADDING / 2 }}>
                {roundData.map(({ ri, label, round }) => (
                  <div key={ri} style={{ width: COL_W, flexShrink: 0 }}
                    className="text-[10px] font-black uppercase tracking-widest text-info flex items-center gap-1"
                  >
                    {label}
                  </div>
                ))}
              </div>
              {/* SVG connector lines */}
              <svg
                style={{ position: "absolute", top: PADDING + LABEL_H, left: PADDING, overflow: "visible", pointerEvents: "none" }}
                width={totalW}
                height={totalH}
              >
                {lines}
              </svg>
              {/* Match cards */}
              {roundData.map(({ ri, positions }) =>
                positions.map(({ match: m, y }) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    x={ri * COL_W + PADDING}
                    y={y + PADDING + LABEL_H}
                    isHighlighted={pathSet.has(m.id)}
                    enablePathHighlight={enablePathHighlight}
                    selectedPlayer={selectedPlayer}
                    onHide={() => setHiddenRounds((h) => [...h, m.round])}
                    onPlayerClick={enablePathHighlight ? (name) => {
                      if (selectedPlayer === name) {
                        if (!showRoadmap) setShowRoadmap(true);
                        else {
                          setSelectedPlayer(null);
                          setShowRoadmap(false);
                        }
                      } else {
                        setSelectedPlayer(name);
                        setShowRoadmap(true);
                      }
                    } : undefined}
                    playerRowH={playerRowH}
                    category={category}
                    seeds={seeds}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )}

    {/* ── Normal (in-page) view ──────────────────────────────────────────── */}
    <div className="rounded-2xl border border-border-strong overflow-hidden" style={{ background: cssVar("background") }}>
      {/* Toolbar */}
      {toolbar}

      {/* View Content */}
      {viewMode === "list" ? (
        <div className="p-4 space-y-8 overflow-y-auto w-full" style={{ maxHeight: isMobile ? "60vh" : "75vh", background: cssVar("background") }}>
          {roundData.map(({ ri, label, round, positions }) => (
            <div key={ri} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-info">{label}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {positions.map(({ match: m }) => {
                  // Shared status rules (WP6): walkovers are decided, live never shows a winner.
                  const outcome = matchOutcome(m);
                  const isCompleted = outcome.decided;
                  const isLive = outcome.state === "live";
                  const t1 = m.team1_label ?? "TBD";
                  const t2 = m.team2_label ?? "TBD";
                  const [s1, s2] = sideSeeds(m, seeds);
                  const t1Won = outcome.t1Won;
                  const t2Won = outcome.t2Won;

                  return (
                    <div key={m.id} className={cn(
                      "rounded-xl overflow-hidden shadow-sm flex flex-col transition-colors border",
                      CAT_BOX_COLORS_DARK[category || ""] || "bg-card border-border hover:border-border-strong"
                    )}>
                      <div className="flex justify-between items-center px-3 py-1.5 bg-background/50 border-b border-border/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <span>{m.match_code}</span>
                        {m.court_number && <span>Court {m.court_number}</span>}
                      </div>
                      <div className="flex flex-col p-3 gap-2 flex-1 justify-center">
                        <div className={`flex justify-between items-center ${t1Won ? "text-primary font-black" : isCompleted ? "text-muted-foreground" : "text-soft"}`}>
                          <span className="truncate pr-2 text-xs flex-1">{t1}</span>
                          <SeedTag seed={s1} />
                          {t1Won && <Trophy size={12} className="text-gold shrink-0 ml-1" />}
                        </div>
                        <div className={`flex justify-between items-center ${t2Won ? "text-primary font-black" : isCompleted ? "text-muted-foreground" : "text-soft"}`}>
                          <span className="truncate pr-2 text-xs flex-1">{t2}</span>
                          <SeedTag seed={s2} />
                          {t2Won && <Trophy size={12} className="text-gold shrink-0 ml-1" />}
                        </div>
                      </div>
                      {(m.score || isLive || isCompleted || outcome.state === "cancelled") && (
                        <div className="px-3 py-2 bg-background/30 border-t border-border/50 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                          {isLive ? (
                            <span className="text-warning animate-pulse flex items-center gap-1"><Play size={10} /> Live Match</span>
                          ) : (
                            <span className="text-muted-foreground">{outcome.statusLabel}{m.score ? ` · ${m.score}` : ""}</span>
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
          ref={normalContainerRef}
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
              position: "relative"
            }}
          >
            {/* Round labels */}
            <div className="flex absolute top-0 left-0" style={{ paddingLeft: PADDING, paddingTop: PADDING / 2 }}>
              {roundData.map(({ ri, label, round }) => (
                <div key={ri} style={{ width: COL_W, flexShrink: 0 }}
                  className="text-[10px] font-black uppercase tracking-widest text-center text-info flex items-center justify-center gap-1 group">
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
                // Shared status rules (WP6): walkovers are decided, live never shows a winner.
                const outcome = matchOutcome(m);
                const isCompleted = outcome.decided;
                const isLive = outcome.state === "live";
                const t1 = m.team1_label ?? "TBD";
                const t2 = m.team2_label ?? "TBD";
                const [s1, s2] = sideSeeds(m, seeds);
                const t1Won = outcome.t1Won;
                const t2Won = outcome.t2Won;
                
                const isMatchOnPath = pathSet.has(m.id);
                const opacity = enablePathHighlight && selectedPlayer && !isMatchOnPath ? 0.3 : 1;
                
                const sets = outcome.games.length ? outcome.games.map((g) => ({ t1: g.side1, t2: g.side2 })) : null;

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
                    <div className={cn("flex flex-col border rounded overflow-hidden", isMatchOnPath ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10' : 'border-border-strong/80 shadow-md', CAT_BOX_COLORS_DARK[category || ""] || "bg-card")}>
                      {/* Match header */}
                      <div className={`flex justify-between items-center px-2 py-1 text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'bg-muted/80 text-muted-foreground' : isLive ? 'bg-warning/20 text-warning' : 'bg-muted/50 text-muted-foreground'}`}>
                        <span>{m.match_code}</span>
                        <span className="flex items-center gap-1">
                          {isCompleted || outcome.state === "cancelled" ? (
                            <span className="text-muted-foreground">{outcome.statusLabel}</span>
                          ) : (
                            isLive ? (
                              <span className="flex items-center gap-1 text-warning font-bold">
                                Live
                                {m.court_number && (
                                  <span className={cn("font-black px-1.5 py-0.5 rounded-md text-[8px] bg-muted/80 border border-border-strong/50 shadow-sm", getCourtColor(m.court_number))}>
                                    {String(m.court_number).toUpperCase().startsWith('C') ? String(m.court_number).toUpperCase() : `C${m.court_number}`}
                                  </span>
                                )}
                              </span>
                            ) : (m as any).scheduled_at ? (
                              <span className="flex items-center gap-1 text-[9px]">
                                {m.court_number && (
                                  <span className={cn("font-black px-1.5 py-0.5 rounded-md bg-muted/80 border border-border-strong/50 shadow-sm", getCourtColor(m.court_number))}>
                                    {String(m.court_number).toUpperCase().startsWith('C') ? String(m.court_number).toUpperCase() : `C${m.court_number}`}
                                  </span>
                                )}
                                <span className="text-foreground font-black tracking-wide drop-shadow-sm">
                                  {new Date((m as any).scheduled_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                  <span className="font-bold text-warning ml-1">
                                    {new Date((m as any).scheduled_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit" })}
                                  </span>
                                </span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-muted-foreground tracking-widest">TBD</span>
                            )
                          )}
                          {isLive && <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-live" />}
                        </span>
                      </div>
                      {/* Players + scores */}
                      <div className="flex">
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div
                            onClick={enablePathHighlight ? () => setSelectedPlayer(selectedPlayer === t1 ? null : t1) : undefined}
                            style={{ minHeight: playerRowH }}
                            className={`flex-1 flex items-center gap-1 px-2 border-b border-border-strong/50 ${t1Won ? "bg-gold/20" : ""} ${enablePathHighlight ? "cursor-pointer active:bg-muted-strong/50" : ""}`}
                          >
                            <span className={`flex-1 text-[11px] font-bold truncate leading-tight ${t1Won ? "text-gold" : "text-soft"}`}>{t1}</span>
                            <SeedTag seed={s1} />
                            {t1Won && <Trophy size={11} className="text-gold shrink-0" />}
                          </div>
                          <div
                            onClick={enablePathHighlight ? () => setSelectedPlayer(selectedPlayer === t2 ? null : t2) : undefined}
                            style={{ minHeight: playerRowH }}
                            className={`flex-1 flex items-center gap-1 px-2 ${t2Won ? "bg-gold/20" : ""} ${enablePathHighlight ? "cursor-pointer active:bg-muted-strong/50" : ""}`}
                          >
                            <span className={`flex-1 text-[11px] font-bold truncate leading-tight ${t2Won ? "text-gold" : "text-soft"}`}>{t2}</span>
                            <SeedTag seed={s2} />
                            {t2Won && <Trophy size={11} className="text-gold shrink-0" />}
                          </div>
                        </div>
                        {isCompleted && sets && (
                          <div className="flex shrink-0 border-l border-border-strong/50">
                            {sets.map((s, i) => (
                              <div key={i} className={`flex flex-col${i < sets.length - 1 ? " border-r border-border-strong/30" : ""}`} style={{ width: 22 }}>
                                <div style={{ minHeight: playerRowH }} className={`flex items-center justify-center text-[11px] font-mono font-bold border-b border-border-strong/50 ${t1Won ? "bg-gold/10" : ""} ${s.t1 > s.t2 ? "text-foreground" : "text-muted-foreground"}`}>
                                  {s.t1}
                                </div>
                                <div style={{ minHeight: playerRowH }} className={`flex items-center justify-center text-[11px] font-mono font-bold ${t2Won ? "bg-gold/10" : ""} ${s.t2 > s.t1 ? "text-foreground" : "text-muted-foreground"}`}>
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
      {enablePathHighlight && selectedPlayer && showRoadmap && (
        <RoadmapPanel
          player={selectedPlayer}
          matches={matches}
          isMobile={isMobile}
          onClose={() => setShowRoadmap(false)}
        />
      )}
    </div>
    </>
  );
}

interface MatchCardProps {
  match: BracketMatch;
  x: number;
  y: number;
  isHighlighted: boolean;
  enablePathHighlight: boolean;
  selectedPlayer: string | null;
  onHide: () => void;
  onPlayerClick?: (name: string) => void;
  playerRowH: number;
  category?: string;
  seeds?: PublishedSeeds | null;
}

function MatchCard({ match: m, x, y, isHighlighted, enablePathHighlight, selectedPlayer, onHide, onPlayerClick, playerRowH, category, seeds }: MatchCardProps) {
  // Shared status rules (WP6): walkovers are decided, live never shows a winner.
  const outcome = matchOutcome(m);
  const isCompleted = outcome.decided;
  const isLive = outcome.state === "live";
  const t1 = m.team1_label ?? "TBD";
  const t2 = m.team2_label ?? "TBD";
  const [s1, s2] = sideSeeds(m, seeds);
  const t1Won = outcome.t1Won;
  const t2Won = outcome.t2Won;
  
  const isT1Selected = selectedPlayer && t1.trim().toLowerCase() === selectedPlayer.trim().toLowerCase();
  const isT2Selected = selectedPlayer && t2.trim().toLowerCase() === selectedPlayer.trim().toLowerCase();
  
  const opacity = enablePathHighlight && selectedPlayer && !isHighlighted ? 0.3 : 1;
  
  const sets = outcome.games.length ? outcome.games.map((g) => ({ t1: g.side1, t2: g.side2 })) : null;

  return (
    <div
      className={`absolute flex flex-col justify-center transition-opacity duration-300 ${isHighlighted ? 'z-10' : 'z-0'}`}
      style={{
        left: x,
        top: y,
        width: MATCH_W,
        height: MATCH_H,
        opacity
      }}
    >
      <div className={cn("flex flex-col border rounded overflow-hidden", 
        CAT_BOX_COLORS_DARK[category || ""] || "bg-card border-border",
        isHighlighted ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10' : 'shadow-md'
      )}>
        {/* Match header */}
        <div className={`flex justify-between items-center px-2 py-1 text-[9px] font-black uppercase 
tracking-widest ${isCompleted ? 'bg-muted/80 text-muted-foreground' : isLive ? 'bg-warning/20 text-warning' : 
'bg-muted/50 text-muted-foreground'}`}>
          <span>{m.match_code}</span>
          <span className="flex items-center gap-1">
            {isCompleted || outcome.state === "cancelled" ? (
              <span className="text-muted-foreground">{outcome.statusLabel}</span>
            ) : (
              isLive ? (
                <span className="flex items-center gap-1 text-warning font-bold">
                  Live
                  {m.court_number && (
                    <span className={cn("font-black px-1.5 py-0.5 rounded-md text-[8px] bg-muted/80 border border-border-strong/50 shadow-sm", getCourtColor(m.court_number))}>
                      {String(m.court_number).toUpperCase().startsWith('C') ? String(m.court_number).toUpperCase() : `C${m.court_number}`}
                    </span>
                  )}
                </span>
              ) : (m as any).scheduled_at ? (
                <span className="flex items-center gap-1 text-[9px]">
                  {m.court_number && (
                    <span className={cn("font-black px-1.5 py-0.5 rounded-md bg-muted/80 border border-border-strong/50 shadow-sm", getCourtColor(m.court_number))}>
                      {String(m.court_number).toUpperCase().startsWith('C') ? String(m.court_number).toUpperCase() : `C${m.court_number}`}
                    </span>
                  )}
                  <span className="text-foreground font-black tracking-wide drop-shadow-sm">
                    {new Date((m as any).scheduled_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    <span className="font-bold text-warning ml-1">
                      {new Date((m as any).scheduled_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="text-[10px] font-black text-muted-foreground tracking-widest">TBD</span>
              )
            )}
            {isLive && <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-live" />}
          </span>
        </div>
        {/* Players + scores */}
        <div className="flex">
          <div className="flex-1 min-w-0 flex flex-col">
            <div
              onClick={onPlayerClick ? () => onPlayerClick(t1) : undefined}
              style={{ minHeight: playerRowH }}
              className={`flex-1 flex items-center gap-1 px-2 border-b border-border-strong/50 ${
                isT1Selected 
                  ? "bg-primary/40 animate-pulse shadow-[inset_0_0_10px_color-mix(in_srgb,var(--primary)_50%,transparent)]" 
                  : t1Won ? "bg-gold/20" : ""
              } ${onPlayerClick ? "cursor-pointer active:bg-muted-strong/50" : ""}`}
            >
              <span className={`flex-1 text-[11px] font-bold truncate leading-tight ${
                isT1Selected ? "text-foreground drop-shadow-md" : t1Won ? "text-gold" : "text-soft"
              }`}>{t1}</span>
              <SeedTag seed={s1} />
              {t1Won && <Trophy size={11} className="text-gold shrink-0" />}
            </div>
            <div
              onClick={onPlayerClick ? () => onPlayerClick(t2) : undefined}
              style={{ minHeight: playerRowH }}
              className={`flex-1 flex items-center gap-1 px-2 ${
                isT2Selected 
                  ? "bg-primary/40 animate-pulse shadow-[inset_0_0_10px_color-mix(in_srgb,var(--primary)_50%,transparent)]" 
                  : t2Won ? "bg-gold/20" : ""
              } ${onPlayerClick ? "cursor-pointer active:bg-muted-strong/50" : ""}`}
            >
              <span className={`flex-1 text-[11px] font-bold truncate leading-tight ${
                isT2Selected ? "text-foreground drop-shadow-md" : t2Won ? "text-gold" : "text-soft"
              }`}>{t2}</span>
              <SeedTag seed={s2} />
              {t2Won && <Trophy size={11} className="text-gold shrink-0" />}
            </div>
          </div>
          {isCompleted && sets && (
            <div className="flex shrink-0 border-l border-border-strong/50">
              {sets.map((s, i) => (
                <div key={i} className={`flex flex-col${i < sets.length - 1 ? " border-r border-border-strong/30" : ""}`} style={{ width: 22 }}>
                  <div style={{ minHeight: playerRowH }} className={`flex items-center justify-center text-[11px] font-mono font-bold border-b border-border-strong/50 ${t1Won ? "bg-gold/10" : ""} ${s.t1 > s.t2 ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.t1}
                  </div>
                  <div style={{ minHeight: playerRowH }} className={`flex items-center justify-center text-[11px] font-mono font-bold ${t2Won ? "bg-gold/10" : ""} ${s.t2 > s.t1 ? "text-foreground" : "text-muted-foreground"}`}>
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
}
