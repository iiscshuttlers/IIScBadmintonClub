import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export type AppMode = 'club' | 'personal';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const [mode, setModeState] = useState<AppMode>(() => {
    // Logged-out users always default to Club mode
    if (!session) {
      return 'club';
    }

    // Logged-in users get their stored preference, default to Club
    const saved = localStorage.getItem('iisc_app_mode');
    return (saved === 'personal' || saved === 'club') ? saved : 'club';
  });

  const setMode = (newMode: AppMode) => {
    // Only allow switching to Personal if logged in
    if (newMode === 'personal' && !session) {
      return;
    }

    setModeState(newMode);
    localStorage.setItem('iisc_app_mode', newMode);
  };

  return (
    <AppModeContext.Provider value={{ mode, setMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
