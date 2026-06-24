import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { PlayerSelect } from './PlayerSelect';
import type { PlayerSlim as Player } from '@/types';
import type { BwfMatchState } from './UmpireEngine';

interface UmpireSetupFlowProps {
  match: BwfMatchState;
  setMatch: React.Dispatch<React.SetStateAction<BwfMatchState>>;
  players: Player[];
  friendlyOnly: boolean;
  isEditSetupOpen: boolean;
  setIsEditSetupOpen: (val: boolean) => void;
  handleClose: () => void;
  getName: (id: string) => string;
  deduceCategory: () => string;
  startMatch: () => void;
  buddyCheckPassed: boolean;
  selectedPlayerIds: string[];
}

export function UmpireSetupFlow({
  match,
  setMatch,
  players,
  friendlyOnly,
  isEditSetupOpen,
  setIsEditSetupOpen,
  handleClose,
  getName,
  deduceCategory,
  startMatch,
  buddyCheckPassed,
  selectedPlayerIds,
}: UmpireSetupFlowProps) {
  const updateMatch = (updates: Partial<BwfMatchState>) => setMatch(prev => ({ ...prev, ...updates }));

  const t1p1Name = match.t1.p1Id ? getName(match.t1.p1Id) : "";
  const t1p2Name = match.t1.p2Id ? getName(match.t1.p2Id) : "";
  const t2p1Name = match.t2.p1Id ? getName(match.t2.p1Id) : "";
  const t2p2Name = match.t2.p2Id ? getName(match.t2.p2Id) : "";

  const teamLabel = (p1: string, p2: string, fallback: string) =>
    p1 ? (p2 ? `${p1.split(" ")[0]} & ${p2.split(" ")[0]}` : p1) : fallback;

  const t1Label = teamLabel(t1p1Name, t1p2Name, "Team 1");
  const t2Label = teamLabel(t2p1Name, t2p2Name, "Team 2");
  const playersReady = !!(match.t1.p1Id && match.t2.p1Id);
  const isDoubles = !!(match.t1.p2Id || match.t2.p2Id);

  // initials avatar helper
  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="bg-slate-900 rounded-3xl text-white max-w-lg mx-auto shadow-2xl overflow-hidden">

      {/* ── Header ── */}
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-6 pb-5">
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">
              {isEditSetupOpen ? "Edit Setup" : "Umpire Station"}
            </p>
            <h2 className="text-xl font-black text-white">Match Setup</h2>
          </div>
          <button
            onClick={() => { if (isEditSetupOpen) setIsEditSetupOpen(false); else handleClose(); }}
            className="p-2 hover:bg-slate-700 rounded-full text-slate-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Match type badge */}
        <div className="mt-4">
          {friendlyOnly ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Friendly Match Only
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setMatch({ ...match, isFriendly: true })}
                className={`px-4 py-1.5 rounded-full text-xs font-black border transition ${match.isFriendly ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}
              >Friendly</button>
              <button
                onClick={() => setMatch({ ...match, isFriendly: false })}
                className={`px-4 py-1.5 rounded-full text-xs font-black border transition ${!match.isFriendly ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}
              >Tournament</button>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-6 space-y-5 mt-5">

        {/* ── Match number (tournament only) ── */}
        {!match.isFriendly && (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Match Number</label>
            <input
              value={match.matchNumber}
              onChange={(e) => setMatch({ ...match, matchNumber: e.target.value })}
              placeholder="e.g. MS-14"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition"
            />
          </div>
        )}

        {/* ── Format row ── */}
        <div className="bg-slate-800/60 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Format</p>
          <div className="flex gap-2">
            {[1, 3, 5].map(sets => (
              <button key={sets}
                onClick={() => setMatch({ ...match, bestOfSets: sets })}
                className={`flex-1 py-2 rounded-xl font-black text-sm border transition ${match.bestOfSets === sets ? "bg-sky-500/20 border-sky-500 text-sky-400" : "bg-slate-700/50 border-slate-700 text-slate-400 hover:border-slate-500"}`}
              >BO{sets}</button>
            ))}
            <div className="w-px bg-slate-700 self-stretch mx-1" />
            {[11, 15, 21].map(pts => (
              <button key={pts}
                onClick={() => setMatch({ ...match, pointsToWin: pts, goldenPoint: pts === 21 ? 30 : pts === 15 ? 21 : 15 })}
                className={`flex-1 py-2 rounded-xl font-black text-sm border transition ${match.pointsToWin === pts ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-700/50 border-slate-700 text-slate-400 hover:border-slate-500"}`}
              >{pts}pts</button>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-slate-500 shrink-0">Golden point cap:</span>
            <input
              type="number"
              value={match.goldenPoint}
              onChange={(e) => setMatch({ ...match, goldenPoint: parseInt(e.target.value) || 0 })}
              className="w-16 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-center text-sm font-bold text-amber-400 outline-none focus:border-amber-500 transition"
            />
            <span className="text-xs text-slate-500">pts</span>
          </div>
        </div>

        {/* ── Players ── */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Players</p>

          {/* Court layout */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">

            {/* Team 1 */}
            <div className="bg-slate-800/60 rounded-2xl p-3 space-y-2 border border-slate-700/50">
              {/* Name display */}
              <div className="flex items-center gap-2 min-h-[2rem]">
                {t1p1Name ? (
                  <>
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-black text-emerald-400 shrink-0">
                      {initials(t1p1Name)}
                    </div>
                    <span className="text-sm font-black text-white truncate">{t1p1Name}</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 italic">Team 1</span>
                )}
              </div>
              {t1p2Name && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[10px] font-black text-emerald-500 shrink-0">
                    {initials(t1p2Name)}
                  </div>
                  <span className="text-sm font-black text-white truncate">{t1p2Name}</span>
                </div>
              )}
              <div className="space-y-1.5 pt-1 border-t border-slate-700/50">
                <PlayerSelect
                  value={match.t1.p1Id}
                  onChange={(v) => setMatch({ ...match, t1: { ...match.t1, p1Id: v } })}
                  players={players.filter(p => ![match.t1.p2Id, match.t2.p1Id, match.t2.p2Id].includes(p.id))}
                  placeholder="Select player 1"
                />
                <PlayerSelect
                  value={match.t1.p2Id || ""}
                  onChange={(v) => setMatch({ ...match, t1: { ...match.t1, p2Id: v } })}
                  players={players.filter(p => ![match.t1.p1Id, match.t2.p1Id, match.t2.p2Id].includes(p.id))}
                  placeholder="+ doubles partner"
                />
              </div>
            </div>

            {/* VS divider */}
            <div className="flex flex-col items-center justify-center gap-1 pt-3">
              <div className="w-px h-6 bg-slate-700" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">vs</span>
              <div className="w-px h-6 bg-slate-700" />
            </div>

            {/* Team 2 */}
            <div className="bg-slate-800/60 rounded-2xl p-3 space-y-2 border border-slate-700/50">
              <div className="flex items-center gap-2 min-h-[2rem]">
                {t2p1Name ? (
                  <>
                    <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-[10px] font-black text-sky-400 shrink-0">
                      {initials(t2p1Name)}
                    </div>
                    <span className="text-sm font-black text-white truncate">{t2p1Name}</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 italic">Team 2</span>
                )}
              </div>
              {t2p2Name && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-[10px] font-black text-sky-500 shrink-0">
                    {initials(t2p2Name)}
                  </div>
                  <span className="text-sm font-black text-white truncate">{t2p2Name}</span>
                </div>
              )}
              <div className="space-y-1.5 pt-1 border-t border-slate-700/50">
                <PlayerSelect
                  value={match.t2.p1Id}
                  onChange={(v) => setMatch({ ...match, t2: { ...match.t2, p1Id: v } })}
                  players={players.filter(p => ![match.t1.p1Id, match.t1.p2Id, match.t2.p2Id].includes(p.id))}
                  placeholder="Select player 1"
                />
                <PlayerSelect
                  value={match.t2.p2Id || ""}
                  onChange={(v) => setMatch({ ...match, t2: { ...match.t2, p2Id: v } })}
                  players={players.filter(p => ![match.t1.p1Id, match.t1.p2Id, match.t2.p1Id].includes(p.id))}
                  placeholder="+ doubles partner"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Category (auto-detected) ── */}
        {playersReady && (
          <div className="flex items-center gap-3 bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/40">
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Detected Category</p>
              <p className="text-sm font-black text-emerald-400">{match.customCategory || deduceCategory()}</p>
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <select
                value={["MS","MD","XD","WD","WS","Hybrid","Crossgender"].includes(match.customCategory || "") ? (match.customCategory || "") : match.customCategory ? "Other" : ""}
                onChange={(e) => {
                  if (e.target.value === "Other") setMatch({ ...match, customCategory: "" });
                  else setMatch({ ...match, customCategory: e.target.value });
                }}
                className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-emerald-500 transition"
              >
                <option value="">Override…</option>
                <option value="MS">MS</option>
                <option value="MD">MD</option>
                <option value="XD">XD</option>
                <option value="WD">WD</option>
                <option value="WS">WS</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Crossgender">Crossgender</option>
                <option value="Other">Other…</option>
              </select>
              {match.customCategory !== undefined && !["MS","MD","XD","WD","WS","Hybrid","Crossgender",""].includes(match.customCategory) && (
                <input
                  value={match.customCategory}
                  onChange={(e) => setMatch({ ...match, customCategory: e.target.value })}
                  placeholder="Custom category"
                  autoFocus
                  className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-emerald-500 transition"
                />
              )}
            </div>
          </div>
        )}

        {/* ── First Serve (only once players are set) ── */}
        {playersReady && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">First Serve</p>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map(t => {
                const label = t === 1 ? t1Label : t2Label;
                return (
                  <button key={t}
                    onClick={() => setMatch({ ...match, serverTeam: t })}
                    className={`py-2.5 rounded-xl font-bold text-sm border transition truncate ${match.serverTeam === t ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"}`}
                  >{label} serves</button>
                );
              })}
            </div>

            {/* Doubles: who serves first in the serving team */}
            {isDoubles && (
              <>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pt-1">Server within team</p>
                <div className="grid grid-cols-2 gap-2">
                  {([0, 1] as const).map(i => {
                    const servingTeam = match.serverTeam === 1 ? match.t1 : match.t2;
                    const pName = i === 0
                      ? (servingTeam.p1Id ? getName(servingTeam.p1Id).split(" ")[0] : "P1")
                      : (servingTeam.p2Id ? getName(servingTeam.p2Id).split(" ")[0] : "P2");
                    if (i === 1 && !servingTeam.p2Id) return null;
                    return (
                      <button key={i}
                        onClick={() => setMatch({ ...match, serverPlayerIndex: i })}
                        className={`py-2 rounded-xl font-bold text-xs border transition truncate ${match.serverPlayerIndex === i ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                      >{pName} serves first</button>
                    );
                  })}
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pt-1">
                  First Receiver <span className="normal-case text-slate-600">(BWF 9.4)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([0, 1] as const).map(i => {
                    const receivingTeam = match.serverTeam === 1 ? match.t2 : match.t1;
                    const pName = i === 0
                      ? (receivingTeam.p1Id ? getName(receivingTeam.p1Id).split(" ")[0] : "P1")
                      : (receivingTeam.p2Id ? getName(receivingTeam.p2Id).split(" ")[0] : "P2");
                    if (i === 1 && !receivingTeam.p2Id) return null;
                    return (
                      <button key={i}
                        onClick={() => setMatch({ ...match, receiverPlayerIndex: i })}
                        className={`py-2 rounded-xl font-bold text-xs border transition truncate ${match.receiverPlayerIndex === i ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                      >{pName} receives</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Buddy gate ── */}
        {!isEditSetupOpen && !buddyCheckPassed && selectedPlayerIds.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              You must be a <strong>buddy</strong> of at least one player to umpire a friendly match.
              Add them as a buddy from their player profile first.
            </span>
          </div>
        )}

        {/* ── Start button ── */}
        <button
          disabled={!isEditSetupOpen && !buddyCheckPassed && selectedPlayerIds.length > 0}
          onClick={() => {
            if (isEditSetupOpen) {
              setIsEditSetupOpen(false);
              updateMatch({
                inferredCategory: match.customCategory || deduceCategory(),
                t1: { ...match.t1, p1Name: getName(match.t1.p1Id), p2Name: match.t1.p2Id ? getName(match.t1.p2Id) : undefined },
                t2: { ...match.t2, p1Name: getName(match.t2.p1Id), p2Name: match.t2.p2Id ? getName(match.t2.p2Id) : undefined },
              });
            } else {
              startMatch();
            }
          }}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_4px_24px_rgba(16,185,129,0.35)] transition-all"
        >
          {isEditSetupOpen ? "Save Changes" : (match.pointLog.length > 0 ? "▶ Resume Broadcasting" : "▶ Start Broadcasting")}
        </button>
      </div>
    </div>
  );
};