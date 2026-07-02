import { ArrowLeftRight, Flag, X, AlertTriangle, Timer } from "lucide-react";
import { toast } from "sonner";
import type { BwfMatchState, CardTarget, CardType } from "@/types/umpire";

export function ChangeEndsModal({
  reason,
  onConfirm
}: {
  reason: string;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-6 text-center w-full max-w-sm shadow-2xl gap-5">
        <ArrowLeftRight className="w-14 h-14 text-amber-400" />
        <h2 className="text-2xl font-black text-foreground uppercase tracking-wider">Change Ends</h2>
        <p className="text-muted-foreground font-bold text-sm max-w-xs">{reason}</p>
        <div className="flex items-center justify-center gap-2 text-amber-400 text-sm font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Players change sides of the court now
        </div>
        <button
          onClick={onConfirm}
          className="mt-2 w-full py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl font-black uppercase tracking-widest shadow-xl transition"
        >
          Ends Changed ✓
        </button>
      </div>
    </div>
  );
}

export function DisciplineCardModal({
  match,
  cards,
  cardTarget,
  setCardTarget,
  onClose,
  onIssueCard
}: {
  match: BwfMatchState;
  cards: Record<CardTarget, CardType[]>;
  cardTarget: CardTarget | null;
  setCardTarget: (target: CardTarget | null) => void;
  onClose: () => void;
  onIssueCard: (target: CardTarget, cardType: CardType) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col items-start justify-start bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between w-full mb-6">
        <h2 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
          <Flag className="w-5 h-5 text-amber-400" /> Issue Discipline Card
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-muted-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

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

      {cardTarget && (
        <div className="w-full space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select card for: <span className="text-foreground">{
            cardTarget === "t1p1" ? match.t1.p1Name
            : cardTarget === "t1p2" ? match.t1.p2Name
            : cardTarget === "t2p1" ? match.t2.p1Name
            : match.t2.p2Name
          }</span></p>
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => onIssueCard(cardTarget, "yellow")} className="py-4 rounded-2xl font-black text-sm bg-yellow-400/20 border border-yellow-400 text-yellow-300 hover:bg-yellow-400/30 transition">
              ⚠️ Yellow<br/><span className="text-xs font-normal opacity-70">Warning</span>
            </button>
            <button onClick={() => onIssueCard(cardTarget, "red")} className="py-4 rounded-2xl font-black text-sm bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 transition">
              🟥 Red<br/><span className="text-xs font-normal opacity-70">+1 pt opponent</span>
            </button>
            <button onClick={() => onIssueCard(cardTarget, "black")} className="py-4 rounded-2xl font-black text-sm bg-slate-700/80 border border-slate-400 text-foreground hover:bg-slate-600 transition">
              ⬛ Black<br/><span className="text-xs font-normal opacity-70">Disqualify</span>
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export function RetireModal({
  match,
  onRetire,
  onClose
}: {
  match?: any;
  onRetire: (team: 1 | 2) => void;
  onClose: () => void;
}) {
  const t1Name = match ? (match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "")) : "Team 1";
  const t2Name = match ? (match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "")) : "Team 2";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-6 text-center w-full max-w-sm shadow-2xl gap-5">
        <AlertTriangle className="w-12 h-12 text-rose-400" />
        <h2 className="text-xl font-black text-foreground uppercase tracking-wider">Match Retirement</h2>
        <p className="text-muted-foreground text-sm">Which team is retiring from the match?</p>
        <div className="flex flex-col gap-3 w-full">
          <button onClick={() => onRetire(1)} className="w-full py-3 px-4 bg-rose-500/20 border border-rose-500 text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-500/30 transition">
            {t1Name}
          </button>
          <button onClick={() => onRetire(2)} className="w-full py-3 px-4 bg-rose-500/20 border border-rose-500 text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-500/30 transition">
            {t2Name}
          </button>
        </div>
        <button onClick={onClose} className="text-muted-foreground text-sm hover:text-slate-300 transition mt-2">Cancel</button>
      </div>
    </div>
  );
}

