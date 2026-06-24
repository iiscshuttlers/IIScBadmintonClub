import React from "react";

export function CourtVisual({
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
            {leftIsServer && serverPlayerIndex === 0 && <span className="block text-[7px] text-emerald-500">SERVER</span>}
            {!leftIsServer && (!isDoubles || activeReceiverIndex === 0) && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
          </div>
          {isDoubles && leftP2Name && (
            <div
              className={`absolute w-full truncate text-[9px] md:text-[11px] font-black uppercase ${nameColor("left", 1)} ${onSwitchServer && leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
              style={{ top: topPct("left", 1) }}
              onClick={onSwitchServer && leftIsServer ? onSwitchServer : undefined}
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
            className={`absolute w-full truncate text-[9px] md:text-[11px] font-black uppercase ${nameColor("right", 0)} ${onSwitchServer && !leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
            style={{ top: topPct("right", 0) }}
            onClick={onSwitchServer && !leftIsServer ? onSwitchServer : undefined}
          >
            {rightP1Name || "T2"}
            {!leftIsServer && serverPlayerIndex === 0 && <span className="block text-[7px] text-emerald-500">SERVER</span>}
            {leftIsServer && (!isDoubles || activeReceiverIndex === 0) && <span className="block text-[7px] text-amber-500">RECEIVER</span>}
          </div>
          {isDoubles && rightP2Name && (
            <div
              className={`absolute w-full truncate text-[9px] md:text-[11px] font-black uppercase ${nameColor("right", 1)} ${onSwitchServer && !leftIsServer ? "pointer-events-auto cursor-pointer" : ""}`}
              style={{ top: topPct("right", 1) }}
              onClick={onSwitchServer && !leftIsServer ? onSwitchServer : undefined}
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

