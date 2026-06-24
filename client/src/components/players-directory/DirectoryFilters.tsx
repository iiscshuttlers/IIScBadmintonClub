import { Search, X, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  allDepartments: string[];
  filteredPlayersCount: number;
  otherPlayersCount: number;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 mb-10 space-y-5">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            id="player-search-input"
            type="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, nickname, or department..."
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-semibold"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {/* Sort selector */}
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="pl-9 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
            >
              <option value="elo">By ELO</option>
              <option value="winpct">By Win %</option>
              <option value="name">By Name</option>
              <option value="department">By Department</option>
              <option value="level">By Level</option>
            </select>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-bold transition
          ${
            showFilters
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {(levelFilter !== "All" || departmentFilter !== "All") && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
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
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Playing Level
                </label>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="All">All Levels</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Professional">Professional</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Department
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="All">All Departments</option>
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              {(levelFilter !== "All" || departmentFilter !== "All") && (
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    onClick={() => {
                      setLevelFilter("All");
                      setDepartmentFilter("All");
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition flex items-center gap-1"
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
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-5">
          Showing{" "}
          <span className="text-emerald-600 dark:text-emerald-400">
            {filteredPlayersCount}
          </span>{" "}
          of {otherPlayersCount} players
        </p>
      )}
    </div>
  );
}