export function DirectScoreModal({
  directWinner,
  setDirectWinner,
  directSetsText,
  setDirectSetsText,
  onSave,
  onClose,
  team1Label = "Team 1",
  team2Label = "Team 2",
  match
}: {
  directWinner: 1 | 2 | null;
  setDirectWinner: (w: 1 | 2 | null) => void;
  directSetsText: string;
  setDirectSetsText: (t: string) => void;
  onSave: () => void;
  onClose: () => void;
  team1Label?: string;
  team2Label?: string;
  match?: any;
}) {
  const sets = directSetsText ? directSetsText.split(",").map(s => s.trim()) : [];
  const parsedSets = [0, 1, 2, 3, 4].map(i => {
    const s = sets[i] || "";
    const [t1, t2] = s.split("-");
    return { t1: t1 || "", t2: t2 || "" };
  });

  const handleSetChange = (idx: number, team: 1 | 2, val: string) => {
    const newSets = [...parsedSets];
    if (team === 1) newSets[idx].t1 = val;
    else newSets[idx].t2 = val;
    
    const validSets = newSets.filter((s, i) => i <= idx || s.t1 !== "" || s.t2 !== ""); // Keep sets up to the highest edited
    const str = validSets.map(s => `${s.t1 || "0"}-${s.t2 || "0"}`).join(",");
    setDirectSetsText(str);
  };

  const t1Name = match ? (match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "")) : team1Label;
  const t2Name = match ? (match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "")) : team2Label;

  const bestOfSets = match?.bestOfSets || 3;
  const lastFilledSetIdx = parsedSets.findLastIndex(s => s.t1 !== "" || s.t2 !== "");
  const setsToShow = Math.min(bestOfSets, Math.max(1, lastFilledSetIdx + 2));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pb-20">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full shadow-2xl max-h-[75dvh] flex flex-col">
        
        <div className="p-6 pb-4 shrink-0 border-b border-slate-800">
          <h3 className="text-xl font-black text-foreground">Enter Final Score</h3>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Winner</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => setDirectWinner(1)} className={`flex-1 py-3 px-2 rounded-xl font-bold transition text-sm ${directWinner === 1 ? "bg-primary text-primary-foreground" : "bg-slate-800 text-muted-foreground"}`}>{t1Name || "Team 1"}</button>
              <button onClick={() => setDirectWinner(2)} className={`flex-1 py-3 px-2 rounded-xl font-bold transition text-sm ${directWinner === 2 ? "bg-sky-500 text-foreground" : "bg-slate-800 text-muted-foreground"}`}>{t2Name || "Team 2"}</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-3">Set Scores</label>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_1fr] bg-slate-800 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <div className="p-3 text-center border-r border-slate-700">Set</div>
                <div className="p-3 text-center border-r border-slate-700 truncate px-2" title={t1Name}>{t1Name || "Team 1"}</div>
                <div className="p-3 text-center truncate px-2" title={t2Name}>{t2Name || "Team 2"}</div>
              </div>
              {Array.from({ length: setsToShow }).map((_, idx) => (
                <div key={idx} className="grid grid-cols-[auto_1fr_1fr] border-t border-slate-700/50">
                  <div className="p-3 flex items-center justify-center font-black text-muted-foreground border-r border-slate-700 bg-slate-800/30 w-12">{idx + 1}</div>
                  <div className="p-2 border-r border-slate-700">
                    <input 
                      type="number" 
                      value={parsedSets[idx].t1} 
                      onChange={e => handleSetChange(idx, 1, e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-center text-primary font-bold outline-none focus:border-primary" 
                    />
                  </div>
                  <div className="p-2">
                    <input 
                      type="number" 
                      value={parsedSets[idx].t2} 
                      onChange={e => handleSetChange(idx, 2, e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-center text-sky-400 font-bold outline-none focus:border-sky-500" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-slate-700 shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-foreground rounded-xl font-bold transition">Cancel</button>
          <button onClick={() => {
            if (!directWinner || !directSetsText) { toast.error("Fill winner and at least 1 set"); return; }
            onSave();
          }} className="flex-[2] py-3 bg-primary hover:bg-primary text-primary-foreground rounded-xl font-bold transition">Save Score</button>
        </div>
        
      </div>
    </div>
  );
}

export function ConfirmActionModal({
  title,
  message,
  confirmLabel = "Confirm",
  confirmColor = "bg-rose-600 hover:bg-rose-500",
  icon: Icon = AlertTriangle,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  icon?: any;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-6 text-center w-full max-w-sm shadow-2xl">
        <Icon className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl sm:text-2xl font-black text-foreground uppercase tracking-wider mb-2">{title}</h2>
        <p className="text-muted-foreground font-bold text-xs sm:text-sm mb-6">{message}</p>
        
        <div className="flex w-full gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-foreground font-bold text-sm rounded-2xl transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 text-foreground font-bold text-sm rounded-2xl shadow-lg transition ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
