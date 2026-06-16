import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Trophy, Activity, Plus, Minus, X, Settings, Save, Timer,
  AlertTriangle, BookOpen, ArrowLeftRight, Flag, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { isAdminEmail } from "@/lib/admin";
import { Capacitor } from "@capacitor/core";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
  gender?: string;
  user_id?: string;
}

export type PointLogEntry = {
  gameNum: number;
  team: 1 | 2 | "let" | "fault";
  t1Score: number;
  t2Score: number;
  serverTeam: 1 | 2;
  note?: string;
  ts: number;
};

export type BwfMatchState = {
  id: string;
  umpireName: string;
  isFriendly: boolean;
  matchNumber?: string;
  category: string;
  inferredCategory?: string;
  customCategory?: string;
  dbId?: string;
  pointsToWin: number;
  bestOfSets: number;
  goldenPoint: number;
  t1: { p1Id: string; p1Name: string; p2Id?: string; p2Name?: string; score: number; games: number };
  t2: { p1Id: string; p1Name: string; p2Id?: string; p2Name?: string; score: number; games: number };
  serverTeam: 1 | 2;
  serverPlayerIndex: 0 | 1;
  receiverPlayerIndex: 0 | 1;
  receiverP0AtTop: boolean;
  t1LastServedBy: 0 | 1;
  t2LastServedBy: 0 | 1;
  endsSwapped: boolean;
  pointLog: PointLogEntry[];
  status: "setup" | "playing" | "finished";
  winner?: 1 | 2;
  retiredTeam?: 1 | 2;
  setsHistory: string[];
};

type CardType = "yellow" | "red" | "black";
type CardTarget = "t1p1" | "t1p2" | "t2p1" | "t2p2";

// ── Court Visual ──────────────────────────────────────────────────────────────

