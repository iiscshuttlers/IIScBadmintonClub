import { Link } from "wouter";
import { Plus, ChevronDown, Copy, RotateCcw, Trash2, Bell, MoreHorizontal, Loader2, Archive, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tournament } from "@/types/tournament";

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm";

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 dark:bg-slate-800 text-muted-foreground",
    active: "bg-primary/15 dark:bg-primary/20 text-primary",
    completed: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    archived: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    deleted: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400",
  };
  const label: Record<string, string> = { active: "live" };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${map[status] ?? map.draft}`}>
      {label[status] ?? status}
    </span>
  );
}

type StatusFilter = "active" | "deleted" | "archived";

interface TournamentHeaderProps {
  tournaments: Tournament[];
  selected: Tournament | null;
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  filteredTournaments: Tournament[];
  onSelectTournament: (t: Tournament) => void;
  onCloneTournament: () => Promise<void>;
  onRestoreTournament: (t: Tournament) => Promise<void>;
  onPermanentlyDelete: (t: Tournament) => Promise<void>;
  onOpenNotify: () => void;
  creating: boolean;
}

/**
 * One row: pick a tournament, see its status, and reach everything else
 * (clone, notify, trash/archive views) from a single ⋯ menu. New tournaments
 * always go through the create wizard so there is one way to start an event.
 */
export function TournamentHeader({
  tournaments,
  selected,
  statusFilter,
  setStatusFilter,
  filteredTournaments,
  onSelectTournament,
  onCloneTournament,
  onRestoreTournament,
  onPermanentlyDelete,
  onOpenNotify,
  creating,
}: TournamentHeaderProps) {
  const deletedCount = tournaments.filter((t) => t.status === "deleted").length;
  const archivedCount = tournaments.filter((t) => t.status === "archived").length;
  const viewingBin = statusFilter !== "active";

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <select
            aria-label="Tournament"
            value={selected?.id ?? ""}
            onChange={(e) => {
              const t = tournaments.find((item) => item.id === e.target.value);
              if (t) onSelectTournament(t);
            }}
            className="w-full text-sm font-black text-slate-800 dark:text-foreground bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-8 appearance-none outline-none focus:ring-2 focus:ring-primary/40 truncate cursor-pointer transition-all"
          >
            {filteredTournaments.map((t) => (
              <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                {t.name}
              </option>
            ))}
            {filteredTournaments.length === 0 && (
              <option disabled value="">No {statusFilter} tournaments</option>
            )}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
        </div>

        {selected && <div className="shrink-0"><StatusChip status={selected.status} /></div>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="More actions"
              className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {selected && !viewingBin && (
              <>
                <DropdownMenuItem onClick={onOpenNotify}>
                  <Bell /> Notify players
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCloneTournament} disabled={creating}>
                  <Copy /> Clone as new draft
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {viewingBin && (
              <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                <Eye /> Back to current tournaments
              </DropdownMenuItem>
            )}
            {statusFilter !== "archived" && (
              <DropdownMenuItem onClick={() => setStatusFilter("archived")}>
                <Archive /> Archived{archivedCount ? ` (${archivedCount})` : ""}
              </DropdownMenuItem>
            )}
            {statusFilter !== "deleted" && (
              <DropdownMenuItem onClick={() => setStatusFilter("deleted")}>
                <Trash2 /> Trash{deletedCount ? ` (${deletedCount})` : ""}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Link
          href="/host-tournament/new"
          aria-label="New tournament"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">New</span>
        </Link>
      </div>

      {viewingBin && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <span className="text-xs text-muted-foreground mr-auto">
            Showing {statusFilter === "deleted" ? "the trash" : "archived tournaments"}.{" "}
            <button onClick={() => setStatusFilter("active")} className="font-bold text-primary hover:underline">
              Back to current
            </button>
          </span>
          {selected && (selected.status === "deleted" || selected.status === "archived") && (
            <>
              <button
                onClick={() => onRestoreTournament(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore to draft
              </button>
              <button
                onClick={() => onPermanentlyDelete(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-black transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete forever
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
