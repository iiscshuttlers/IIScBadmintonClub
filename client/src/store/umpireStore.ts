import { create } from "zustand";
import type { BwfMatchState, CardTarget, CardType } from "@/types/umpire";

interface UmpireStoreState {
  match: BwfMatchState | null;
  cards: Record<CardTarget, CardType[]>;
  
  // Modals & Overlays
  showLog: boolean;
  showChangeEnds: boolean;
  changeEndsReason: string;
  /** Heading for the interval overlay: "Change Ends" vs plain "Interval". */
  changeEndsTitle: string;
  pendingBreakAfterEnds: number | null;
  showCardPanel: boolean;
  cardTarget: CardTarget | null;
  showRetireModal: boolean;
  isEditSetupOpen: boolean;
  showToolsMenu: boolean;
  isDirectScoreOpen: boolean;
  isSaving: boolean;
  
  // Timer State
  showFullTimer: boolean;
  breakSecondsLeft: number | null;
  breakTotalSeconds: number | null;
  breakLabel: string;
  
  // Direct Score edits
  directSetsText: string;
  directWinner: 1 | 2 | null;

  // Actions
  setMatch: (match: BwfMatchState | null) => void;
  updateMatch: (updates: Partial<BwfMatchState>) => void;
  setCards: (cards: Record<CardTarget, CardType[]>) => void;
  
  setShowLog: (show: boolean) => void;
  setShowChangeEnds: (show: boolean) => void;
  setChangeEndsReason: (reason: string) => void;
  setChangeEndsTitle: (title: string) => void;
  setPendingBreakAfterEnds: (seconds: number | null) => void;
  setShowCardPanel: (show: boolean) => void;
  setCardTarget: (target: CardTarget | null) => void;
  setShowRetireModal: (show: boolean) => void;
  setIsEditSetupOpen: (show: boolean) => void;
  setShowToolsMenu: (show: boolean) => void;
  setIsDirectScoreOpen: (show: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  
  setShowFullTimer: (show: boolean) => void;
  setBreakSecondsLeft: (seconds: number | null) => void;
  setBreakTotalSeconds: (seconds: number | null) => void;
  setBreakLabel: (label: string) => void;
  
  setDirectSetsText: (text: string) => void;
  setDirectWinner: (winner: 1 | 2 | null) => void;
  
  reset: () => void;
}

const initialState = {
  match: null,
  cards: { t1p1: [], t1p2: [], t2p1: [], t2p2: [] } as Record<CardTarget, CardType[]>,
  
  showLog: false,
  showChangeEnds: false,
  changeEndsReason: "",
  changeEndsTitle: "Change Ends",
  pendingBreakAfterEnds: null,
  showCardPanel: false,
  cardTarget: null,
  showRetireModal: false,
  isEditSetupOpen: false,
  showToolsMenu: false,
  isDirectScoreOpen: false,
  isSaving: false,
  
  showFullTimer: false,
  breakSecondsLeft: null,
  breakTotalSeconds: null,
  breakLabel: "",
  
  directSetsText: "",
  directWinner: null,
};

export const useUmpireStore = create<UmpireStoreState>((set) => ({
  ...initialState,
  
  setMatch: (match) => set({ match }),
  updateMatch: (updates) => set((state) => ({ 
    match: state.match ? { ...state.match, ...updates } : null 
  })),
  setCards: (cards) => set({ cards }),
  
  setShowLog: (showLog) => set({ showLog }),
  setShowChangeEnds: (showChangeEnds) => set({ showChangeEnds }),
  setChangeEndsReason: (changeEndsReason) => set({ changeEndsReason }),
  setChangeEndsTitle: (changeEndsTitle) => set({ changeEndsTitle }),
  setPendingBreakAfterEnds: (pendingBreakAfterEnds) => set({ pendingBreakAfterEnds }),
  setShowCardPanel: (showCardPanel) => set({ showCardPanel }),
  setCardTarget: (cardTarget) => set({ cardTarget }),
  setShowRetireModal: (showRetireModal) => set({ showRetireModal }),
  setIsEditSetupOpen: (isEditSetupOpen) => set({ isEditSetupOpen }),
  setShowToolsMenu: (showToolsMenu) => set({ showToolsMenu }),
  setIsDirectScoreOpen: (isDirectScoreOpen) => set({ isDirectScoreOpen }),
  setIsSaving: (isSaving) => set({ isSaving }),
  
  setShowFullTimer: (showFullTimer) => set({ showFullTimer }),
  setBreakSecondsLeft: (breakSecondsLeft) => set({ breakSecondsLeft }),
  setBreakTotalSeconds: (breakTotalSeconds) => set({ breakTotalSeconds }),
  setBreakLabel: (breakLabel) => set({ breakLabel }),
  
  setDirectSetsText: (directSetsText) => set({ directSetsText }),
  setDirectWinner: (directWinner) => set({ directWinner }),
  
  reset: () => set(initialState),
}));
