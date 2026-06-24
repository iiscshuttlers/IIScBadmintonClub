import { PlayerRank, useLeaderboardState } from "@/hooks/useLeaderboardState";
import { LeaderboardControls } from "./LeaderboardControls";
import { LeaderboardHighlights } from "./LeaderboardHighlights";
import { LeaderboardPodium } from "./LeaderboardPodium";
import { LeaderboardTable } from "./LeaderboardTable";

interface LeaderboardProps {
  players: PlayerRank[];
}

export function LeaderboardSection({ players }: LeaderboardProps) {
  const state = useLeaderboardState(players);

  return (
    <div className="pb-24 font-sans">
      <div className="mt-8 relative z-20">
        <LeaderboardControls
          activeTab={state.activeTab}
          setActiveTab={state.setActiveTab}
          categoryFilter={state.categoryFilter}
          setCategoryFilter={state.setCategoryFilter}
          ironmanFilter={state.ironmanFilter}
          setIronmanFilter={state.setIronmanFilter}
          exportLeaderboard={state.exportLeaderboard}
        />

        {state.activeTab === "elo" && (
          <LeaderboardHighlights
            upsets={state.upsets}
            activeStreaks={state.activeStreaks}
          />
        )}

        <LeaderboardPodium
          top3={state.top3}
          activeTab={state.activeTab}
          ironmanFilter={state.ironmanFilter}
          monthlyCounts={state.monthlyCounts}
          getCategoryElo={state.getCategoryElo}
          getCategoryRecord={state.getCategoryRecord}
          getMatchesCount={state.getMatchesCount}
          displayRecord={state.displayRecord}
          lastEloChange={state.lastEloChange}
        />

        <LeaderboardTable
          rest={state.rest}
          activeTab={state.activeTab}
          allStreaks={state.allStreaks}
          getCategoryElo={state.getCategoryElo}
          getCategoryRecord={state.getCategoryRecord}
          getMatchesCount={state.getMatchesCount}
          displayRecord={state.displayRecord}
          lastEloChange={state.lastEloChange}
          eloHistory={state.eloHistory}
        />
      </div>
    </div>
  );
}
