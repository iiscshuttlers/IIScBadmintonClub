import { Trophy, ArrowUpDown, Filter, Search, X, SlidersHorizontal, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ELO_TIERS } from "@/lib/tiers";
import { useState, useEffect } from "react";
import { fetchTournamentOptions } from "@/services/tournamentService";

export function DirectoryFilters({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  showFilters,
  setShowFilters,
  levelFilter,
  setLevelFilter,
  departmentFilter,
  setDepartmentFilter,
  tournamentFilter,
  setTournamentFilter,
  categoryFilter,
  setCategoryFilter,
  allDepartments,
  filteredPlayersCount,
  otherPlayersCount,
  viewMode,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  sortBy: string;
  setSortBy: (v: any) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  levelFilter: string;
  setLevelFilter: (v: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (v: string) => void;
  tournamentFilter?: string;
  setTournamentFilter?: (v: string) => void;
  categoryFilter?: string;
  setCategoryFilter?: (v: string) => void;
  allDepartments: string[];
  filteredPlayersCount: number;
  otherPlayersCount: number;
  viewMode?: string;
}) {
  const [tournaments, setTournaments] = useState<{ id: string, name: string }[]>([]);
  useEffect(() => {
    fetchTournamentOptions()
      .then((data) => {
        if (data) setTournaments(data);
      });
  }, []);

  const isIndividuals = !viewMode || viewMode === "individuals";

  // Auto-collapse the panel once a filter is chosen — the active selections
  // stay visible as chips below, so the panel doesn't need to stay open.
  const pickLevel = (v: string) => { setLevelFilter(v); setShowFilters(false); };
  const pickDept = (v: string) => { setDepartmentFilter(v); setShowFilters(false); };
  const pickCategory = (v: string) => { setCategoryFilter?.(v); setShowFilters(false); };

  const tournamentName = tournamentFilter && tournamentFilter !== "All"
    ? (tournaments.find((t) => t.id === tournamentFilter)?.name ?? "Tournament")
    : null;

  const activeChips = isIndividuals
    ? [
        levelFilter !== "All" && { label: levelFilter, clear: () => setLevelFilter("All") },
        departmentFilter !== "All" && { label: departmentFilter, clear: () => setDepartmentFilter("All") },
        categoryFilter && categoryFilter !== "All" && { label: categoryFilter, clear: () => setCategoryFilter?.("All") },
        tournamentName && { label: tournamentName, clear: () => setTournamentFilter?.("All") },
      ].filter(Boolean) as { label: string; clear: () => void }[]
    : [];

  return (
    <div className="bg-card rounded-3xl p-6 sm:p-6 shadow-xl shadow-media/50 dark:shadow-none border border-border mb-10 space-y-5">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            id="player-search-input"
            type="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, nickname, or department..."
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl border border-border-strong bg-muted text-foreground focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-semibold"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-soft"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto shrink-0">
          {/* Tournament selector */}
          {setTournamentFilter && viewMode !== "h2h" && (
            <div className="relative flex-1 min-w-0">
              <Trophy className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={tournamentFilter}
                onChange={(e) => setTournamentFilter(e.target.value)}
                className="w-full pl-8 pr-2 py-3 rounded-2xl border border-border-strong bg-muted text-soft text-xs font-bold outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer truncate"
              >
                <option value="All">All</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort selector */}
          {isIndividuals && (
            <div className={`relative flex-1 min-w-0`}>
              <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full pl-7 pr-1 py-3 rounded-2xl border border-border-strong bg-muted text-soft text-xs font-bold outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer truncate"
              >
                <option value="elo">Overall</option>
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
                <option value="mixed">Mixed Doubles</option>
                <option value="winpct">Win %</option>
                <option value="name">Name</option>
                <option value="department">Department</option>
                <option value="level">Level</option>
              </select>
            </div>
          )}

          {isIndividuals && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-3 rounded-2xl border text-xs font-bold transition
            ${
              showFilters
                ? "bg-primary/20 border-primary text-primary"
                : "border-border-strong text-soft hover:border-border-strong/90"
            }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Filters</span>
              {(levelFilter !== "All" || departmentFilter !== "All") && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Active filter chips — stay visible while the panel is collapsed */}
      {isIndividuals && !showFilters && activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-primary/20 border border-primary/50 text-primary text-xs font-bold hover:bg-primary/15 transition"
            >
              <span className="truncate max-w-[12rem]">{chip.label}</span>
              <X className="w-3 h-3 shrink-0" />
            </button>
          ))}
          <button
            onClick={() => {
              setLevelFilter("All");
              setDepartmentFilter("All");
              setTournamentFilter?.("All");
              setCategoryFilter?.("All");
            }}
            className="text-xs font-bold text-muted-foreground hover:text-soft transition"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Expandable filters */}
      <AnimatePresence>
        {isIndividuals && showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Playing Level
                </label>
                <select
                  value={levelFilter}
                  onChange={(e) => pickLevel(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-border-strong bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary font-semibold"
                >
                  <option value="All">All Levels</option>
                  {ELO_TIERS.map(tier => (
                    <option key={tier.name} value={tier.name}>{tier.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Department
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => pickDept(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-border-strong bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary font-semibold"
                >
                  <option value="All">All Departments</option>
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {setCategoryFilter && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Category
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => pickCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-border-strong bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary font-semibold"
                    >
                      <option value="All">All Categories</option>
                      <option value="Men's Singles">Men's Singles</option>
                      <option value="Men's Doubles">Men's Doubles</option>
                      <option value="Women's Singles">Women's Singles</option>
                      <option value="Women's Doubles">Women's Doubles</option>
                      <option value="Mixed Doubles">Mixed Doubles</option>
                    </select>
                  </div>
                </>
              )}

              {(levelFilter !== "All" || departmentFilter !== "All" || tournamentFilter !== "All" || categoryFilter !== "All") && (
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    onClick={() => {
                      setLevelFilter("All");
                      setDepartmentFilter("All");
                      setTournamentFilter?.("All");
                      setCategoryFilter?.("All");
                    }}
                    className="text-xs font-bold text-muted-foreground hover:text-soft transition flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result count */}
      {isIndividuals && (searchQuery || levelFilter !== "All" || departmentFilter !== "All") && (
        <p className="text-xs font-bold text-muted-foreground mt-5">
          Showing{" "}
          <span className="text-primary">
            {filteredPlayersCount}
          </span>{" "}
          of {otherPlayersCount} players
        </p>
      )}
    </div>
  );
}