function CourtVisual({
  serverTeam,
  serverPlayerIndex = 0,
  receiverP0AtTop = true,
  t1Name,
  t2Name,
  t1P2Name,
  t2P2Name,
  t1Score,
  t2Score,
  isDoubles,
  endsSwapped = false,
  onSwitchServer,
}: {
  serverTeam: 1 | 2;
  serverPlayerIndex?: 0 | 1;
  receiverP0AtTop?: boolean;
  t1Name: string;
  t2Name: string;
  t1P2Name?: string;
  t2P2Name?: string;
  t1Score: number;
  t2Score: number;
  isDoubles: boolean;
  endsSwapped?: boolean;
  onSwitchServer?: () => void;
}) {
  const t1OnLeft = !endsSwapped;
  const serverScore = serverTeam === 1 ? t1Score : t2Score;
  const isEven = serverScore % 2 === 0;
  // Physical side the server is on
  const serverOnLeft = (serverTeam === 1 && t1OnLeft) || (serverTeam === 2 && !t1OnLeft);
  // Service court cy: on left, right-court = bottom (94), left = top (34); mirrored on right
  const serverCy = serverOnLeft ? (isEven ? "94" : "34") : (isEven ? "34" : "94");
  const shuttleCx = serverOnLeft ? "52" : "156";

  const leftP1Name  = t1OnLeft ? t1Name   : t2Name;
  const leftP2Name  = t1OnLeft ? t1P2Name : t2P2Name;
  const rightP1Name = t1OnLeft ? t2Name   : t1Name;
  const rightP2Name = t1OnLeft ? t2P2Name : t1P2Name;

  const leftTeam  = t1OnLeft ? 1 : 2;
  const rightTeam = t1OnLeft ? 2 : 1;
  const leftIsServer  = serverTeam === leftTeam;

  // Active receiver: whoever is in the diagonal service court to the server.
  // diagonalAtTop = true when the diagonal falls in the visual-top of the receiving side.
  // Formula: server-on-left+even → bottom-left server → diagonal at top-right (diagonalAtTop=true)
  //          server-on-left+odd  → top-left server  → diagonal at bottom-right (false)
  //          server-on-right+even→ top-right server → diagonal at bottom-left (false)
  //          server-on-right+odd → bottom-right     → diagonal at top-left (true)
  const diagonalAtTop = serverOnLeft === isEven;
  // activeReceiverIndex: P0 if P0 is at the diagonal position, else P1
  const activeReceiverIndex: 0 | 1 = (diagonalAtTop === receiverP0AtTop) ? 0 : 1;

  const nameColor = (side: "left" | "right", pIdx: 0 | 1) => {
    const sideIsServer = side === "left" ? leftIsServer : !leftIsServer;
    if (sideIsServer && serverPlayerIndex === pIdx) return "text-emerald-400";
    if (!sideIsServer && (!isDoubles || pIdx === activeReceiverIndex)) return "text-amber-400/80";
    return "text-slate-500";
  };

  const topPct = (side: "left" | "right", pIdx: 0 | 1) => {
    const sideIsServer = side === "left" ? leftIsServer : !leftIsServer;
    const onLeft = side === "left";
    
    if (!isDoubles) {
      // In singles, BOTH players always stand in the court corresponding to the score parity
      return onLeft ? (isEven ? "63%" : "12%") : (isEven ? "12%" : "63%");
    }

    if (sideIsServer) {
      // Server position follows score parity (BWF rule)
      const serving = serverPlayerIndex === pIdx;
      if (serving) return onLeft ? (isEven ? "63%" : "12%") : (isEven ? "12%" : "63%");
      return onLeft ? (isEven ? "12%" : "63%") : (isEven ? "63%" : "12%");
    } else {
      // Receiver positions are FIXED once chosen — only the active-receiver label changes
      return pIdx === 0 ? (receiverP0AtTop ? "12%" : "63%") : (receiverP0AtTop ? "63%" : "12%");
    }
  };

  return (
    <div className="relative w-52 h-32 select-none" title="Court — tap server name to switch">
      <svg viewBox="0 0 208 128" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="200" height="120" rx="2" stroke="#334155" strokeWidth="2" fill="#0f172a" />
        <line x1="104" y1="4" x2="104" y2="124" stroke="#64748b" strokeWidth="2" strokeDasharray="4 3" />
        <line x1="4" y1="64" x2="104" y2="64" stroke="#1e3a5f" strokeWidth="1" />
        <line x1="104" y1="64" x2="204" y2="64" stroke="#1e3a5f" strokeWidth="1" />
        {isDoubles && (
          <>
            <line x1="4" y1="18" x2="204" y2="18" stroke="#1e293b" strokeWidth="1" />
            <line x1="4" y1="110" x2="204" y2="110" stroke="#1e293b" strokeWidth="1" />
          </>
        )}
        {serverOnLeft
          ? <rect x="5" y="5" width="98" height="118" rx="1" fill="#10b981" fillOpacity="0.12" />
          : <rect x="105" y="5" width="98" height="118" rx="1" fill="#10b981" fillOpacity="0.12" />
        }
        <circle cx={shuttleCx} cy={serverCy} r="6" fill="#10b981" opacity="0.9" />
      </svg>

      {/* Player name overlays */}
      <div className="absolute inset-0 flex items-stretch justify-between px-3 py-1.5 pointer-events-none">
        {/* Left side */}
        <div className="relative flex flex-col h-full w-[44%]">
          <div
            className={`absolute w-full truncate text-[9px] font-black uppercase ${nameColor("left", 0)} ${leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
            style={{ top: topPct("left", 0) }}
            onClick={leftIsServer ? onSwitchServer : undefined}
          >
            {leftP1Name || "T1"}
            {leftIsServer && serverPlayerIndex === 0 && <span className="block text-[7px] text-emerald-500">SERVER</span>}
            {!leftIsServer && (!isDoubles || activeReceiverIndex === 0) && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
          </div>
          {isDoubles && leftP2Name && (
            <div
              className={`absolute w-full truncate text-[9px] font-black uppercase ${nameColor("left", 1)} ${leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
              style={{ top: topPct("left", 1) }}
              onClick={leftIsServer ? onSwitchServer : undefined}
            >
              {leftP2Name}
              {leftIsServer && serverPlayerIndex === 1 && <span className="block text-[7px] text-emerald-500">SERVER</span>}
              {!leftIsServer && activeReceiverIndex === 1 && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
            </div>
          )}
        </div>
        {/* Right side */}
        <div className="relative flex flex-col h-full w-[44%] text-right items-end">
          <div
            className={`absolute w-full truncate text-[9px] font-black uppercase ${nameColor("right", 0)} ${!leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
            style={{ top: topPct("right", 0) }}
            onClick={!leftIsServer ? onSwitchServer : undefined}
          >
            {rightP1Name || "T2"}
            {!leftIsServer && serverPlayerIndex === 0 && <span className="block text-[7px] text-emerald-500">SERVER</span>}
            {leftIsServer && (!isDoubles || activeReceiverIndex === 0) && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
          </div>
          {isDoubles && rightP2Name && (
            <div
              className={`absolute w-full truncate text-[9px] font-black uppercase ${nameColor("right", 1)} ${!leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
              style={{ top: topPct("right", 1) }}
              onClick={!leftIsServer ? onSwitchServer : undefined}
            >
              {rightP2Name}
              {!leftIsServer && serverPlayerIndex === 1 && <span className="block text-[7px] text-emerald-500">SERVER</span>}
              {leftIsServer && activeReceiverIndex === 1 && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-slate-600 font-bold uppercase tracking-widest pointer-events-none">NET</div>
    </div>
  );
}

// ── Player Select ─────────────────────────────────────────────────────────────

function PlayerSelect({
  value,
  onChange,
  players,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  players: Player[];
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const p = players.find((p) => p.id === value);
      setSearch(p ? p.full_name : value);
    } else {
      setSearch("");
    }
  }, [value, players]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
        if (value) {
          const p = players.find((p) => p.id === value);
          setSearch(p ? p.full_name : value);
        } else setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, players]);

  const filtered = players.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setActiveIndex(-1);
  }, [search]);

  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        const selected = filtered[activeIndex];
        onChange(selected.id);
        setSearch(selected.full_name);
        setIsOpen(false);
      } else if (search.length > 0 && filtered.length === 0) {
        onChange(search);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder ?? "Search or type name..."}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setIsOpen(true); onChange(e.target.value); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full text-sm font-bold bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder:text-slate-500"
      />
      {isOpen && search.length > 0 && (
        <div ref={listboxRef} className="absolute z-60 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div
              className={`p-3 text-sm font-bold cursor-pointer text-emerald-400 ${activeIndex === 0 ? "bg-emerald-900/50" : "hover:bg-emerald-900/30"}`}
              onClick={() => { onChange(search); setIsOpen(false); }}
            >
              Use "{search}" as Guest
            </div>
          ) : (
            filtered.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => { onChange(p.id); setSearch(p.full_name); setIsOpen(false); }}
                className={`p-3 text-sm font-bold cursor-pointer transition-colors ${activeIndex === idx ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-emerald-900/30 text-slate-200"}`}
              >
                {p.full_name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── UmpireEngine ──────────────────────────────────────────────────────────────

export function UmpireEngine({
  userId,
  userEmail,
  userName,
  isTournamentUmpire = false,
  onClose,
  initialMatchState,
}: {
  userId: string;
  userEmail: string;
  userName: string;
  isTournamentUmpire?: boolean;
  onClose: () => void;
  initialMatchState?: any;
}) {
  const isAdmin = isAdminEmail(userEmail);
  const canRunTournament = isAdmin || isTournamentUmpire;

  const [players, setPlayers] = useState<Player[]>([]);
  const [match, setMatch] = useState<BwfMatchState>(() => {
    if (initialMatchState?.is_edit_mode) {
      const isP1Winner = initialMatchState.winner_id === initialMatchState.player1_id;
      // parse setsHistory carefully to handle possible retired strings
      const rawScore = initialMatchState.match_score || "";
      // Match score format: "21-13, 21-12 [Names]" or "21-13 (T1 Retired)"
      // Let's extract just the sets part
      const setsPartMatch = rawScore.match(/^([\d-]+(?:, [\d-]+)*)/);
      const setsHistory = setsPartMatch ? setsPartMatch[1].split(", ") : [];

      return {
        id: userId,
        dbId: initialMatchState.id,
        umpireName: userName,
        isFriendly: initialMatchState.is_friendly,
        matchNumber: initialMatchState.round,
        category: initialMatchState.category,
        pointsToWin: initialMatchState.points_to_win || 21,
        bestOfSets: initialMatchState.best_of_sets || 3,
        goldenPoint: 30,
        t1: { p1Id: initialMatchState.player1_id, p1Name: initialMatchState.player1?.full_name || "", p2Id: initialMatchState.team1_partner_id, p2Name: initialMatchState.partner1?.full_name || "", score: 0, games: isP1Winner ? 2 : 0 },
        t2: { p1Id: initialMatchState.player2_id, p1Name: initialMatchState.player2?.full_name || "", p2Id: initialMatchState.team2_partner_id, p2Name: initialMatchState.partner2?.full_name || "", score: 0, games: !isP1Winner ? 2 : 0 },
        serverTeam: 1,
        serverPlayerIndex: 0,
        receiverPlayerIndex: 0,
        receiverP0AtTop: true,
        t1LastServedBy: 1,
        t2LastServedBy: 1,
        endsSwapped: false,
        pointLog: [],
        status: "finished",
        winner: isP1Winner ? 1 : 2,
        setsHistory: setsHistory,
      } as BwfMatchState;
    }
    return {
      id: userId,
      umpireName: userName,
      isFriendly: true,
      matchNumber: "",
      category: "Singles",
      pointsToWin: 21,
      bestOfSets: 3,
      goldenPoint: 30,
      t1: { p1Id: "", p1Name: "", score: 0, games: 0 },
      t2: { p1Id: "", p1Name: "", score: 0, games: 0 },
      serverTeam: 1,
      serverPlayerIndex: 0,
      receiverPlayerIndex: 0,
      receiverP0AtTop: true,
      t1LastServedBy: 1,
      t2LastServedBy: 1,
      endsSwapped: false,
      pointLog: [],
      status: "setup",
      setsHistory: [],
    };
  });

  // Discipline cards: per player slot, array of card types issued
  const [cards, setCards] = useState<Record<CardTarget, CardType[]>>({
    t1p1: [], t1p2: [], t2p1: [], t2p2: [],
  });

  // Overlay / modal flags
  const [showLog, setShowLog] = useState(false);
  const [showChangeEnds, setShowChangeEnds] = useState(false);
  const [changeEndsReason, setChangeEndsReason] = useState("");
  const [pendingBreakAfterEnds, setPendingBreakAfterEnds] = useState<number | null>(null);

  const [showCardPanel, setShowCardPanel] = useState(false);
  const [cardTarget, setCardTarget] = useState<CardTarget | null>(null);

  const [showRetireModal, setShowRetireModal] = useState(false);
  const [isEditSetupOpen, setIsEditSetupOpen] = useState(false);

  const [isDirectScoreOpen, setIsDirectScoreOpen] = useState(false);
  const [directSetsText, setDirectSetsText] = useState("");
  const [directWinner, setDirectWinner] = useState<1 | 2 | null>(null);

  // Break timer
  const [breakSecondsLeft, setBreakSecondsLeft] = useState<number | null>(null);
  const [breakLabel, setBreakLabel] = useState("");
  const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startBreak = (seconds: number, label = "") => {
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
    setBreakLabel(label);
    setBreakSecondsLeft(seconds);
    breakIntervalRef.current = setInterval(() => {
      setBreakSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(breakIntervalRef.current!);
          breakIntervalRef.current = null;
          
          // Play beep and vibrate
          try {
            if (typeof window !== "undefined") {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContext) {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                osc.type = "sine";
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
              }
              if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) {
                import("@capacitor/haptics").then(({ Haptics }) => Haptics.vibrate({ duration: 500 }));
              } else if (navigator.vibrate) {
                navigator.vibrate(500);
              }
            }
          } catch(e) {}
          
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };


  const endBreak = () => {
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
    breakIntervalRef.current = null;
    setBreakSecondsLeft(null);
    setBreakLabel("");
  };

  useEffect(() => () => { if (breakIntervalRef.current) clearInterval(breakIntervalRef.current); }, []);

  useEffect(() => {
    supabase
      .from("players")
      .select("id, full_name, avatar_url, gender, user_id")
      .is("deleted_at", null)
      .then(({ data }) => { if (data) setPlayers(data); });
  }, []);

  const getInferredCategory = (cat: string, t1: BwfMatchState["t1"], t2: BwfMatchState["t2"]): string => {
    if (match?.customCategory) return match.customCategory;
    if (!["Singles", "Doubles", "Hybrid"].includes(cat)) return cat;
    const t1p1 = players.find(p => p.id === t1.p1Id);
    const t1p2 = t1.p2Id ? players.find(p => p.id === t1.p2Id) : undefined;
    const t2p1 = players.find(p => p.id === t2.p1Id);
    const t2p2 = t2.p2Id ? players.find(p => p.id === t2.p2Id) : undefined;
    const getComp = (p1?: Player, p2?: Player) => {
      const g1 = p1?.gender === "Female" ? "F" : (p1?.gender === "Male" ? "M" : "U");
      if (!p2) return g1;
      const g2 = p2?.gender === "Female" ? "F" : (p2?.gender === "Male" ? "M" : "U");
      if (g1 === "U" || g2 === "U") return "UU";
      if (g1 === "M" && g2 === "M") return "MM";
      if (g1 === "F" && g2 === "F") return "FF";
      return "MF";
    };
    const c1 = getComp(t1p1, t1p2);
    const c2 = getComp(t2p1, t2p2);
    const formatComp = (c: string, isSingles: boolean) => {
      if (isSingles) {
        if (c === "M") return "Men's Singles";
        if (c === "F") return "Women's Singles";
        return "Singles";
      } else {
        if (c === "MM") return "Men's Doubles";
        if (c === "FF") return "Women's Doubles";
        if (c === "MF") return "Mixed Doubles";
        return "Doubles";
      }
    };
    if (cat === "Singles") {
      if (c1 === c2 && c1 !== "U") return formatComp(c1, true);
      if (c1 !== c2 && c1 !== "U" && c2 !== "U") return `${formatComp(c1, true)} vs ${formatComp(c2, true)}`;
      return "Singles";
    }
    if (cat === "Doubles") {
      if (c1 === c2 && c1 !== "UU") return formatComp(c1, false);
      if (c1 !== c2 && c1 !== "UU" && c2 !== "UU") return `${formatComp(c1, false)} vs ${formatComp(c2, false)}`;
      return "Doubles";
    }
    if (cat === "Hybrid") {
      const n1 = t1p2 ? formatComp(c1, false) : formatComp(c1, true);
      const n2 = t2p2 ? formatComp(c2, false) : formatComp(c2, true);
      return `${n1} vs ${n2}`;
    }
    return cat;
  };

  const updateMatch = async (updates: Partial<BwfMatchState>) => {
    const next = { ...match, ...updates };
    next.inferredCategory = getInferredCategory(next.category, next.t1, next.t2);
    setMatch(next);
    const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").single();
    const liveMatches = data?.value || {};
    liveMatches[userId] = next;
    await supabase.from("site_data").upsert({ key: "live_matches", value: liveMatches });
  };

  const getName = (idOrName: string) =>
    players.find((p) => p.id === idOrName)?.full_name || idOrName;

  const getGender = (idOrName: string) =>
    players.find((p) => p.id === idOrName)?.gender?.toLowerCase() || "unknown";

  const deduceCategory = () => {
    const t1HasP2 = !!match.t1.p2Id;
    const t2HasP2 = !!match.t2.p2Id;
    if (!t1HasP2 && !t2HasP2) {
      const g1 = getGender(match.t1.p1Id), g2 = getGender(match.t2.p1Id);
      if (g1 === "male" && g2 === "male") return "MS";
      if (g1 === "female" && g2 === "female") return "WS";
      return "Singles";
    } else if (t1HasP2 && t2HasP2) {
      const gs = [match.t1.p1Id, match.t1.p2Id!, match.t2.p1Id, match.t2.p2Id!].map(getGender);
      if (gs.every(g => g === "male")) return "MD";
      if (gs.every(g => g === "female")) return "WD";
      const t1Mixed = (gs[0] === "male") !== (gs[1] === "male");
      const t2Mixed = (gs[2] === "male") !== (gs[3] === "male");
      if (t1Mixed && t2Mixed) return "XD";
      return "Doubles";
    }
    return "Hybrid";
  };

  // ── Start Match ─────────────────────────────────────────────────────────────

  const startMatch = async () => {
    if (!match.t1.p1Id || !match.t2.p1Id) {
      toast.error("Please fill in Player 1 for both teams");
      return;
    }
    if (match.isFriendly && !isAdmin) {
      const { data: ump } = await supabase.from("players").select("buddies").eq("user_id", userId).maybeSingle();
      const buddies: string[] = ump?.buddies || [];
      const ids = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id].filter(Boolean) as string[];
      if (!ids.some(id => buddies.includes(id))) {
        toast.error("You must be a buddy of at least one player to umpire a friendly match.");
        return;
      }
    }
    const cat = deduceCategory();
    if (cat === "Hybrid") {
      toast.error("Invalid format: Singles vs Doubles matches are not allowed.");
      return;
    }
    // Compute fixed initial receiver position from setup choice.
    // Score 0 (even), server on left when serverTeam=1 (endsSwapped=false at start).
    // Server at bottom-left (even+left) → diagonal at top-right → if receiverPlayerIndex=0, P0 at top.
    // For serverTeam=2: server on right, even → server at top-right → diagonal at bottom-left.
    const initServerOnLeft = match.serverTeam === 1;
    const initIsEven = true; // score always 0 at start
    const initDiagonalAtTop = initServerOnLeft === initIsEven; // true if serverTeam=1
    const initReceiverP0AtTop = (initDiagonalAtTop === (match.receiverPlayerIndex === 0));
    await updateMatch({
      status: "playing",
      category: cat,
      receiverP0AtTop: initReceiverP0AtTop,
      t1: { ...match.t1, p1Name: getName(match.t1.p1Id), p2Name: match.t1.p2Id ? getName(match.t1.p2Id) : undefined },
      t2: { ...match.t2, p1Name: getName(match.t2.p1Id), p2Name: match.t2.p2Id ? getName(match.t2.p2Id) : undefined },
    });
    toast.success("Match Broadcast Started!");
  };

  // ── Add Point ───────────────────────────────────────────────────────────────

  const handleEditSet = (index: number, newT1Str: string, newT2Str: string) => {
    const newSetsHistory = [...match.setsHistory];
    newSetsHistory[index] = `${newT1Str}-${newT2Str}`;
    
    let t1Games = 0;
    let t2Games = 0;
    newSetsHistory.forEach(s => {
      const [s1, s2] = s.split("-").map(Number);
      if (!isNaN(s1) && !isNaN(s2)) {
         if (s1 > s2) t1Games++;
         else if (s2 > s1) t2Games++;
      }
    });

    let nextWinner = match.winner;
    if (match.status === "finished" || nextWinner) {
      if (t1Games > t2Games) nextWinner = 1;
      else if (t2Games > t1Games) nextWinner = 2;
      else nextWinner = undefined;
    }

    updateMatch({ 
      setsHistory: newSetsHistory, 
      t1: { ...match.t1, games: t1Games }, 
      t2: { ...match.t2, games: t2Games },
      ...(nextWinner !== match.winner ? { winner: nextWinner } : {})
    });
  };

  const forceEndSet = () => {
    if (match.status !== "playing") return;
    if (match.t1.score === 0 && match.t2.score === 0) return;
    
    let t1Won = match.t1.score > match.t2.score;
    let t2Won = match.t2.score > match.t1.score;
    
    if (match.t1.score === match.t2.score) {
      toast.error("Scores are tied! Cannot end set.");
      return;
    }
    
    let { t1, t2, setsHistory, bestOfSets } = match;
    let newT1 = { ...t1 };
    let newT2 = { ...t2 };
    
    setsHistory = [...setsHistory, `${newT1.score}-${newT2.score}`];
    if (t1Won) newT1.games++;
    if (t2Won) newT2.games++;
    newT1.score = 0;
    newT2.score = 0;
    
    const gamesToWin = Math.ceil(bestOfSets / 2);
    let nextStatus: "setup" | "playing" | "finished" = match.status;
    let nextWinner = match.winner;
    
    if (newT1.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 1; }
    else if (newT2.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 2; }
    
    updateMatch({
      setsHistory,
      t1: newT1,
      t2: newT2,
      status: nextStatus as any,
      winner: nextWinner,
      serverTeam: t1Won ? 1 : 2,
      serverPlayerIndex: 0,
      t1LastServedBy: 1,
      t2LastServedBy: 0,
    });
    
    toast.success("Set ended!");
  };

  const addPoint = (team: 1 | 2, note?: string) => {
    if (match.status !== "playing") return;
    let { t1, t2, serverTeam, serverPlayerIndex, receiverPlayerIndex, receiverP0AtTop,
          t1LastServedBy, t2LastServedBy,
          setsHistory, pointsToWin, goldenPoint, bestOfSets, endsSwapped, pointLog } = match;
    let newT1 = { ...t1 };
    let newT2 = { ...t2 };
    const isT1Doubles = !!newT1.p2Id, isT2Doubles = !!newT2.p2Id;

    // ── BWF service rotation ─────────────────────────────────────────────────
    if (team === 1) {
      newT1.score++;
      if (serverTeam === 1) {
        // Same server continues — receiver positions stay exactly where they are
        t1LastServedBy = serverPlayerIndex;
      } else {
        // Service changes to T1 — receivers (T2) choose new positions
        serverTeam = 1;
        serverPlayerIndex = isT1Doubles ? (t1LastServedBy === 0 ? 1 : 0) : 0;
        t1LastServedBy = serverPlayerIndex;
        // Keep T2 players in their current physical positions
        const oldT2Score = t2.score;
        const p0WasServer = t2LastServedBy === 0;
        const isEven = oldT2Score % 2 === 0;
        receiverP0AtTop = p0WasServer ? isEven : !isEven;
      }
    } else {
      newT2.score++;
      if (serverTeam === 2) {
        // Same server continues — receiver positions stay exactly where they are
        t2LastServedBy = serverPlayerIndex;
      } else {
        // Service changes to T2 — receivers (T1) choose new positions
        serverTeam = 2;
        serverPlayerIndex = isT2Doubles ? (t2LastServedBy === 0 ? 1 : 0) : 0;
        t2LastServedBy = serverPlayerIndex;
        // Keep T1 players in their current physical positions
        const oldT1Score = t1.score;
        const p0WasServer = t1LastServedBy === 0;
        const isEven = oldT1Score % 2 === 0;
        receiverP0AtTop = p0WasServer ? !isEven : isEven;
      }
    }

    // ── Log entry ───────────────────────────────────────────────────────────
    const currentGame = newT1.games + newT2.games + 1;
    const newLog: PointLogEntry = {
      gameNum: currentGame,
      team,
      t1Score: newT1.score,
      t2Score: newT2.score,
      serverTeam,
      ...(note ? { note } : {}),
      ts: Date.now(),
    };
    pointLog = [...pointLog, newLog];

    // ── Check 11 in deciding game (interval + change ends) ──────────────────
    const isDeciding = currentGame === bestOfSets;
    const justHit11 =
      isDeciding &&
      !pointLog.slice(0, -1).some(e => e.gameNum === currentGame && (e.t1Score + e.t2Score) >= 11) &&
      (newT1.score + newT2.score) === 11;

    // ── Check game won ───────────────────────────────────────────────────────
    let t1WonGame = false, t2WonGame = false;
    if (newT1.score >= pointsToWin && (newT1.score - newT2.score >= 2 || newT1.score === goldenPoint)) t1WonGame = true;
    else if (newT2.score >= pointsToWin && (newT2.score - newT1.score >= 2 || newT2.score === goldenPoint)) t2WonGame = true;

    let nextStatus: "setup" | "playing" | "finished" = match.status;
    let nextWinner: 1 | 2 | undefined = match.winner;

    if (t1WonGame || t2WonGame) {
      setsHistory = [...setsHistory, `${newT1.score}-${newT2.score}`];
      if (t1WonGame) newT1.games++;
      if (t2WonGame) newT2.games++;
      newT1.score = 0;
      newT2.score = 0;
      const gamesToWin = Math.ceil(bestOfSets / 2);
      if (newT1.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 1; }
      else if (newT2.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 2; }
      else {
        serverTeam = t1WonGame ? 1 : 2;
        serverPlayerIndex = 0;
        // Reset for new game
        t1LastServedBy = 1;
        t2LastServedBy = 0;
        receiverP0AtTop = true;
        // Flip ends between games
        endsSwapped = !endsSwapped;
        const gamesPlayed = newT1.games + newT2.games;
        const breakSecs = gamesPlayed === 1 ? 90 : 120;
        const reason = `End of Game ${gamesPlayed} — Change Ends`;
        setPendingBreakAfterEnds(breakSecs);
        setChangeEndsReason(reason);
        setShowChangeEnds(true);
      }
    } else if (justHit11) {
      // Interval at 11 in deciding game + change ends
      endsSwapped = !endsSwapped;
      setPendingBreakAfterEnds(60);
      setChangeEndsReason("Deciding Game — 11 pts Interval (Change Ends)");
      setShowChangeEnds(true);
    }

    updateMatch({
      t1: newT1, t2: newT2,
      serverTeam, serverPlayerIndex, receiverPlayerIndex, receiverP0AtTop,
      t1LastServedBy, t2LastServedBy,
      endsSwapped, pointLog: pointLog,
      setsHistory, status: nextStatus, winner: nextWinner,
    });
  };

  const deductPoint = (team: 1 | 2) => {
    if (match.status !== "playing") return;
    const { t1, t2 } = match;
    if (team === 1 && t1.score > 0) {
      const trimmed = match.pointLog.slice(0, -1);
      updateMatch({ t1: { ...t1, score: t1.score - 1 }, pointLog: trimmed });
    }
    if (team === 2 && t2.score > 0) {
      const trimmed = match.pointLog.slice(0, -1);
      updateMatch({ t2: { ...t2, score: t2.score - 1 }, pointLog: trimmed });
    }
  };

  // ── Dismiss change ends overlay ─────────────────────────────────────────────
  const confirmChangeEnds = () => {
    setShowChangeEnds(false);
    if (pendingBreakAfterEnds !== null) {
      startBreak(pendingBreakAfterEnds, changeEndsReason);
      setPendingBreakAfterEnds(null);
    }
  };

  // ── Let call ───────────────────────────────────────────────────────────────
  const callLet = () => {
    const currentGame = match.t1.games + match.t2.games + 1;
    const newLog: PointLogEntry = {
      gameNum: currentGame,
      team: "let",
      t1Score: match.t1.score,
      t2Score: match.t2.score,
      serverTeam: match.serverTeam,
      note: "Let — Replay",
      ts: Date.now(),
    };
    updateMatch({ pointLog: [...match.pointLog, newLog] });
    toast.info("Let called — rally replayed");
  };

  // ── Service fault ──────────────────────────────────────────────────────────
  const callServiceFault = (team: 1 | 2) => {
    // Point goes to opponent; note is carried into the log entry via addPoint
    const opponentName = team === 1 ? match.t2.p1Name : match.t1.p1Name;
    addPoint(team === 1 ? 2 : 1, `Service fault — T${team}`);
    toast.warning(`Service fault — point to ${opponentName}'s side`);
  };

  // ── Discipline cards ───────────────────────────────────────────────────────
  const issueCard = (target: CardTarget, cardType: CardType) => {
    const newCards = { ...cards, [target]: [...cards[target], cardType] };
    setCards(newCards);
    const playerName = target === "t1p1" ? match.t1.p1Name
      : target === "t1p2" ? (match.t1.p2Name || "T1 P2")
      : target === "t2p1" ? match.t2.p1Name
      : (match.t2.p2Name || "T2 P2");

    if (cardType === "yellow") {
      toast.warning(`⚠️ Yellow card — Warning to ${playerName}`);
    } else if (cardType === "red") {
      toast.error(`🟥 Red card — Point awarded to opponent of ${playerName}`);
      // Red card: point to opponent team
      const opponentTeam = target.startsWith("t1") ? 2 : 1;
      addPoint(opponentTeam);
    } else if (cardType === "black") {
      toast.error(`⬛ Black card — ${playerName} DISQUALIFIED`);
      // Match awarded to opponent
      const opponentTeam = target.startsWith("t1") ? 2 : 1;
      updateMatch({ status: "finished", winner: opponentTeam });
    }
    setShowCardPanel(false);
    setCardTarget(null);
  };

  // ── Retirement ─────────────────────────────────────────────────────────────
  const retireTeam = (team: 1 | 2) => {
    const winner = team === 1 ? 2 : 1;
    const loserName = team === 1
      ? match.t1.p1Name + (match.t1.p2Name ? ` / ${match.t1.p2Name}` : "")
      : match.t2.p1Name + (match.t2.p2Name ? ` / ${match.t2.p2Name}` : "");
    updateMatch({ status: "finished", winner, retiredTeam: team });
    toast.error(`${loserName} has retired from the match`);
    setShowRetireModal(false);
  };

  // ── Save match ─────────────────────────────────────────────────────────────
  const saveMatchToProfile = async () => {
    if (match.status !== "finished") return;
    const isT1P1Real = players.some(p => p.id === match.t1.p1Id);
    if (!isT1P1Real) {
      toast.info("Match ended. Cannot log — players are guests.");
      handleClose();
      return;
    }
    const t1IsWinner = match.winner === 1;
    const winnerId = t1IsWinner ? match.t1.p1Id : match.t2.p1Id;
    let finalScoreStr = match.retiredTeam
      ? match.setsHistory.join(", ") + ` (T${match.retiredTeam} Retired)`
      : match.setsHistory.join(", ");
    if (match.category !== "Singles") {
      finalScoreStr += ` [${match.t1.p1Name}+${match.t1.p2Name ?? ""} vs ${match.t2.p1Name}+${match.t2.p2Name ?? ""}]`;
    }
    try {
      const matchStartTs = match.pointLog.length > 0 ? match.pointLog[0].ts : Date.now();
      const matchEndTs = match.pointLog.length > 0 ? match.pointLog[match.pointLog.length - 1].ts : Date.now();
      const durationMinutes = Math.max(1, Math.round((matchEndTs - matchStartTs) / 60000));
      const roundLabel = `${match.matchNumber || (match.isFriendly ? "Friendly" : "Tournament")} • ${durationMinutes}m`;

      const umpirePlayerId = players.find(p => p.user_id === userId)?.id || "";
      const payload = {
        umpire_id:          umpirePlayerId,
        player1_id:         match.t1.p1Id,
        player2_id:         match.t2.p1Id,
        team1_partner_id:   match.t1.p2Id || "",
        team2_partner_id:   match.t2.p2Id || "",
        winner_id:          winnerId,
        match_score:        finalScoreStr,
        match_category:     match.category,
        match_round:        roundLabel,
        is_friendly:        match.isFriendly
      };
      
      let newMatchId = "";
      if (match.dbId) {
        // Update existing match
        const { error: updateError } = await supabase.rpc("umpire_update_match", {
          match_uuid: match.dbId,
          winner_id: winnerId,
          match_score: finalScoreStr,
          match_category: match.category,
          sets_history: match.setsHistory
        });
        if (updateError) throw updateError;
        newMatchId = match.dbId;
        toast.success("Match score updated successfully!");
      } else {
        const { data: submitId, error: submitError } = await supabase.rpc("umpire_submit_match", payload);
        if (submitError) throw submitError;
        newMatchId = submitId;
        
        if (newMatchId) {
          // Admin auto-confirm bypasses the usual verification rules
          await supabase.rpc("confirm_friendly_match", { match_uuid: newMatchId });
        }
      }

      const notifMsg = `🏆 ${match.isFriendly ? "Friendly" : "Tournament"} Match: ${match.t1.p1Name}${match.t1.p2Name ? ` & ${match.t1.p2Name}` : ""} vs ${match.t2.p1Name}${match.t2.p2Name ? ` & ${match.t2.p2Name}` : ""} — ${match.setsHistory.join(", ")}`;
      await supabase.from("site_data").upsert({ key: "match_alert", value: { message: notifMsg, time: Date.now() } });
      toast.success("Match saved to profiles!");
      handleClose();
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    }
  };

  const handleClose = async () => {
    const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").single();
    const liveMatches = data?.value || {};
    delete liveMatches[userId];
    await supabase.from("site_data").upsert({ key: "live_matches", value: liveMatches });
    onClose();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const currentGameNum = match.t1.games + match.t2.games + 1;
  const serverScore   = match.serverTeam === 1 ? match.t1.score : match.t2.score;
  const receiverScore = match.serverTeam === 1 ? match.t2.score : match.t1.score;
  const serverName    = match.serverTeam === 1
    ? (match.t1.p2Name && match.serverPlayerIndex === 1 ? match.t1.p2Name : match.t1.p1Name)
    : (match.t2.p2Name && match.serverPlayerIndex === 1 ? match.t2.p2Name : match.t2.p1Name);

  const receiverName  = match.serverTeam === 1
    ? (match.t2.p2Name && match.receiverPlayerIndex === 1 ? match.t2.p2Name : match.t2.p1Name)
    : (match.t1.p2Name && match.receiverPlayerIndex === 1 ? match.t1.p2Name : match.t1.p1Name);

  const cardBadge = (target: CardTarget) => {
    const c = cards[target];
    if (!c.length) return null;
    const last = c[c.length - 1];
    return (
      <span className={`inline-block w-2.5 h-2.5 rounded-sm ml-1 ${last === "yellow" ? "bg-yellow-400" : last === "red" ? "bg-red-500" : "bg-slate-900 border border-white"}`} title={`${c.length} card(s)`} />
    );
  };

  // ── SETUP SCREEN ───────────────────────────────────────────────────────────
  const renderSetupContent = () => {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-4xl p-6 text-white max-w-xl mx-auto shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-emerald-500 to-teal-500" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> {isEditSetupOpen ? "Edit Match Setup" : "Match Setup"}
          </h2>
          <button onClick={() => {
            if (isEditSetupOpen) setIsEditSetupOpen(false);
            else handleClose();
          }} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {canRunTournament && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMatch({ ...match, isFriendly: true })}
                className={`py-3 rounded-xl font-bold text-sm border ${match.isFriendly ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
              >Friendly Match</button>
              <button
                onClick={() => setMatch({ ...match, isFriendly: false })}
                className={`py-3 rounded-xl font-bold text-sm border ${!match.isFriendly ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
              >Tournament Match</button>
            </div>
          )}

          {!match.isFriendly && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Match Number</label>
              <input
                value={match.matchNumber}
                onChange={(e) => setMatch({ ...match, matchNumber: e.target.value })}
                placeholder="e.g. MS-14"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
              />
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Points to Win</label>
              <div className="flex flex-wrap gap-2">
                {[11, 15, 21, 30].map(pts => (
                  <button key={pts} 
                    onClick={() => setMatch({ ...match, pointsToWin: pts, goldenPoint: pts === 21 ? 30 : pts === 15 ? 21 : pts === 11 ? 15 : 30 })}
                    className={`flex-1 min-w-[3rem] py-2.5 rounded-xl font-bold text-sm border transition-colors ${match.pointsToWin === pts ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}
                  >
                    {pts}
                  </button>
                ))}
                <input 
                  type="number" 
                  placeholder="Custom"
                  value={[11, 15, 21, 30].includes(match.pointsToWin) ? "" : match.pointsToWin}
                  onChange={(e) => {
                    const pts = parseInt(e.target.value) || 0;
                    setMatch({ ...match, pointsToWin: pts, goldenPoint: pts + 2 });
                  }}
                  className={`flex-1 min-w-[4rem] bg-slate-800 border rounded-xl p-2.5 text-center text-sm font-bold outline-none transition-colors ${![11, 15, 21, 30].includes(match.pointsToWin) && match.pointsToWin > 0 ? "border-emerald-500 text-emerald-400 bg-emerald-500/20" : "border-slate-700 text-slate-400 focus:border-slate-500"}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Best of Sets</label>
                <div className="flex gap-2">
                  {[1, 3, 5].map(sets => (
                    <button key={sets} 
                      onClick={() => setMatch({ ...match, bestOfSets: sets })}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm border transition-colors ${match.bestOfSets === sets ? "bg-sky-500/20 border-sky-500 text-sky-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}
                    >
                      BO{sets}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Cap (Golden Pt)</label>
                <input
                  type="number"
                  value={match.goldenPoint}
                  onChange={(e) => setMatch({ ...match, goldenPoint: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-center font-bold text-slate-300 outline-none focus:border-amber-500 focus:bg-amber-500/10 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Team 1</label>
              <div className="space-y-2">
                <PlayerSelect value={match.t1.p1Id} onChange={(v) => setMatch({ ...match, t1: { ...match.t1, p1Id: v } })} players={players.filter(p => ![match.t1.p2Id, match.t2.p1Id, match.t2.p2Id].includes(p.id))} placeholder="Player 1" />
                <PlayerSelect value={match.t1.p2Id || ""} onChange={(v) => setMatch({ ...match, t1: { ...match.t1, p2Id: v } })} players={players.filter(p => ![match.t1.p1Id, match.t2.p1Id, match.t2.p2Id].includes(p.id))} placeholder="Player 2 (optional — doubles)" />
              </div>
            </div>
            <div className="text-center text-slate-500 font-black italic">VS</div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Team 2</label>
              <div className="space-y-2">
                <PlayerSelect value={match.t2.p1Id} onChange={(v) => setMatch({ ...match, t2: { ...match.t2, p1Id: v } })} players={players.filter(p => ![match.t1.p1Id, match.t1.p2Id, match.t2.p2Id].includes(p.id))} placeholder="Player 1" />
                <PlayerSelect value={match.t2.p2Id || ""} onChange={(v) => setMatch({ ...match, t2: { ...match.t2, p2Id: v } })} players={players.filter(p => ![match.t1.p1Id, match.t1.p2Id, match.t2.p1Id].includes(p.id))} placeholder="Player 2 (optional — doubles)" />
              </div>
            </div>
          </div>

          {match.t1.p1Id && match.t2.p1Id && (
            <div className="bg-slate-800/50 p-4 rounded-2xl mb-4 border border-emerald-500/20 mt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Detected Category</span>
                <span className="text-emerald-400 font-bold text-sm bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">{deduceCategory()}</span>
              </div>
              <div className="pt-3 border-t border-slate-700/50">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Override Category (Optional)</label>
                <input
                  value={match.customCategory || ""}
                  onChange={(e) => setMatch({ ...match, customCategory: e.target.value })}
                  placeholder="e.g. Mixed Doubles"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">First Serve</label>
            <div className="flex gap-2 mb-2">
              {([1, 2] as const).map(t => {
                const teamData = t === 1 ? match.t1 : match.t2;
                const p1Str = teamData.p1Id ? getName(teamData.p1Id).split(" ")[0] : `Team ${t}`;
                const p2Str = teamData.p2Id ? getName(teamData.p2Id).split(" ")[0] : "";
                const teamLabel = p2Str ? `${p1Str} & ${p2Str}` : p1Str;
                return (
                  <button key={t}
                    onClick={() => setMatch({ ...match, serverTeam: t })}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs border truncate ${match.serverTeam === t ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                  >{teamLabel} Serve{teamLabel === p1Str ? "s" : ""}</button>
                );
              })}
            </div>
            {(match.t1.p2Id || match.t2.p2Id) && (
              <>
                <div className="flex gap-2 mb-3">
                  {([0, 1] as const).map(i => {
                    const servingTeam = match.serverTeam === 1 ? match.t1 : match.t2;
                    const pName = i === 0 
                      ? (servingTeam.p1Id ? getName(servingTeam.p1Id).split(" ")[0] : "P1") 
                      : (servingTeam.p2Id ? getName(servingTeam.p2Id).split(" ")[0] : "P2");
                    
                    if (i === 1 && !servingTeam.p2Id) return null;

                    return (
                      <button key={i}
                        onClick={() => setMatch({ ...match, serverPlayerIndex: i })}
                        className={`flex-1 py-2 rounded-lg font-bold text-xs border truncate ${match.serverPlayerIndex === i ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                      >{pName} Serves First</button>
                    );
                  })}
                </div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                  First Receiver <span className="text-slate-600 normal-case">(BWF Law 9.4 — receiving side chooses)</span>
                </label>
                <div className="flex gap-2">
                  {([0, 1] as const).map(i => {
                    const receivingTeam = match.serverTeam === 1 ? match.t2 : match.t1;
                    const pName = i === 0 
                      ? (receivingTeam.p1Id ? getName(receivingTeam.p1Id).split(" ")[0] : "P1") 
                      : (receivingTeam.p2Id ? getName(receivingTeam.p2Id).split(" ")[0] : "P2");
                    
                    if (i === 1 && !receivingTeam.p2Id) return null;

                    return (
                      <button key={i}
                        onClick={() => setMatch({ ...match, receiverPlayerIndex: i })}
                        className={`flex-1 py-2 rounded-lg font-bold text-xs border truncate ${match.receiverPlayerIndex === i ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                      >{pName} Receives</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button onClick={() => {
            if (isEditSetupOpen) {
              setIsEditSetupOpen(false);
              updateMatch({
                inferredCategory: match.customCategory || deduceCategory(),
                t1: { ...match.t1, p1Name: getName(match.t1.p1Id), p2Name: match.t1.p2Id ? getName(match.t1.p2Id) : undefined },
                t2: { ...match.t2, p1Name: getName(match.t2.p1Id), p2Name: match.t2.p2Id ? getName(match.t2.p2Id) : undefined }
              });
            } else {
              startMatch();
            }
          }} className="w-full py-4 mt-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] transition">
            {isEditSetupOpen ? "Save Changes" : (match.pointLog.length > 0 ? "Resume Broadcasting" : "Start Broadcasting")}
          </button>
        </div>
      </div>
    );
  };

  if (match.status === "setup") {
    return renderSetupContent();
  }

  const renderSetupOverlay = () => {
    if (!isEditSetupOpen) return null;
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
        onClick={() => setIsEditSetupOpen(false)}
      >
        <div className="w-full max-w-xl my-8" onClick={e => e.stopPropagation()}>
          {renderSetupContent()}
        </div>
      </div>
    );
  };

  // ── PLAYING / FINISHED SCREEN ──────────────────────────────────────────────
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-4xl p-4 sm:p-8 text-white max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-emerald-500 to-sky-500" />
      {renderSetupOverlay()}
      {/* ── Change Ends Overlay ── */}
      {showChangeEnds && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm rounded-4xl gap-5 p-8 text-center">
          <ArrowLeftRight className="w-14 h-14 text-amber-400" />
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Change Ends</h2>
          <p className="text-slate-400 font-bold text-sm max-w-xs">{changeEndsReason}</p>
          <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Players change sides of the court now
          </div>
          <button
            onClick={confirmChangeEnds}
            className="mt-2 px-10 py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl font-black uppercase tracking-widest shadow-xl transition"
          >
            Ends Changed ✓
          </button>
        </div>
      )}

      {/* ── Cards Panel Overlay ── */}
      {showCardPanel && (
        <div className="absolute inset-0 z-50 flex flex-col items-start justify-start bg-slate-950/95 backdrop-blur-sm rounded-4xl p-6 overflow-auto">
          <div className="flex items-center justify-between w-full mb-6">
            <h2 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
              <Flag className="w-5 h-5 text-amber-400" /> Issue Discipline Card
            </h2>
            <button onClick={() => { setShowCardPanel(false); setCardTarget(null); }} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Player selection */}
          <div className="w-full grid grid-cols-2 gap-3 mb-6">
            {([
              { key: "t1p1" as CardTarget, label: match.t1.p1Name || "T1 P1" },
              ...(match.t1.p2Name ? [{ key: "t1p2" as CardTarget, label: match.t1.p2Name }] : []),
              { key: "t2p1" as CardTarget, label: match.t2.p1Name || "T2 P1" },
              ...(match.t2.p2Name ? [{ key: "t2p2" as CardTarget, label: match.t2.p2Name }] : []),
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCardTarget(key)}
                className={`py-3 px-4 rounded-xl font-bold text-sm border text-left transition ${cardTarget === key ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-300"}`}
              >
                {label}
                {cards[key].map((c, i) => (
                  <span key={i} className={`inline-block w-2.5 h-2.5 rounded-sm ml-1 ${c === "yellow" ? "bg-yellow-400" : c === "red" ? "bg-red-500" : "bg-white border border-slate-400"}`} />
                ))}
              </button>
            ))}
          </div>

          {/* Card type buttons */}
          {cardTarget && (
            <div className="w-full space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select card for: <span className="text-white">{
                cardTarget === "t1p1" ? match.t1.p1Name
                : cardTarget === "t1p2" ? match.t1.p2Name
                : cardTarget === "t2p1" ? match.t2.p1Name
                : match.t2.p2Name
              }</span></p>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => issueCard(cardTarget, "yellow")} className="py-4 rounded-2xl font-black text-sm bg-yellow-400/20 border border-yellow-400 text-yellow-300 hover:bg-yellow-400/30 transition">
                  ⚠️ Yellow<br/><span className="text-xs font-normal opacity-70">Warning</span>
                </button>
                <button onClick={() => issueCard(cardTarget, "red")} className="py-4 rounded-2xl font-black text-sm bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 transition">
                  🟥 Red<br/><span className="text-xs font-normal opacity-70">+1 pt opponent</span>
                </button>
                <button onClick={() => issueCard(cardTarget, "black")} className="py-4 rounded-2xl font-black text-sm bg-slate-700/80 border border-slate-400 text-white hover:bg-slate-600 transition">
                  ⬛ Black<br/><span className="text-xs font-normal opacity-70">Disqualify</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Retirement Modal ── */}
      {showRetireModal && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm rounded-4xl p-8 text-center gap-5">
          <AlertTriangle className="w-12 h-12 text-rose-400" />
          <h2 className="text-xl font-black text-white uppercase tracking-wider">Match Retirement</h2>
          <p className="text-slate-400 text-sm">Which team is retiring from the match?</p>
          <div className="flex gap-3 w-full max-w-xs">
            <button onClick={() => retireTeam(1)} className="flex-1 py-3 bg-rose-500/20 border border-rose-500 text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-500/30 transition">
              Team 1 Retires
            </button>
            <button onClick={() => retireTeam(2)} className="flex-1 py-3 bg-rose-500/20 border border-rose-500 text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-500/30 transition">
              Team 2 Retires
            </button>
          </div>
          <button onClick={() => setShowRetireModal(false)} className="text-slate-500 text-sm hover:text-slate-300 transition">Cancel</button>
        </div>
      )}

      {/* ── Direct Score Modal ── */}
      {isDirectScoreOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-black mb-4 text-white">Enter Final Score</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Winner</label>
                <div className="flex gap-2">
                  <button onClick={() => setDirectWinner(1)} className={`flex-1 py-3 rounded-xl font-bold transition ${directWinner === 1 ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"}`}>Team 1</button>
                  <button onClick={() => setDirectWinner(2)} className={`flex-1 py-3 rounded-xl font-bold transition ${directWinner === 2 ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"}`}>Team 2</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Set Scores (e.g. 21-15, 21-18)</label>
                <input type="text" value={directSetsText} onChange={e => setDirectSetsText(e.target.value)} placeholder="21-15, 21-18" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setIsDirectScoreOpen(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold">Cancel</button>
                <button onClick={() => {
                  if (!directWinner || !directSetsText) { toast.error("Fill all fields"); return; }
                  updateMatch({ status: "finished", winner: directWinner, setsHistory: directSetsText.split(",").map(s => s.trim()) });
                  setIsDirectScoreOpen(false);
                }} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold">Save Score</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-sm mb-1">
            <Activity className="w-5 h-5 animate-pulse" /> Live Umpire
          </div>
          <div className="text-slate-400 text-xs font-bold">
            {match.isFriendly ? "Friendly" : `Tournament • ${match.matchNumber || "—"}`} • {match.inferredCategory || match.category} • BO{match.bestOfSets} ({match.pointsToWin}pts) • Game {currentGameNum}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {match.status === "playing" && (
            <>
              <button onClick={() => updateMatch({ endsSwapped: !match.endsSwapped })} className="px-3 py-1.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700">Swap Ends</button>
              <button onClick={() => setIsDirectScoreOpen(true)} className="px-3 py-1.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700">Direct Score</button>
              <button onClick={() => setIsEditSetupOpen(true)} className="px-3 py-1.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700">Edit Setup</button>
            </>
          )}
          <button onClick={handleClose} className="px-3 py-1.5 bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl hover:bg-rose-500/30">Abort</button>
        </div>
      </div>

      {/* ── Finished Screen ── */}
      {match.status === "finished" ? (
        <div className="text-center py-12">
          <Trophy className="w-20 h-20 mx-auto text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
          <h2 className="text-3xl font-black mb-2">Match {match.retiredTeam ? "Retired" : "Finished"}!</h2>
          <div className="text-xs font-bold text-slate-400 mb-4 tracking-widest uppercase">
            {match.inferredCategory || match.category} • BO{match.bestOfSets} ({match.pointsToWin}pts)
          </div>
          <p className="text-xl text-slate-300 mb-2">
            {match.winner === 1
              ? (match.t1.p1Name + (match.t1.p2Name ? ` / ${match.t1.p2Name}` : ""))
              : (match.t2.p1Name + (match.t2.p2Name ? ` / ${match.t2.p2Name}` : ""))
            } Won
          </p>
          <p className="text-emerald-400 font-bold mb-8 text-2xl">{match.setsHistory.join(", ")}{match.retiredTeam ? ` (T${match.retiredTeam} Retired)` : ""}</p>
          <button onClick={saveMatchToProfile} className="px-8 py-4 bg-linear-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black uppercase tracking-wider shadow-xl flex items-center gap-2 mx-auto">
            <Save className="w-5 h-5" /> Save to Profile & Notify
          </button>
          <button onClick={() => updateMatch({ status: "playing", winner: undefined, retiredTeam: undefined })} className="mt-6 text-sm font-bold text-slate-500 hover:text-slate-400 underline">
            Wait, add a set / resume match
          </button>
        </div>
      ) : (
        <>
          {/* ── Break Timer ── */}
          {breakSecondsLeft !== null ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Timer className="w-10 h-10 text-amber-400 animate-pulse" />
              <div className="text-7xl font-black tabular-nums text-amber-400">
                {Math.floor(breakSecondsLeft / 60).toString().padStart(2, "0")}:{(breakSecondsLeft % 60).toString().padStart(2, "0")}
              </div>
              {breakLabel && <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center max-w-xs">{breakLabel}</p>}
              <button onClick={endBreak} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm">End Break</button>
            </div>
          ) : (
            <div className="flex gap-2 justify-center mb-5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest self-center">Break:</span>
              {[["30s", 30, "Short Break"], ["1 min", 60, "1-min Interval"], ["90s", 90, "Set 1→2 Interval"], ["2 min", 120, "Set 2→3 Interval"]] .map(([label, secs, lbl]) => (
                <button key={label as string} onClick={() => startBreak(secs as number, lbl as string)}
                  className={`px-3 py-1.5 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 ${
                    label === "1 min" 
                      ? "bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                      : "bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300"
                  }`}>
                  <Timer className="w-3 h-3" />{label as string}
                </button>
              ))}
            </div>
          )}

          {/* ── Court Visual ── */}
          <div className="flex justify-center mb-4" style={breakSecondsLeft !== null ? { opacity: 0.3 } : {}}>
            <CourtVisual
              serverTeam={match.serverTeam}
              serverPlayerIndex={match.serverPlayerIndex}
              receiverP0AtTop={match.receiverP0AtTop}
              t1Name={match.t1.p1Name}
              t2Name={match.t2.p1Name}
              t1P2Name={match.t1.p2Name}
              t2P2Name={match.t2.p2Name}
              t1Score={match.t1.score}
              t2Score={match.t2.score}
              isDoubles={!!match.t1.p2Id}
              endsSwapped={match.endsSwapped}
              onSwitchServer={() => updateMatch({ serverPlayerIndex: match.serverPlayerIndex === 0 ? 1 : 0 })}
            />
          </div>

          {/* ── Score Announcement (server-first, BWF style) ── */}
          <div className="flex items-center justify-center gap-3 mb-5 text-xs font-black uppercase tracking-widest" style={breakSecondsLeft !== null ? { opacity: 0.3 } : {}}>
            <span className="text-emerald-400">{serverName}</span>
            <span className="text-emerald-400 text-lg tabular-nums">{serverScore}</span>
            <span className="text-slate-600">—</span>
            <span className="text-slate-300 text-lg tabular-nums">{receiverScore}</span>
            <span className="text-slate-500">{receiverName}</span>
            <span className="text-[10px] font-bold text-slate-600 ml-1">({match.setsHistory.length > 0 ? match.setsHistory.join(", ") + " | " : ""}Game {currentGameNum})</span>
          </div>

          {/* ── Score Cards ── */}
          <div className="flex flex-col md:flex-row justify-center items-center gap-6 w-full" style={breakSecondsLeft !== null ? { opacity: 0.3, pointerEvents: "none" } : {}}>
            {/* Team 1 */}
            <div className={`p-6 rounded-3xl border-2 transition-all flex-1 w-full max-w-[400px] ${match.serverTeam === 1 ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`} style={{ order: match.endsSwapped ? 3 : 1 }}>
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold truncate">
                  {match.t1.p1Name}{cardBadge("t1p1")}
                </h3>
                {match.t1.p2Name && (
                  <h3 className="text-xl font-bold truncate">
                    {match.t1.p2Name}{cardBadge("t1p2")}
                  </h3>
                )}
                <div className="text-emerald-400 font-black text-sm mt-1 flex items-center justify-center gap-1 min-h-4.5">
                  {match.serverTeam === 1 && <><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Serving</>}
                </div>
              </div>
              <div className="flex justify-center mb-4">
                <div className="text-[7rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md">{match.t1.score}</div>
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={() => deductPoint(1)} className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center border border-slate-700">
                  <Minus className="w-6 h-6 text-slate-400" />
                </button>
                <button onClick={() => addPoint(1)} className="w-24 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Plus className="w-8 h-8 text-emerald-950" />
                </button>
              </div>
              <div className="mt-5 flex justify-center gap-2">
                {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full ${i < match.t1.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
                ))}
              </div>
            </div>

            <div className="text-4xl font-black italic text-slate-700 text-center py-4" style={{ order: 2 }}>VS</div>

            {/* Team 2 */}
            <div className={`p-6 rounded-3xl border-2 transition-all flex-1 w-full max-w-[400px] ${match.serverTeam === 2 ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`} style={{ order: match.endsSwapped ? 1 : 3 }}>
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold truncate">
                  {match.t2.p1Name}{cardBadge("t2p1")}
                </h3>
                {match.t2.p2Name && (
                  <h3 className="text-xl font-bold truncate">
                    {match.t2.p2Name}{cardBadge("t2p2")}
                  </h3>
                )}
                <div className="text-emerald-400 font-black text-sm mt-1 flex items-center justify-center gap-1 min-h-4.5">
                  {match.serverTeam === 2 && <><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Serving</>}
                </div>
              </div>
              <div className="flex justify-center mb-4">
                <div className="text-[7rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md">{match.t2.score}</div>
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={() => deductPoint(2)} className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center border border-slate-700">
                  <Minus className="w-6 h-6 text-slate-400" />
                </button>
                <button onClick={() => addPoint(2)} className="w-24 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Plus className="w-8 h-8 text-emerald-950" />
                </button>
              </div>
              <div className="mt-5 flex justify-center gap-2">
                {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full ${i < match.t2.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Action Bar ── */}
          <div className="mt-6 flex flex-wrap justify-center gap-2" style={breakSecondsLeft !== null ? { opacity: 0.3, pointerEvents: "none" } : {}}>
            <button onClick={forceEndSet}
              className="px-4 py-2.5 bg-slate-800 hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Set
            </button>
            <button onClick={callLet}
              className="px-4 py-2.5 bg-slate-800 hover:bg-blue-500/20 border border-slate-700 hover:border-blue-500/50 text-slate-300 hover:text-blue-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5">
              ↩ Let
            </button>
            <button onClick={() => callServiceFault(match.serverTeam)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-orange-500/20 border border-slate-700 hover:border-orange-500/50 text-slate-300 hover:text-orange-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5">
              ✗ Service Fault
            </button>
            <button onClick={() => { setShowCardPanel(true); setCardTarget(null); }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-yellow-500/20 border border-slate-700 hover:border-yellow-500/50 text-slate-300 hover:text-yellow-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5" /> Cards
            </button>
            <button onClick={() => setShowRetireModal(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Retire
            </button>
            <button onClick={() => setShowLog(!showLog)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Log ({match.pointLog.length})
              {showLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </>
      )}

      {/* ── Sets History & Editing ── */}
          {match.setsHistory.length > 0 && (
            <div className="mt-8 bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-700 font-black"></th>
                    <th colSpan={match.t1.p2Id ? 2 : 1} className="px-4 py-3 border-b border-slate-700 text-center font-black text-emerald-400">Team 1</th>
                    <th colSpan={match.t2.p2Id ? 2 : 1} className="px-4 py-3 border-b border-slate-700 text-center font-black text-sky-400">Team 2</th>
                    <th className="px-4 py-3 border-b border-slate-700 font-black text-center text-amber-400">Winner</th>
                  </tr>
                  <tr>
                    <th className="px-4 py-2 border-b border-slate-700 bg-slate-800/50"></th>
                    <th className="px-4 py-2 border-b border-slate-700 bg-slate-800/50">
                      <div className="flex flex-col items-center gap-1.5">
                        <img src={players.find(p => p.id === match.t1.p1Id)?.avatar_url || ""} className="w-8 h-8 rounded-full object-cover shadow-sm bg-slate-700" />
                        <span>{match.t1.p1Name}</span>
                      </div>
                    </th>
                    {match.t1.p2Id && (
                      <th className="px-4 py-2 border-b border-slate-700 bg-slate-800/50">
                        <div className="flex flex-col items-center gap-1.5">
                          <img src={players.find(p => p.id === match.t1.p2Id)?.avatar_url || ""} className="w-8 h-8 rounded-full object-cover shadow-sm bg-slate-700" />
                          <span>{match.t1.p2Name}</span>
                        </div>
                      </th>
                    )}
                    <th className="px-4 py-2 border-b border-slate-700 bg-slate-800/50">
                      <div className="flex flex-col items-center gap-1.5">
                        <img src={players.find(p => p.id === match.t2.p1Id)?.avatar_url || ""} className="w-8 h-8 rounded-full object-cover shadow-sm bg-slate-700" />
                        <span>{match.t2.p1Name}</span>
                      </div>
                    </th>
                    {match.t2.p2Id && (
                      <th className="px-4 py-2 border-b border-slate-700 bg-slate-800/50">
                        <div className="flex flex-col items-center gap-1.5">
                          <img src={players.find(p => p.id === match.t2.p2Id)?.avatar_url || ""} className="w-8 h-8 rounded-full object-cover shadow-sm bg-slate-700" />
                          <span>{match.t2.p2Name}</span>
                        </div>
                      </th>
                    )}
                    <th className="px-4 py-2 border-b border-slate-700 bg-slate-800/50"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-300">
                  {match.setsHistory.map((setStr, i) => {
                    const [s1, s2] = setStr.split("-");
                    const n1 = parseInt(s1);
                    const n2 = parseInt(s2);
                    const t1Won = n1 > n2;
                    const t2Won = n2 > n1;
                    const winnerStr = t1Won 
                      ? match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "")
                      : t2Won 
                        ? match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "")
                        : "-";

                    return (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-400 whitespace-nowrap">Set {i + 1}</td>
                        <td colSpan={match.t1.p2Id ? 2 : 1} className="px-4 py-3 text-center">
                          <input 
                            type="text" 
                            maxLength={2}
                            value={s1} 
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              const capped = raw && parseInt(raw) > match.goldenPoint ? match.goldenPoint.toString() : raw;
                              handleEditSet(i, capped, s2);
                            }}
                            className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-center font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td colSpan={match.t2.p2Id ? 2 : 1} className="px-4 py-3 text-center">
                          <input 
                            type="text" 
                            maxLength={2}
                            value={s2} 
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              const capped = raw && parseInt(raw) > match.goldenPoint ? match.goldenPoint.toString() : raw;
                              handleEditSet(i, s1, capped);
                            }}
                            className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-center font-bold text-sky-400 outline-none focus:border-sky-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-xs text-slate-400 text-center">{winnerStr}</td>
                      </tr>
                    );
                  })}
                  {!!match.winner && (
                    <tr className="bg-emerald-900/20">
                      <td colSpan={1 + (match.t1.p2Id ? 2 : 1) + (match.t2.p2Id ? 2 : 1)} className="px-4 py-4 font-black text-amber-500 text-right pr-6 uppercase tracking-widest text-xs">
                        Match Winner
                      </td>
                      <td className="px-4 py-4 font-black text-amber-400 text-center">
                        {match.winner === 1 
                          ? match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "")
                          : match.winner === 2 
                            ? match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "")
                            : "-"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Point-by-Point Log ── */}
          {showLog && (
            <div className="mt-4 bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Match Log</span>
                <span className="text-xs text-slate-500">{match.pointLog.length} events</span>
              </div>
              {match.pointLog.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-500 text-sm">No points logged yet</div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {[...match.pointLog].reverse().map((entry, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`font-black ${
                          entry.team === 1 ? "text-emerald-400"
                          : entry.team === 2 ? "text-sky-400"
                          : entry.team === "let" ? "text-blue-400"
                          : "text-orange-400"
                        }`}>
                          {entry.team === 1 ? "T1 +" : entry.team === 2 ? "T2 +" : entry.team === "let" ? "LET" : "FAULT"}
                        </span>
                        {entry.note && <span className="text-slate-500">{entry.note}</span>}
                        <span className="text-slate-600">G{entry.gameNum}</span>
                      </div>
                      <div className="font-mono font-bold text-slate-300 shrink-0">
                        {entry.t1Score} — {entry.t2Score}
                        <span className={`ml-1.5 text-[9px] ${entry.serverTeam === 1 ? "text-emerald-500" : "text-sky-500"}`}>
                          🏸T{entry.serverTeam}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
    </div>
  );
}
