import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { TeamDetailModal } from '@/components/events/TeamDetailModal';

export interface ClickableTeamData {
  id: string;
  name: string;
  short_name?: string | null;
  pool?: string | null;
  captain_id?: string | null;
  tournament_id?: string | null;
  logo_url?: string | null;
}

interface TeamModalContextType {
  openTeamModal: (team: ClickableTeamData, initialTab?: 'roster' | 'matches') => void;
  closeTeamModal: () => void;
}

const TeamModalContext = createContext<TeamModalContextType | undefined>(undefined);

export function TeamModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<ClickableTeamData | null>(null);
  const [initialTab, setInitialTab] = useState<'roster' | 'matches'>('roster');

  const openTeamModal = useCallback((team: ClickableTeamData, tab: 'roster' | 'matches' = 'roster') => {
    if (!team || !team.id) return;
    setSelectedTeam(team);
    setInitialTab(tab);
    setIsOpen(true);
  }, []);

  const closeTeamModal = useCallback(() => {
    setIsOpen(false);
    setSelectedTeam(null);
  }, []);

  return (
    <TeamModalContext.Provider value={{ openTeamModal, closeTeamModal }}>
      {children}
      {selectedTeam && (
        <TeamDetailModal
          isOpen={isOpen}
          onClose={closeTeamModal}
          team={selectedTeam}
          initialTab={initialTab}
        />
      )}
    </TeamModalContext.Provider>
  );
}

export function useTeamModal() {
  const context = useContext(TeamModalContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      openTeamModal: () => {},
      closeTeamModal: () => {}
    };
  }
  return context;
}

/**
 * Reusable component to render a team name that opens the team details modal on click
 */
export function ClickableTeamName({
  team,
  className = "",
  showShortName = true,
  fallbackText = "TBD / BYE"
}: {
  team?: ClickableTeamData | null;
  className?: string;
  showShortName?: boolean;
  fallbackText?: string;
}) {
  const { openTeamModal } = useTeamModal();

  if (!team || !team.id) {
    return <span className="text-slate-400 italic text-xs">{fallbackText}</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openTeamModal(team);
      }}
      className={`group inline-flex items-center gap-1.5 font-bold hover:text-primary transition-colors text-left ${className}`}
      title={`Click to view ${team.name} squad roster & match schedule`}
    >
      <span className="group-hover:underline underline-offset-2 decoration-primary">
        {team.name}
      </span>
      {showShortName && team.short_name && (
        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
          {team.short_name}
        </span>
      )}
    </button>
  );
}
