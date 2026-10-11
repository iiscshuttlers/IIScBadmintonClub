import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { PlayerPreviewModal, ClickablePlayerData } from '@/components/players-directory/PlayerPreviewModal';

interface PlayerModalContextType {
  openPlayerModal: (player: ClickablePlayerData | string) => void;
  closePlayerModal: () => void;
}

const PlayerModalContext = createContext<PlayerModalContextType | undefined>(undefined);

export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<ClickablePlayerData | string | null>(null);

  const openPlayerModal = useCallback((player: ClickablePlayerData | string) => {
    if (!player) return;
    setSelectedPlayer(player);
    setIsOpen(true);
  }, []);

  const closePlayerModal = useCallback(() => {
    setIsOpen(false);
    setSelectedPlayer(null);
  }, []);

  return (
    <PlayerModalContext.Provider value={{ openPlayerModal, closePlayerModal }}>
      {children}
      {selectedPlayer && (
        <PlayerPreviewModal
          isOpen={isOpen}
          onClose={closePlayerModal}
          player={selectedPlayer}
        />
      )}
    </PlayerModalContext.Provider>
  );
}

export function usePlayerModal() {
  const context = useContext(PlayerModalContext);
  if (!context) {
    return {
      openPlayerModal: () => {},
      closePlayerModal: () => {}
    };
  }
  return context;
}
