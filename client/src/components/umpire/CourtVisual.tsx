import { isPlayerAtTop, seedRightCourts } from "@/lib/umpire/courtPositions";

export function CourtVisual({
  serverTeam,
  serverPlayerIndex = 0,
  receiverPlayerIndex = 0,
  t1RightCourt,
  t2RightCourt,
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
  receiverPlayerIndex?: 0 | 1;
  /** Which player stands in each team's right service court. */
  t1RightCourt?: 0 | 1;
  t2RightCourt?: 0 | 1;
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
  const leftIsServer  = serverTeam === leftTeam;

  // Court occupancy is the only positional state. Matches saved before these
  // fields existed are seeded from their serve/receive pair. Positions used to
  // be driven by a `receiverP0AtTop` flag that was rewritten every rally from
  // "is the active receiver player 0", so the receiving pair — who must stand
  // still while the serving pair swaps courts — teleported on every point.
  const { t1Right, t2Right } = seedRightCourts({
    serverTeam,
    serverPlayerIndex,
    receiverPlayerIndex,
    serverScore,
    t1RightCourt,
    t2RightCourt,
  });
  const rightCourtOf = (side: "left" | "right") =>
    (side === "left") === t1OnLeft ? t1Right : t2Right;

  const nameColor = (side: "left" | "right", pIdx: 0 | 1) => {
    const sideIsServer = side === "left" ? leftIsServer : !leftIsServer;
    if (sideIsServer && serverPlayerIndex === pIdx) return "text-primary";
    if (!sideIsServer && (!isDoubles || pIdx === receiverPlayerIndex)) return "text-amber-400/80";
    return "text-muted-foreground";
  };

  const topPct = (side: "left" | "right", pIdx: 0 | 1) => {
    const onLeft = side === "left";

    if (!isDoubles) {
      // In singles there is one player per side, and they change service court
      // themselves on every point, so position follows score parity directly.
      return onLeft ? (isEven ? "63%" : "12%") : (isEven ? "12%" : "63%");
    }

    return isPlayerAtTop(pIdx, rightCourtOf(side), onLeft) ? "12%" : "63%";
  };

  return (
    <div className="relative w-52 h-32 md:w-64 md:h-40 select-none" title="Court">
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
            className={`absolute w-full truncate text-[9px] md:text-[11px] font-black uppercase ${nameColor("left", 0)} ${onSwitchServer && leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
            style={{ top: topPct("left", 0) }}
            onClick={onSwitchServer && leftIsServer ? onSwitchServer : undefined}
          >
            {leftP1Name || "T1"}
            {leftIsServer && serverPlayerIndex === 0 && <span className="block text-[7px] text-primary">SERVER</span>}
            {!leftIsServer && (!isDoubles || receiverPlayerIndex === 0) && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
          </div>
          {isDoubles && leftP2Name && (
            <div
              className={`absolute w-full truncate text-[9px] md:text-[11px] font-black uppercase ${nameColor("left", 1)} ${onSwitchServer && leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
              style={{ top: topPct("left", 1) }}
              onClick={onSwitchServer && leftIsServer ? onSwitchServer : undefined}
            >
              {leftP2Name}
              {leftIsServer && serverPlayerIndex === 1 && <span className="block text-[7px] text-primary">SERVER</span>}
              {!leftIsServer && receiverPlayerIndex === 1 && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
            </div>
          )}
        </div>
        {/* Right side */}
        <div className="relative flex flex-col h-full w-[44%] text-right items-end">
          <div
            className={`absolute w-full truncate text-[9px] md:text-[11px] font-black uppercase ${nameColor("right", 0)} ${onSwitchServer && !leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
            style={{ top: topPct("right", 0) }}
            onClick={onSwitchServer && !leftIsServer ? onSwitchServer : undefined}
          >
            {rightP1Name || "T2"}
            {!leftIsServer && serverPlayerIndex === 0 && <span className="block text-[7px] text-primary">SERVER</span>}
            {leftIsServer && (!isDoubles || receiverPlayerIndex === 0) && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
          </div>
          {isDoubles && rightP2Name && (
            <div
              className={`absolute w-full truncate text-[9px] md:text-[11px] font-black uppercase ${nameColor("right", 1)} ${onSwitchServer && !leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
              style={{ top: topPct("right", 1) }}
              onClick={onSwitchServer && !leftIsServer ? onSwitchServer : undefined}
            >
              {rightP2Name}
              {!leftIsServer && serverPlayerIndex === 1 && <span className="block text-[7px] text-primary">SERVER</span>}
              {leftIsServer && receiverPlayerIndex === 1 && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground font-bold uppercase tracking-widest pointer-events-none">NET</div>
    </div>
  );
}
