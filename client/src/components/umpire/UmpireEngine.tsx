import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Activity, Plus, Minus, Users, User, X, Settings, Save, Timer } from "lucide-react";
import { toast } from "sonner";
import { isAdminEmail } from "@/lib/admin";

export interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
  gender?: string;
}

function CourtVisual({ 
  serverTeam, 
  serverPlayerIndex = 0,
  t1Name, 
  t2Name, 
  t1P2Name,
  t2P2Name,
  isDoubles,
  onSwitchServer
}: { 
  serverTeam: 1 | 2; 
  serverPlayerIndex?: 0 | 1;
  t1Name: string; 
  t2Name: string; 
  t1P2Name?: string;
  t2P2Name?: string;
  isDoubles: boolean;
  onSwitchServer?: () => void;
}) {
  return (
    <div className="relative w-52 h-32 select-none" title="Court view — server highlighted">
      <svg viewBox="0 0 208 128" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Court outline */}
        <rect x="4" y="4" width="200" height="120" rx="2" stroke="#334155" strokeWidth="2" fill="#0f172a" />
        {/* Net */}
        <line x1="104" y1="4" x2="104" y2="124" stroke="#64748b" strokeWidth="2" strokeDasharray="4 3" />
        {/* Service boxes */}
        <line x1="4" y1="64" x2="104" y2="64" stroke="#1e3a5f" strokeWidth="1" />
        <line x1="104" y1="64" x2="204" y2="64" stroke="#1e3a5f" strokeWidth="1" />
        {/* Doubles tramlines */}
        {isDoubles && <>
          <line x1="4" y1="18" x2="204" y2="18" stroke="#1e293b" strokeWidth="1" />
          <line x1="4" y1="110" x2="204" y2="110" stroke="#1e293b" strokeWidth="1" />
        </>}
        {/* Team 1 side highlight */}
        {serverTeam === 1 && <rect x="5" y="5" width="98" height="118" rx="1" fill="#10b981" fillOpacity="0.12" />}
        {/* Team 2 side highlight */}
        {serverTeam === 2 && <rect x="105" y="5" width="98" height="118" rx="1" fill="#10b981" fillOpacity="0.12" />}
        {/* Shuttlecock at server's end */}
        {serverTeam === 1 && <circle cx="52" cy={serverPlayerIndex === 0 ? "34" : "94"} r="6" fill="#10b981" opacity="0.9" />}
        {serverTeam === 2 && <circle cx="156" cy={serverPlayerIndex === 0 ? "34" : "94"} r="6" fill="#10b981" opacity="0.9" />}
        {/* Serve direction arrow */}
        {serverTeam === 1 && <path d={`M60 ${serverPlayerIndex === 0 ? '34' : '94'} L88 ${serverPlayerIndex === 0 ? '94' : '34'}`} stroke="#10b981" strokeWidth="2" markerEnd="url(#arrowR)" />}
        {serverTeam === 2 && <path d={`M148 ${serverPlayerIndex === 0 ? '34' : '94'} L120 ${serverPlayerIndex === 0 ? '94' : '34'}`} stroke="#10b981" strokeWidth="2" markerEnd="url(#arrowL)" />}
        <defs>
          <marker id="arrowR" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,2 L8,5 L0,8 Z" fill="#10b981" />
          </marker>
          <marker id="arrowL" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto">
            <path d="M10,2 L2,5 L10,8 Z" fill="#10b981" />
          </marker>
        </defs>
      </svg>
      {/* Player name labels */}
      <div className="absolute inset-0 flex items-stretch justify-between px-3 py-1.5 pointer-events-none">
        <div className="flex flex-col justify-around h-full w-[44%]">
          <span 
            onClick={serverTeam === 1 && isDoubles ? onSwitchServer : undefined}
            className={`text-[9px] font-black uppercase truncate ${serverTeam === 1 && serverPlayerIndex === 0 ? "text-emerald-400" : "text-slate-500"} ${serverTeam === 1 && isDoubles ? "pointer-events-auto cursor-pointer" : ""}`}
          >
            {t1Name || "T1 P1"}
          </span>
          {isDoubles && (
            <span 
              onClick={serverTeam === 1 ? onSwitchServer : undefined}
              className={`text-[9px] font-black uppercase truncate ${serverTeam === 1 && serverPlayerIndex === 1 ? "text-emerald-400" : "text-slate-500"} ${serverTeam === 1 ? "pointer-events-auto cursor-pointer" : ""}`}
            >
              {t1P2Name || "T1 P2"}
            </span>
          )}
        </div>
        <div className="flex flex-col justify-around h-full w-[44%] text-right items-end">
          <span 
            onClick={serverTeam === 2 && isDoubles ? onSwitchServer : undefined}
            className={`text-[9px] font-black uppercase truncate ${serverTeam === 2 && serverPlayerIndex === 0 ? "text-emerald-400" : "text-slate-500"} ${serverTeam === 2 && isDoubles ? "pointer-events-auto cursor-pointer" : ""}`}
          >
            {t2Name || "T2 P1"}
          </span>
          {isDoubles && (
            <span 
              onClick={serverTeam === 2 ? onSwitchServer : undefined}
              className={`text-[9px] font-black uppercase truncate ${serverTeam === 2 && serverPlayerIndex === 1 ? "text-emerald-400" : "text-slate-500"} ${serverTeam === 2 ? "pointer-events-auto cursor-pointer" : ""}`}
            >
              {t2P2Name || "T2 P2"}
            </span>
          )}
        </div>
      </div>
      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-slate-600 font-bold uppercase tracking-widest pointer-events-none">NET</div>
    </div>
  );
}

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
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const p = players.find((p) => p.id === value);
      if (p) setSearch(p.full_name);
      else setSearch(value);
    } else {
      setSearch("");
    }
  }, [value, players]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (value) {
          const p = players.find((p) => p.id === value);
          if (p) setSearch(p.full_name);
          else setSearch(value);
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, players]);

  const filtered = players.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder ?? "Search or type name..."}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          onChange(e.target.value);
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full text-sm font-bold bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder:text-slate-500"
      />
      {isOpen && search.length > 0 && (
        <div className="absolute z-[60] w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div
              className="p-3 text-sm font-bold hover:bg-emerald-900/30 cursor-pointer text-emerald-400"
              onClick={() => setIsOpen(false)}
            >
              Use "{search}" as Guest
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onChange(p.id);
                  setSearch(p.full_name);
                  setIsOpen(false);
                }}
                className="p-3 text-sm font-bold hover:bg-emerald-900/30 cursor-pointer text-slate-200"
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

