import { Trophy, ArrowUpDown, Filter, Search, X, SlidersHorizontal, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ELO_TIERS } from "@/lib/tiers";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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
}) {
  const [tournaments, setTournaments] = useState<{ id: string, name: string }[]>([]);
  useEffect(() => {
    supabase
      .from("tournaments")
      .select("id, name")
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setTournaments(data);
      });
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 mb-10 space-y-5">
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
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-semibold"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto shrink-0">
          {/* Tournament selector */}
          {setTournamentFilter && (
            <div className="relative flex-1 min-w-0">
              <Trophy className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={tournamentFilter}
                onChange={(e) => setTournamentFilter(e.target.value)}
                className="w-full pl-8 pr-2 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-muted-foreground dark:text-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer truncate"
              >
                <option value="All">All</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort selector */}
          <div className={`relative ${setTournamentFilter ? "flex-[1.2]" : "flex-1"} min-w-0`}>
            <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-7 pr-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-muted-foreground dark:text-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer truncate"
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

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-3 rounded-2xl border text-xs font-bold transition
          ${
            showFilters
              ? "bg-primary/10 dark:bg-primary/20 border-primary/50 dark:border-primary text-primary dark:text-primary"
              : "border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Filters</span>
            {(levelFilter !== "All" || departmentFilter !== "All") && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-2">
                  Playing Level
                </label>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary font-semibold"
                >
                  <option value="All">All Levels</option>
                  {ELO_TIERS.map(tier => (
                    <option key={tier.name} value={tier.name}>{tier.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-2">
                  Department
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary font-semibold"
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
                    <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-2">
                      Category
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary font-semibold"
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
                    className="text-xs font-bold text-muted-foreground hover:text-slate-800 dark:hover:text-slate-200 transition flex items-center gap-1"
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
      {(searchQuery || levelFilter !== "All" || departmentFilter !== "All") && (
        <p className="text-xs font-bold text-muted-foreground dark:text-muted-foreground mt-5">
          Showing{" "}
          <span className="text-primary dark:text-primary">
            {filteredPlayersCount}
          </span>{" "}
          of {otherPlayersCount} players
        </p>
      )}
    </div>
  );
}
