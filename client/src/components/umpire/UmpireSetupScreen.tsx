import React from "react";
import { Play, X } from "lucide-react";
import type { BwfMatchState } from "@/types/umpire";
import type { PlayerSlim as Player } from "@/types";
import type { TournamentMatchForUmpire } from "./UmpireTournamentTab";
import { UmpireSetupFlow } from "./UmpireSetupFlow";

export interface UmpireSetupScreenProps {
  tournamentMatch?: TournamentMatchForUmpire | null;
  match: BwfMatchState;
  setMatch: (match: BwfMatchState) => void;
  players: Player[];
  friendlyOnly: boolean;
  isEditSetupOpen?: boolean;
  setIsEditSetupOpen?: (open: boolean) => void;
  handleClose: () => void;
  getName: (id?: string) => string;
  deduceCategory: () => string;
  startMatch: () => void;
  startTournamentMatch: () => void;
  buddyCheckPassed: boolean;
  selectedPlayerIds: string[];
}

export function UmpireSetupScreen({
  tournamentMatch,
  match,
  setMatch,
  players,
  friendlyOnly,
  isEditSetupOpen = false,
  setIsEditSetupOpen,
  handleClose,
  getName,
  deduceCategory,
  startMatch,
  startTournamentMatch,
  buddyCheckPassed,
  selectedPlayerIds,
}: UmpireSetupScreenProps) {
  if (tournamentMatch) {
    const tm = tournamentMatch;
    const isDoublesMatch = ["MD", "WD", "XD"].includes(tm.category);

    const splitTeamLabel = (label: string | null | undefined): string[] =>
      (label ?? "").split(/[&,]/).map((s) => s.trim()).filter(Boolean);

    const CAT_BADGE: Record<string, string> = {
      MS: "bg-blue-600",
      WS: "bg-pink-600",
      MD: "bg-primary",
      WD: "bg-purple-600",
      XD: "bg-orange-600",
    };
    const badgeCls = CAT_BADGE[tm.category] ?? "bg-slate-600";

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-5 text-on-accent max-w-lg mx-auto shadow-2xl relative">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-[var(--info)] rounded-t-2xl" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg text-foreground shrink-0 ${badgeCls}`}>
              {tm.category}
            </span>
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider truncate">
              {tm.round_name} · {tm.match_code}
            </span>
          </div>
          <button
            onClick={() => handleClose()}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-muted-foreground hover:text-on-accent transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Teams — inline */}
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <span className="text-foreground font-black text-xs truncate flex-1">{tm.team1_label ?? "TBD"}</span>
          <span className="text-[9px] font-black text-rose-400 shrink-0">vs</span>
          <span className="text-foreground font-black text-xs truncate flex-1 text-right">{tm.team2_label ?? "TBD"}</span>
        </div>

        {/* Scoring config (editable) */}
        <div className="bg-slate-800/60 rounded-xl p-3 space-y-2 mb-3 border border-slate-700/50">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Scoring</p>
          <div className="flex gap-1.5">
            {[1, 3, 5].map((sets) => (
              <button
                key={sets}
                onClick={() => setMatch({ ...match, bestOfSets: sets })}
                className={`flex-1 py-1.5 rounded-lg font-black text-xs border transition ${
                  match.bestOfSets === sets
                    ? "bg-[color-mix(in_srgb,var(--info)_20%,transparent)] border-[var(--info)] text-[var(--info)]"
                    : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"
                }`}
              >
                BO{sets}
              </button>
            ))}
            <div className="w-px bg-slate-700 self-stretch" />
            {[11, 15, 21].map((pts) => (
              <button
                key={pts}
                onClick={() =>
                  setMatch({
                    ...match,
                    pointsToWin: pts,
                    goldenPoint: pts === 21 ? 30 : pts === 15 ? 21 : 15,
                  })
                }
                className={`flex-1 py-1.5 rounded-lg font-black text-xs border transition ${
                  match.pointsToWin === pts
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"
                }`}
              >
                {pts}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground shrink-0">GP cap:</span>
            <input
              type="number"
              value={match.goldenPoint}
              onChange={(e) => setMatch({ ...match, goldenPoint: parseInt(e.target.value) || 30 })}
              className="w-14 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-center text-xs font-bold text-amber-400 outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* Server selection */}
        <div className="bg-slate-800/60 rounded-xl p-3 space-y-2 mb-3 border border-slate-700/50">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">First Server</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { team: 1, label: tm.team1_label ?? "Team 1" },
              { team: 2, label: tm.team2_label ?? "Team 2" },
            ].map(({ team, label }) => (
              <button
                key={team}
                onClick={() =>
                  setMatch({
                    ...match,
                    serverTeam: team as 1 | 2,
                    serverPlayerIndex: 0,
                    receiverPlayerIndex: 0,
                  })
                }
                className={`py-2 px-2 rounded-lg font-black text-xs border transition text-center truncate ${
                  match.serverTeam === team
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {isDoublesMatch && (
            <>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pt-0.5">
                Server within team
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[0, 1].map((idx) => {
                  const teamLabel = match.serverTeam === 1 ? tm.team1_label : tm.team2_label;
                  const names = splitTeamLabel(teamLabel);
                  if (idx === 1 && names.length < 2) return null;
                  const name = names[idx] ?? `Player ${idx + 1}`;
                  return (
                    <button
                      key={idx}
                      onClick={() => setMatch({ ...match, serverPlayerIndex: idx as 0 | 1 })}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-black border transition truncate ${
                        match.serverPlayerIndex === idx
                          ? "bg-[color-mix(in_srgb,var(--info)_20%,transparent)] border-[var(--info)] text-[var(--info)]"
                          : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>

              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pt-0.5">
                First Receiver <span className="normal-case text-muted-foreground">(BWF 9.4)</span>
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[0, 1].map((idx) => {
                  const receivingLabel = match.serverTeam === 1 ? tm.team2_label : tm.team1_label;
                  const names = splitTeamLabel(receivingLabel);
                  if (idx === 1 && names.length < 2) return null;
                  const name = names[idx] ?? `Player ${idx + 1}`;
                  return (
                    <button
                      key={idx}
                      onClick={() => setMatch({ ...match, receiverPlayerIndex: idx as 0 | 1 })}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-black border transition truncate ${
                        match.receiverPlayerIndex === idx
                          ? "bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] border-[var(--warning)] text-[var(--warning)]"
                          : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Start */}
        <button
          onClick={startTournamentMatch}
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-black text-sm transition shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-white" /> Start Match
        </button>
      </div>
    );
  }

  return (
    <UmpireSetupFlow
      match={match}
      setMatch={setMatch}
      players={players}
      friendlyOnly={friendlyOnly}
      isEditSetupOpen={isEditSetupOpen}
      setIsEditSetupOpen={setIsEditSetupOpen}
      handleClose={handleClose}
      getName={getName}
      deduceCategory={deduceCategory}
      startMatch={startMatch}
      buddyCheckPassed={buddyCheckPassed}
      selectedPlayerIds={selectedPlayerIds}
    />
  );
}
