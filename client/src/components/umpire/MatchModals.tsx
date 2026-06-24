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
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm rounded-4xl gap-5 p-8 text-center">
      <ArrowLeftRight className="w-14 h-14 text-amber-400" />
      <h2 className="text-2xl font-black text-white uppercase tracking-wider">Change Ends</h2>
      <p className="text-slate-400 font-bold text-sm max-w-xs">{reason}</p>
      <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Players change sides of the court now
      </div>
      <button
        onClick={onConfirm}
        className="mt-2 px-10 py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl font-black uppercase tracking-widest shadow-xl transition"
      >
        Ends Changed ✓
      </button>
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
    <div className="absolute inset-0 z-50 flex flex-col items-start justify-start bg-slate-950/95 backdrop-blur-sm rounded-4xl p-6 overflow-auto">
      <div className="flex items-center justify-between w-full mb-6">
        <h2 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
          <Flag className="w-5 h-5 text-amber-400" /> Issue Discipline Card
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select card for: <span className="text-white">{
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
            <button onClick={() => onIssueCard(cardTarget, "black")} className="py-4 rounded-2xl font-black text-sm bg-slate-700/80 border border-slate-400 text-white hover:bg-slate-600 transition">
              ⬛ Black<br/><span className="text-xs font-normal opacity-70">Disqualify</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RetireModal({
  onRetire,
  onClose
}: {
  onRetire: (team: 1 | 2) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm rounded-4xl p-8 text-center gap-5">
      <AlertTriangle className="w-12 h-12 text-rose-400" />
      <h2 className="text-xl font-black text-white uppercase tracking-wider">Match Retirement</h2>
      <p className="text-slate-400 text-sm">Which team is retiring from the match?</p>
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={() => onRetire(1)} className="flex-1 py-3 bg-rose-500/20 border border-rose-500 text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-500/30 transition">
          Team 1 Retires
        </button>
        <button onClick={() => onRetire(2)} className="flex-1 py-3 bg-rose-500/20 border border-rose-500 text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-500/30 transition">
          Team 2 Retires
        </button>
      </div>
      <button onClick={onClose} className="text-slate-500 text-sm hover:text-slate-300 transition">Cancel</button>
    </div>
  );
}

export function DirectScoreModal({
  directWinner,
  setDirectWinner,
  directSetsText,
  setDirectSetsText,
  onSave,
  onClose
}: {
  directWinner: 1 | 2 | null;
  setDirectWinner: (w: 1 | 2 | null) => void;
  directSetsText: string;
  setDirectSetsText: (t: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
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
            <button onClick={onClose} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold">Cancel</button>
            <button onClick={() => {
              if (!directWinner || !directSetsText) { toast.error("Fill all fields"); return; }
              onSave();
            }} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold">Save Score</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BreakTimerOverlay({
  breakSecondsLeft,
  breakLabel,
  onEndBreak,
  onClose
}: {
  breakSecondsLeft: number;
  breakLabel: string;
  onEndBreak: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm rounded-4xl gap-5 p-8 text-center">
      <button
        onClick={onClose}
        className="absolute top-4 left-4 flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition"
      >
        ← Back
      </button>
      <Timer className="w-12 h-12 text-amber-400 animate-pulse" />
      <div className="text-8xl font-black tabular-nums text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]">
        {Math.floor(breakSecondsLeft / 60).toString().padStart(2, "0")}:{(breakSecondsLeft % 60).toString().padStart(2, "0")}
      </div>
      {breakLabel && <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center max-w-xs">{breakLabel}</p>}
      <button onClick={onEndBreak} className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold text-sm">End Break</button>
    </div>
  );
}