export type BwfMatchState = {
  id: string; // umpire ID
  umpireName: string;
  isFriendly: boolean;
  matchNumber?: string;
  category: string;
  pointsToWin: number;
  bestOfSets: number;
  goldenPoint: number;
  t1: { p1Id: string; p1Name: string; p2Id?: string; p2Name?: string; score: number; games: number };
  t2: { p1Id: string; p1Name: string; p2Id?: string; p2Name?: string; score: number; games: number };
  serverTeam: 1 | 2;
  serverPlayerIndex: 0 | 1;
  t1LastServedBy: 0 | 1;
  t2LastServedBy: 0 | 1;
  status: "setup" | "playing" | "finished";
  winner?: 1 | 2;
  setsHistory: string[];
};

export function UmpireEngine({
  userId,
  userEmail,
  userName,
  isTournamentUmpire = false,
  onClose,
}: {
  userId: string;
  userEmail: string;
  userName: string;
  /** True when user is an admin or has been assigned the umpire role */
  isTournamentUmpire?: boolean;
  onClose: () => void;
}) {
  const isAdmin = isAdminEmail(userEmail);
  const canRunTournament = isAdmin || isTournamentUmpire;
  const [players, setPlayers] = useState<Player[]>([]);
  const [match, setMatch] = useState<BwfMatchState>({
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
    t1LastServedBy: 1,
    t2LastServedBy: 0,
    status: "setup",
    setsHistory: [],
  });

  const [isDirectScoreOpen, setIsDirectScoreOpen] = useState(false);
  const [directSetsText, setDirectSetsText] = useState("");
  const [directWinner, setDirectWinner] = useState<1 | 2 | null>(null);

  // Break timer
  const [breakSecondsLeft, setBreakSecondsLeft] = useState<number | null>(null);
  const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startBreak = (seconds: number) => {
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
    setBreakSecondsLeft(seconds);
    breakIntervalRef.current = setInterval(() => {
      setBreakSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(breakIntervalRef.current!);
          breakIntervalRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (breakIntervalRef.current) clearInterval(breakIntervalRef.current); }, []);

  useEffect(() => {
    supabase
      .from("players")
      .select("id, full_name, avatar_url, gender")
      .is("deleted_at", null)
      .then(({ data }) => { if (data) setPlayers(data); });
  }, []);

  const updateMatch = async (updates: Partial<BwfMatchState>) => {
    const next = { ...match, ...updates };
    setMatch(next);

    const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").single();
    const liveMatches = data?.value || {};
    liveMatches[userId] = next;
    
    await supabase.from("site_data").upsert({ key: "live_matches", value: liveMatches });
  };

  const getName = (idOrName: string) => players.find((p) => p.id === idOrName)?.full_name || idOrName;

  const getGender = (idOrName: string) => {
    const p = players.find(p => p.id === idOrName);
    return p?.gender?.toLowerCase() || "unknown";
  };

  const deduceCategory = () => {
    const t1HasP2 = !!match.t1.p2Id;
    const t2HasP2 = !!match.t2.p2Id;

    if (!t1HasP2 && !t2HasP2) {
      const g1 = getGender(match.t1.p1Id);
      const g2 = getGender(match.t2.p1Id);
      if (g1 === "male" && g2 === "male") return "MS";
      if (g1 === "female" && g2 === "female") return "WS";
      if (g1 === "unknown" || g2 === "unknown") return "Singles";
      return "Hybrid";
    } else if (t1HasP2 && t2HasP2) {
      const g1 = getGender(match.t1.p1Id);
      const g2 = getGender(match.t1.p2Id!);
      const g3 = getGender(match.t2.p1Id);
      const g4 = getGender(match.t2.p2Id!);

      const isMD = [g1, g2, g3, g4].every(g => g === "male");
      const isWD = [g1, g2, g3, g4].every(g => g === "female");
      
      const t1Mixed = (g1 === "male" && g2 === "female") || (g1 === "female" && g2 === "male");
      const t2Mixed = (g3 === "male" && g4 === "female") || (g3 === "female" && g4 === "male");

      if (isMD) return "MD";
      if (isWD) return "WD";
      if (t1Mixed && t2Mixed) return "XD";
      if ([g1, g2, g3, g4].some(g => g === "unknown")) return "Doubles";
      return "Hybrid";
    } else {
      return "Hybrid"; // 1v2 handicap
    }
  };

  const startMatch = async () => {
    if (!match.t1.p1Id || !match.t2.p1Id) {
      toast.error("Please fill in player 1 for both teams");
      return;
    }

    if (match.isFriendly && !isAdmin) {
      const { data: umpireProfile } = await supabase.from("players").select("buddies").eq("user_id", userId).maybeSingle();
      const buddies = umpireProfile?.buddies || [];
      const playersInMatch = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id].filter(Boolean);
      
      const isBuddyWithSomeone = playersInMatch.some(id => buddies.includes(id));
      if (!isBuddyWithSomeone) {
        toast.error("You must be a buddy with at least one player to umpire a friendly match.");
        return;
      }
    }

    const cat = deduceCategory();

    await updateMatch({
      status: "playing",
      category: cat,
      t1: { ...match.t1, p1Name: getName(match.t1.p1Id), p2Name: match.t1.p2Id ? getName(match.t1.p2Id) : undefined },
      t2: { ...match.t2, p1Name: getName(match.t2.p1Id), p2Name: match.t2.p2Id ? getName(match.t2.p2Id) : undefined },
    });
    toast.success("Match Broadcast Started!");
  };

  const addPoint = (team: 1 | 2) => {
    if (match.status !== "playing") return;

    let { t1, t2, serverTeam, serverPlayerIndex, t1LastServedBy, t2LastServedBy, setsHistory, pointsToWin, goldenPoint, bestOfSets } = match;
    let newT1 = { ...t1 };
    let newT2 = { ...t2 };

    const isT1Doubles = !!newT1.p2Id;
    const isT2Doubles = !!newT2.p2Id;

    if (team === 1) {
      newT1.score++;
      if (serverTeam === 1) {
        t1LastServedBy = serverPlayerIndex;
      } else {
        serverTeam = 1;
        serverPlayerIndex = isT1Doubles ? (t1LastServedBy === 0 ? 1 : 0) : 0;
        t1LastServedBy = serverPlayerIndex;
      }
    } else {
      newT2.score++;
      if (serverTeam === 2) {
        t2LastServedBy = serverPlayerIndex;
      } else {
        serverTeam = 2;
        serverPlayerIndex = isT2Doubles ? (t2LastServedBy === 0 ? 1 : 0) : 0;
        t2LastServedBy = serverPlayerIndex;
      }
    }

    let t1WonGame = false;
    let t2WonGame = false;

    if (newT1.score >= pointsToWin && (newT1.score - newT2.score >= 2 || newT1.score === goldenPoint)) {
      t1WonGame = true;
    } else if (newT2.score >= pointsToWin && (newT2.score - newT1.score >= 2 || newT2.score === goldenPoint)) {
      t2WonGame = true;
    }

    let nextStatus: "setup" | "playing" | "finished" = match.status;
    let nextWinner: 1 | 2 | undefined = match.winner;

    if (t1WonGame || t2WonGame) {
      setsHistory = [...setsHistory, `${newT1.score}-${newT2.score}`];
      if (t1WonGame) newT1.games++;
      if (t2WonGame) newT2.games++;
      newT1.score = 0;
      newT2.score = 0;

      const gamesToWin = Math.ceil(bestOfSets / 2);
      if (newT1.games >= gamesToWin) {
        nextStatus = "finished";
        nextWinner = 1;
      } else if (newT2.games >= gamesToWin) {
        nextStatus = "finished";
        nextWinner = 2;
      } else {
        serverTeam = t1WonGame ? 1 : 2;
      }
    }

    updateMatch({
      t1: newT1,
      t2: newT2,
      serverTeam,
      serverPlayerIndex,
      t1LastServedBy,
      t2LastServedBy,
      setsHistory,
      status: nextStatus,
      winner: nextWinner,
    });
  };

  const deductPoint = (team: 1 | 2) => {
    if (match.status !== "playing") return;
    let { t1, t2 } = match;
    if (team === 1 && t1.score > 0) updateMatch({ t1: { ...t1, score: t1.score - 1 } });
    if (team === 2 && t2.score > 0) updateMatch({ t2: { ...t2, score: t2.score - 1 } });
  };

  const saveMatchToProfile = async () => {
    if (match.status !== "finished") return;
    
    const isT1P1Real = players.some(p => p.id === match.t1.p1Id);
    if (!isT1P1Real) {
      toast.info("Match ended. Cannot log to profile because players are guests.");
      handleClose();
      return;
    }

    const t1IsWinner = match.winner === 1;
    let finalScoreStr = match.setsHistory.join(", ");
    
    if (match.category === "Doubles") {
       const catStr = match.isFriendly ? "Friendly Doubles" : "Tournament Doubles";
       finalScoreStr += ` [${catStr}: ${match.t1.p1Name}+${match.t1.p2Name} vs ${match.t2.p1Name}+${match.t2.p2Name}]`;
    }

    try {
      const payload = {
        submitter_id: t1IsWinner ? match.t1.p1Id : match.t2.p1Id,
        opponent_id: t1IsWinner ? match.t2.p1Id : match.t1.p1Id,
        match_winner_id: t1IsWinner ? match.t1.p1Id : match.t2.p1Id,
        match_score: finalScoreStr,
        submitter_partner_id: match.t1.p2Id || null,
        opponent_partner_id: match.t2.p2Id || null,
        match_category: match.isFriendly ? "friendly" : "tournament"
      };

      await supabase.rpc("submit_friendly_match", payload);

      if (!match.isFriendly) {
         const { data: latestMatch } = await supabase.from("matches").select("id").eq("submitted_by", payload.submitter_id).eq("status", "pending").order("created_at", { ascending: false }).limit(1).single();
         if (latestMatch) {
            await supabase.from("matches").update({ is_friendly: false, round: match.matchNumber || "Tournament" }).eq("id", latestMatch.id);
            // Auto confirm for tournament matches (admin umpired)
            await supabase.rpc("confirm_friendly_match", { match_id: latestMatch.id });
         }
      }
      
      const notifMsg = `🏆 ${match.isFriendly ? 'Friendly' : 'Tournament'} Match Result: ${match.t1.p1Name} ${match.t1.p2Name ? `& ${match.t1.p2Name}` : ''} vs ${match.t2.p1Name} ${match.t2.p2Name ? `& ${match.t2.p2Name}` : ''} (${match.setsHistory.join(", ")})`;
      await supabase.from("site_data").upsert({ key: "match_alert", value: { message: notifMsg, time: Date.now() } });

      toast.success("Match saved to players' profiles!");
      handleClose();
    } catch (err: any) {
      toast.error("Failed to save match: " + err.message);
    }
  };

  const handleClose = async () => {
    const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").single();
    const liveMatches = data?.value || {};
    delete liveMatches[userId];
    await supabase.from("site_data").upsert({ key: "live_matches", value: liveMatches });
    onClose();
  };

  if (match.status === "setup") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 text-white max-w-xl mx-auto shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> Match Setup
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {canRunTournament && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMatch({ ...match, isFriendly: true })}
                className={`py-3 rounded-xl font-bold text-sm border ${match.isFriendly ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
              >
                Friendly Match
              </button>
              <button
                onClick={() => setMatch({ ...match, isFriendly: false })}
                className={`py-3 rounded-xl font-bold text-sm border ${!match.isFriendly ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
              >
                Tournament Match
              </button>
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


          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Points</label>
              <select
                value={match.pointsToWin}
                onChange={(e) => {
                  const pts = parseInt(e.target.value);
                  setMatch({ ...match, pointsToWin: pts, goldenPoint: pts === 21 ? 30 : pts === 15 ? 21 : pts === 11 ? 15 : 30 });
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
              >
                <option value={11}>11 Points</option>
                <option value={15}>15 Points</option>
                <option value={21}>21 Points</option>
                <option value={30}>30 Points</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Sets</label>
              <select
                value={match.bestOfSets}
                onChange={(e) => setMatch({ ...match, bestOfSets: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
              >
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Cap</label>
              <input
                type="number"
                value={match.goldenPoint}
                onChange={(e) => setMatch({ ...match, goldenPoint: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Team 1</label>
              <div className="space-y-2">
                <PlayerSelect value={match.t1.p1Id} onChange={(v) => setMatch({ ...match, t1: { ...match.t1, p1Id: v } })} players={players} placeholder="Player 1 Name" />
                <PlayerSelect value={match.t1.p2Id || ""} onChange={(v) => setMatch({ ...match, t1: { ...match.t1, p2Id: v } })} players={players} placeholder="Player 2 Name (Optional for Singles)" />
              </div>
            </div>
            <div className="text-center text-slate-500 font-black italic">VS</div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Team 2</label>
              <div className="space-y-2">
                <PlayerSelect value={match.t2.p1Id} onChange={(v) => setMatch({ ...match, t2: { ...match.t2, p1Id: v } })} players={players} placeholder="Player 1 Name" />
                <PlayerSelect value={match.t2.p2Id || ""} onChange={(v) => setMatch({ ...match, t2: { ...match.t2, p2Id: v } })} players={players} placeholder="Player 2 Name (Optional for Singles)" />
              </div>
            </div>
          </div>

          <button onClick={startMatch} className="w-full py-4 mt-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] transition">
            Start Broadcasting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 sm:p-10 text-white max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-sm mb-1">
            <Activity className="w-5 h-5 animate-pulse" /> Live Umpire
          </div>
          <div className="text-slate-400 text-xs font-bold">
            {match.isFriendly ? "Friendly Match" : `Tournament • ${match.matchNumber || "No Number"}`} • {match.category} • Best of {match.bestOfSets} ({match.pointsToWin} pts)
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {match.status === "playing" && (
            <>
              <button onClick={() => setIsDirectScoreOpen(true)} className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700">
                Direct Score
              </button>
              <button onClick={() => updateMatch({ status: "setup" })} className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700">
                Edit Setup
              </button>
            </>
          )}
          <button onClick={handleClose} className="px-4 py-2 bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl hover:bg-rose-500/30">
            Abort Match
          </button>
        </div>
      </div>

      {isDirectScoreOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-black mb-4 text-white">Enter Final Score</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Winner</label>
                <div className="flex gap-2">
                  <button onClick={() => setDirectWinner(1)} className={`flex-1 py-3 rounded-xl font-bold transition ${directWinner === 1 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>Team 1</button>
                  <button onClick={() => setDirectWinner(2)} className={`flex-1 py-3 rounded-xl font-bold transition ${directWinner === 2 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>Team 2</button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Set Scores (e.g. 21-15, 21-18)</label>
                <input 
                  type="text" 
                  value={directSetsText}
                  onChange={e => setDirectSetsText(e.target.value)}
                  placeholder="21-15, 21-18"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setIsDirectScoreOpen(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold">Cancel</button>
                <button 
                  onClick={() => {
                    if (!directWinner || !directSetsText) { toast.error("Please fill all fields"); return; }
                    const sets = directSetsText.split(",").map(s => s.trim());
                    updateMatch({ status: "finished", winner: directWinner, setsHistory: sets });
                    setIsDirectScoreOpen(false);
                  }} 
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold"
                >
                  Save Score
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {match.status === "finished" ? (
        <div className="text-center py-12">
          <Trophy className="w-20 h-20 mx-auto text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
          <h2 className="text-3xl font-black mb-2">Match Finished!</h2>
          <p className="text-xl text-slate-300 mb-8">
            {match.winner === 1 ? match.t1.p1Name : match.t2.p1Name} Won {match.setsHistory.join(", ")}
          </p>
          <button onClick={saveMatchToProfile} className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black uppercase tracking-wider shadow-xl flex items-center gap-2 mx-auto">
            <Save className="w-5 h-5" /> Save to Profile & Notify
          </button>
        </div>
      ) : (
        <>
        {/* ── Break Timer ── */}
        {breakSecondsLeft !== null ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Timer className="w-10 h-10 text-amber-400 animate-pulse" />
            <div className="text-7xl font-black tabular-nums text-amber-400">
              {Math.floor(breakSecondsLeft / 60).toString().padStart(2, "0")}:{(breakSecondsLeft % 60).toString().padStart(2, "0")}
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Break in progress</p>
            <button onClick={() => { clearInterval(breakIntervalRef.current!); breakIntervalRef.current = null; setBreakSecondsLeft(null); }} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm">
              End Break
            </button>
          </div>
        ) : (
          <div className="flex gap-2 justify-center mb-6 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest self-center">Break:</span>
            {[["30s", 30], ["1 min", 60], ["2 min", 120]].map(([label, secs]) => (
              <button key={label as string} onClick={() => startBreak(secs as number)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5">
                <Timer className="w-3 h-3" />{label}
              </button>
            ))}
          </div>
        )}
        {/* ── Court Visual ── */}
        <div className="flex justify-center mb-6" style={breakSecondsLeft !== null ? { opacity: 0.3 } : {}}>
          <CourtVisual 
            serverTeam={match.serverTeam} 
            serverPlayerIndex={match.serverPlayerIndex}
            t1Name={match.t1.p1Name} 
            t2Name={match.t2.p1Name} 
            t1P2Name={match.t1.p2Name}
            t2P2Name={match.t2.p2Name}
            isDoubles={!!match.t1.p2Id} 
            onSwitchServer={() => {
              updateMatch({ serverPlayerIndex: match.serverPlayerIndex === 0 ? 1 : 0 });
            }}
          />
        </div>

        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center" style={breakSecondsLeft !== null ? { opacity: 0.3, pointerEvents: "none" } : {}}>
          <div className={`p-6 rounded-3xl border-2 transition-all ${match.serverTeam === 1 ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold truncate">{match.t1.p1Name}</h3>
              {match.t1.p2Name && <h3 className="text-xl font-bold truncate">{match.t1.p2Name}</h3>}
              <div className="text-emerald-400 font-black text-sm mt-2 flex items-center justify-center gap-1 min-h-[20px]">
                {match.serverTeam === 1 && <><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Serving</>}
              </div>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="text-[8rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md">
                {match.t1.score}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button onClick={() => deductPoint(1)} className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center border border-slate-700">
                <Minus className="w-6 h-6 text-slate-400" />
              </button>
              <button onClick={() => addPoint(1)} className="w-24 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Plus className="w-8 h-8 text-emerald-950" />
              </button>
            </div>
            
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < match.t1.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
              ))}
            </div>
          </div>

          <div className="text-4xl font-black italic text-slate-700 text-center py-4">VS</div>

          <div className={`p-6 rounded-3xl border-2 transition-all ${match.serverTeam === 2 ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold truncate">{match.t2.p1Name}</h3>
              {match.t2.p2Name && <h3 className="text-xl font-bold truncate">{match.t2.p2Name}</h3>}
              <div className="text-emerald-400 font-black text-sm mt-2 flex items-center justify-center gap-1 min-h-[20px]">
                {match.serverTeam === 2 && <><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Serving</>}
              </div>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="text-[8rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md">
                {match.t2.score}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button onClick={() => deductPoint(2)} className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center border border-slate-700">
                <Minus className="w-6 h-6 text-slate-400" />
              </button>
              <button onClick={() => addPoint(2)} className="w-24 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Plus className="w-8 h-8 text-emerald-950" />
              </button>
            </div>
            
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < match.t2.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
              ))}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
