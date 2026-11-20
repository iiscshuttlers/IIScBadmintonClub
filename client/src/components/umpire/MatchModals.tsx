import { ArrowLeftRight, Flag, X, AlertTriangle, Timer } from "lucide-react";
import { toast } from "sonner";
import type { BwfMatchState, CardTarget, CardType } from "@/types/umpire";

export function ChangeEndsModal({
  reason,
  title = "Change Ends",
  onConfirm
}: {
  reason: string;
  /** "Change Ends" for a genuine side switch, "Interval" for a plain break. */
  title?: string;
  onConfirm: () => void;
}) {
  const isChangingEnds = title === "Change Ends";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-media/80 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center bg-card border border-border-strong rounded-3xl p-6 sm:p-6 text-center w-full max-w-sm shadow-2xl gap-5">
        {isChangingEnds
          ? <ArrowLeftRight className="w-14 h-14 text-warning" />
          : <Timer className="w-14 h-14 text-warning" />}
        <h2 className="text-2xl font-black text-foreground uppercase tracking-wider">{title}</h2>
        <p className="text-muted-foreground font-bold text-sm max-w-xs">{reason}</p>
        <div className="flex items-center justify-center gap-2 text-warning text-sm font-bold">
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          {isChangingEnds
            ? "Players change sides of the court now"
            : "60 second interval — players stay on their ends"}
        </div>
        <button
          onClick={onConfirm}
          className="mt-2 w-full py-4 bg-warning hover:bg-warning/90 text-warning-foreground rounded-2xl font-black uppercase tracking-widest shadow-xl transition"
        >
          {isChangingEnds ? "Ends Changed ✓" : "Resume Play ✓"}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-media/80 backdrop-blur-sm p-4">
      <div className="flex flex-col items-start justify-start bg-card border border-border-strong rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between w-full mb-6">
        <h2 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
          <Flag className="w-5 h-5 text-warning" /> Issue Discipline Card
        </h2>
        <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-muted rounded-full text-muted-foreground">
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
            className={`py-3 px-4 rounded-xl font-bold text-sm border text-left transition ${cardTarget === key ? "bg-warning/20 border-warning text-warning" : "bg-muted border-border-strong text-soft"}`}
          >
            {label}
            {cards[key].map((c, i) => (
              <span key={i} className={`inline-block w-2.5 h-2.5 rounded-sm ml-1 ${c === "yellow" ? "bg-warning" : c === "red" ? "bg-danger" : "bg-foreground border border-border-strong"}`} />
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
            <button onClick={() => onIssueCard(cardTarget, "yellow")} className="py-4 rounded-2xl font-black text-sm bg-warning/20 border border-warning text-warning hover:bg-warning/30 transition">
              ⚠️ Yellow<br/><span className="text-xs font-normal opacity-70">Warning</span>
            </button>
            <button onClick={() => onIssueCard(cardTarget, "red")} className="py-4 rounded-2xl font-black text-sm bg-danger/20 border border-danger text-danger hover:bg-danger/30 transition">
              🟥 Red<br/><span className="text-xs font-normal opacity-70">+1 pt opponent</span>
            </button>
            <button onClick={() => onIssueCard(cardTarget, "black")} className="py-4 rounded-2xl font-black text-sm bg-muted-strong/80 border border-border-strong text-on-accent hover:bg-faint transition">
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-media/80 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center justify-center bg-card border border-border-strong rounded-3xl p-6 sm:p-6 text-center w-full max-w-sm shadow-2xl gap-5">
        <AlertTriangle className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-black text-foreground uppercase tracking-wider">Match Retirement</h2>
        <p className="text-muted-foreground text-sm">Which team is retiring from the match?</p>
        <div className="flex flex-col gap-3 w-full">
          <button onClick={() => onRetire(1)} className="w-full py-3 px-4 bg-danger/20 border border-danger text-danger rounded-xl font-bold text-sm hover:bg-danger/30 transition">
            {t1Name}
          </button>
          <button onClick={() => onRetire(2)} className="w-full py-3 px-4 bg-danger/20 border border-danger text-danger rounded-xl font-bold text-sm hover:bg-danger/30 transition">
            {t2Name}
          </button>
        </div>
        <button onClick={onClose} className="text-muted-foreground text-sm hover:text-soft transition mt-2">Cancel</button>
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
    const str = validSets.map(s => `${s.t1}-${s.t2}`).join(",");
    setDirectSetsText(str);
  };

  const t1Name = match ? (match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "")) : team1Label;
  const t2Name = match ? (match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "")) : team2Label;

  const bestOfSets = match?.bestOfSets || 3;
  const lastFilledSetIdx = parsedSets.findLastIndex(s => s.t1 !== "" || s.t2 !== "");
  const setsToShow = Math.min(bestOfSets, Math.max(1, lastFilledSetIdx + 2));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-media/80 backdrop-blur-sm p-4 pb-20">
      <div className="bg-card border border-border-strong rounded-3xl max-w-lg w-full shadow-2xl max-h-[75dvh] flex flex-col">
        
        <div className="p-6 pb-4 shrink-0 border-b border-border">
          <h3 className="text-xl font-black text-foreground">Enter Final Score</h3>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Winner</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => setDirectWinner(1)} className={`flex-1 py-3 px-2 rounded-xl font-bold transition text-sm ${directWinner === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t1Name || "Team 1"}</button>
              <button onClick={() => setDirectWinner(2)} className={`flex-1 py-3 px-2 rounded-xl font-bold transition text-sm ${directWinner === 2 ? "bg-info text-on-accent" : "bg-muted text-muted-foreground"}`}>{t2Name || "Team 2"}</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-3">Set Scores</label>
            <div className="bg-muted/50 rounded-2xl border border-border-strong overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_1fr] bg-muted text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <div className="p-3 text-center border-r border-border-strong">Set</div>
                <div className="p-3 text-center border-r border-border-strong truncate px-2" title={t1Name}>{t1Name || "Team 1"}</div>
                <div className="p-3 text-center truncate px-2" title={t2Name}>{t2Name || "Team 2"}</div>
              </div>
              {Array.from({ length: setsToShow }).map((_, idx) => (
                <div key={idx} className="grid grid-cols-[auto_1fr_1fr] border-t border-border-strong/50">
                  <div className="p-3 flex items-center justify-center font-black text-muted-foreground border-r border-border-strong bg-muted/30 w-12">{idx + 1}</div>
                  <div className="p-2 border-r border-border-strong">
                    <input 
                      type="number" 
                      value={parsedSets[idx].t1} 
                      onChange={e => handleSetChange(idx, 1, e.target.value)} 
                      className="w-full bg-card border border-border-strong rounded-lg p-2 text-center text-primary font-bold outline-none focus:border-primary" 
                    />
                  </div>
                  <div className="p-2">
                    <input 
                      type="number" 
                      value={parsedSets[idx].t2} 
                      onChange={e => handleSetChange(idx, 2, e.target.value)} 
                      className="w-full bg-card border border-border-strong rounded-lg p-2 text-center text-info font-bold outline-none focus:border-info" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-border-strong shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-muted hover:bg-muted-strong text-on-accent rounded-xl font-bold transition">Cancel</button>
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
  confirmColor = "bg-danger hover:bg-danger/90",
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center bg-card border border-border-strong rounded-3xl p-6 sm:p-6 text-center w-full max-w-sm shadow-2xl">
        <Icon className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-xl sm:text-2xl font-black text-foreground uppercase tracking-wider mb-2">{title}</h2>
        <p className="text-muted-foreground font-bold text-xs sm:text-sm mb-6">{message}</p>
        
        <div className="flex w-full gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-muted hover:bg-muted-strong border border-border-strong text-on-accent font-bold text-sm rounded-2xl transition"
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
