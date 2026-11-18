import React, { useState } from "react";
import { Trophy, Plus, ChevronDown, Copy, RotateCcw, Trash2, Bell, Users, X, Loader2 } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { LifecycleStepper } from "@/components/tournament/LifecycleStepper";
import { getTournamentTheme } from "@/lib/tournamentTheme";
import type { Tournament } from "@/types/tournament";

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 dark:bg-slate-800 text-muted-foreground",
    active: "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary",
    completed: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    archived: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${map[status] ?? map.draft}`}>
      {status}
    </span>
  );
}

interface TournamentHeaderProps {
  tournaments: Tournament[];
  selected: Tournament | null;
  statusFilter: "active" | "deleted" | "archived";
  setStatusFilter: (f: "active" | "deleted" | "archived") => void;
  filteredTournaments: Tournament[];
  onSelectTournament: (t: Tournament) => void;
  onCreateTournament: (formatFamily: "OPEN_EVENT" | "TEAM") => Promise<void>;
  onCloneTournament: () => Promise<void>;
  onRestoreTournament: (t: Tournament) => Promise<void>;
  onPermanentlyDelete: (t: Tournament) => Promise<void>;
  onOpenNotify: () => void;
  creating: boolean;
}

export function TournamentHeader({
  tournaments,
  selected,
  statusFilter,
  setStatusFilter,
  filteredTournaments,
  onSelectTournament,
  onCreateTournament,
  onCloneTournament,
  onRestoreTournament,
  onPermanentlyDelete,
  onOpenNotify,
  creating,
}: TournamentHeaderProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className={cardCls}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="relative flex-1 min-w-0 max-w-md">
              <select
                value={selected?.id ?? ""}
                onChange={(e) => {
                  const t = tournaments.find((item) => item.id === e.target.value);
                  if (t) onSelectTournament(t);
                }}
                className="w-full text-sm font-black text-slate-800 dark:text-foreground bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 appearance-none outline-none focus:ring-2 focus:ring-primary/40 truncate cursor-pointer transition-all"
              >
                {filteredTournaments.map((t) => (
                  <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {t.name}{statusFilter !== "active" ? ` [${t.status}]` : t.status !== "draft" ? ` [${t.status}]` : ""}
                  </option>
                ))}
                {filteredTournaments.length === 0 && (
                  <option disabled value="">No {statusFilter} tournaments</option>
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {selected && (
              <div className="shrink-0 hidden xs:block">
                <StatusChip status={selected.status} />
              </div>
            )}
          </div>

          <InfoModal
            title="TOURNAMENT MANAGER"
            items={[
              { badge: "FORMATS", title: "Bracket Formats", desc: "Supports Single Elimination, Double Elimination, and Round Robin formats." },
              { badge: "SEEDING", title: "Automatic Seeding", desc: "Players are automatically seeded based on their current ELO rating at the time of bracket generation." },
              { badge: "BYES", title: "Manual Entry Rounds", desc: "By default the draw's spare slots become byes for the top seeds, one each. On the Participants tab you can pin any player's first-match round instead — a second bye costs 3 slots, so the counter above the list shows what's left." }
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
          {selected && (
            <div className="block xs:hidden">
              <StatusChip status={selected.status} />
            </div>
          )}

          {/* Filter buttons */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-0.5">
            {([
              { key: "active" as const, label: "Active", count: tournaments.filter(t => t.status !== "deleted" && t.status !== "archived").length },
              { key: "deleted" as const, label: "Deleted", count: tournaments.filter(t => t.status === "deleted").length },
              { key: "archived" as const, label: "Archived", count: tournaments.filter(t => t.status === "archived").length },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  statusFilter === key
                    ? key === "deleted"
                      ? "bg-rose-500/15 text-rose-500 shadow-sm"
                      : key === "archived"
                      ? "bg-amber-500/15 text-amber-500 shadow-sm"
                      : "bg-white dark:bg-slate-700 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}{count > 0 ? ` (${count})` : ""}
              </button>
            ))}
          </div>

          {selected && (
            <button
              onClick={onCloneTournament}
              disabled={creating}
              title="Start a new draft from this tournament's settings"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Clone</span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={creating}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition disabled:opacity-50 shrink-0 ml-auto sm:ml-0 shadow-sm"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>New Tournament</span>
          </button>
        </div>
      </div>

      {/* Actions for deleted/archived tournaments */}
      {selected && (selected.status === "deleted" || selected.status === "archived") && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            onClick={() => onRestoreTournament(selected)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore to Draft
          </button>
          <button
            onClick={() => onPermanentlyDelete(selected)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-black transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Permanently Delete
          </button>
        </div>
      )}

      {selected && (
        <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-between gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <EventTypeBadge
              tournament_type={selected.tournament_type}
              format_family={selected.format_family}
            />
            <RankedBadge ranked={selected.counts_for_elo} />
            <button
              onClick={onOpenNotify}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notify</span>
            </button>
          </div>
          <div className="flex items-center justify-center w-full sm:w-auto pt-1 sm:pt-0">
            <LifecycleStepper
              status={selected.status}
              accentBg={getTournamentTheme(selected).tokens.bg}
            />
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-800 dark:text-foreground">Create New Tournament</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 mb-2">Select the format for your new tournament. This determines the features and structure available.</p>
              
              <button 
                onClick={async () => {
                  setShowCreateModal(false);
                  await onCreateTournament("OPEN_EVENT");
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-primary dark:hover:border-primary transition-colors flex gap-4 group"
              >
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg group-hover:bg-primary/10 transition-colors">
                  <Users className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">Open Event (Individual)</h3>
                  <p className="text-xs text-slate-500 mt-1">Standard tournament with individual participants or pairs (MS, MD, XD, etc).</p>
                </div>
              </button>

              <button 
                onClick={async () => {
                  setShowCreateModal(false);
                  await onCreateTournament("TEAM");
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-[var(--info)] dark:hover:border-[var(--info)] transition-colors flex gap-4 group"
              >
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg group-hover:bg-[var(--info)]/10 transition-colors">
                  <Trophy className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-[var(--info)] transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">Team Event</h3>
                  <p className="text-xs text-slate-500 mt-1">Collegiate-style event where teams compete in ties consisting of multiple rubbers.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
