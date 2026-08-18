import React from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

interface HighlightsTabProps {
  bio: string;
  setBio: (val: string) => void;
  quote: string;
  setQuote: (val: string) => void;
  tournamentsRaw: string;
  setTournamentsRaw: (val: string) => void;
  tourName: string;
  setTourName: (val: string) => void;
  tourYear: string;
  setTourYear: (val: string) => void;
  achievementsRaw: string;
  setAchievementsRaw: (val: string) => void;
  achCategory: string;
  setAchCategory: (val: string) => void;
  achEventType: string;
  setAchEventType: (val: string) => void;
  achMedal: string;
  setAchMedal: (val: string) => void;
  achCustomMedal: string;
  setAchCustomMedal: (val: string) => void;
  achTournament: string;
  setAchTournament: (val: string) => void;
  careerHighlights: any[];
  setCareerHighlights: (val: any[]) => void;
}

export function HighlightsTab({
  bio,
  setBio,
  quote,
  setQuote,
  tournamentsRaw,
  setTournamentsRaw,
  tourName,
  setTourName,
  tourYear,
  setTourYear,
  achievementsRaw,
  setAchievementsRaw,
  achCategory,
  setAchCategory,
  achEventType,
  setAchEventType,
  achMedal,
  setAchMedal,
  achCustomMedal,
  setAchCustomMedal,
  achTournament,
  setAchTournament,
  careerHighlights,
  setCareerHighlights,
}: HighlightsTabProps) {
  return (
    <motion.div
      key="highlights"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
          Bio / About Yourself
        </label>
        <textarea
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-on-accent dark:text-on-accent focus:ring-2 focus:ring-primary outline-none transition-all"
          placeholder="PhD researcher at IISc. Known for aggressive net play and quick reflexes..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-2">
          Motivational Quote
        </label>
        <input
          type="text"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-on-accent dark:text-on-accent focus:ring-2 focus:ring-primary outline-none"
          placeholder="e.g. Enjoying the Game is the best strategy"
        />
      </div>

      {/* Tournaments tag chips */}
      <div>
        <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-3">
          Tournaments Played
        </label>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
          {tournamentsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...tournamentsRaw.split(",").map((s) => s.trim()).filter(Boolean)]
                .sort((a, b) => {
                  const ya = parseInt(a.match(/\d{4}/)?.[0] ?? "0");
                  const yb = parseInt(b.match(/\d{4}/)?.[0] ?? "0");
                  return yb - ya;
                })
                .map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs font-bold"
                  >
                    🏸 {t}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = tournamentsRaw
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .filter((item) => item !== t);
                        setTournamentsRaw(updated.join(", "));
                      }}
                      className="ml-0.5 text-blue-500 hover:text-rose-500 transition font-black text-sm leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={tourName}
              onChange={(e) => setTourName(e.target.value)}
              placeholder="Tournament Name (e.g. Farewell Tournament)"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-on-accent dark:text-on-accent text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={tourYear}
              onChange={(e) => setTourYear(e.target.value)}
              placeholder="Year (e.g. 2025)"
              className="w-full sm:w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-on-accent dark:text-on-accent text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => {
                if (tourName.trim() && tourYear.trim() && /^\d{4}$/.test(tourYear.trim())) {
                  const val = `${tourName.trim()} ${tourYear.trim()}`;
                  setTournamentsRaw(
                    tournamentsRaw.trim() ? tournamentsRaw.trim() + ", " + val : val,
                  );
                  setTourName("");
                  setTourYear("");
                }
              }}
              disabled={!tourName.trim() || !tourYear.trim() || !/^\d{4}$/.test(tourYear.trim())}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-on-accent rounded-xl text-xs font-bold transition shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Achievements tag chips */}
      <div>
        <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-3">
          Top Achievements
        </label>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
          {achievementsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...achievementsRaw.split(",").map((s) => s.trim()).filter(Boolean)]
                .sort((a, b) => {
                  const ya = parseInt(a.match(/\d{4}/)?.[0] ?? "0");
                  const yb = parseInt(b.match(/\d{4}/)?.[0] ?? "0");
                  return yb - ya;
                })
                .map((ach, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 dark:bg-primary/30 border border-primary/40 dark:border-primary/80 text-primary dark:text-primary text-xs font-bold"
                  >
                    🏆 {ach}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = achievementsRaw
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .filter((item) => item !== ach);
                        setAchievementsRaw(updated.join(", "));
                      }}
                      className="ml-0.5 text-primary hover:text-rose-500 transition font-black text-sm leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 w-full items-center">
            <select
              value={achCategory}
              onChange={(e) => setAchCategory(e.target.value)}
              className="w-full sm:w-auto shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-on-accent dark:text-on-accent text-xs outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Men's">Men's</option>
              <option value="Women's">Women's</option>
              <option value="Mixed">Mixed</option>
            </select>
            <select
              value={achEventType}
              onChange={(e) => setAchEventType(e.target.value)}
              className="w-full sm:w-auto shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-on-accent dark:text-on-accent text-xs outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Singles">Singles</option>
              <option value="Doubles">Doubles</option>
            </select>
            <div className="flex gap-2 sm:w-1/3 shrink-0">
              <select
                value={achMedal}
                onChange={(e) => setAchMedal(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-on-accent dark:text-on-accent text-xs outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Gold">🥇 Gold / Winner</option>
                <option value="Silver">🥈 Silver / Runner-up</option>
                <option value="Bronze">🥉 Bronze / Semi-Finalist</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {achMedal === "Other" && (
              <input
                type="text"
                value={achCustomMedal}
                onChange={(e) => setAchCustomMedal(e.target.value)}
                placeholder="e.g. Quarter-Finalist"
                className="w-full sm:w-32 shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-on-accent dark:text-on-accent text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            )}
            <select
              value={achTournament}
              onChange={(e) => setAchTournament(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-on-accent dark:text-on-accent text-xs outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select Tournament Played --</option>
              {tournamentsRaw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((t, idx) => (
                  <option key={idx} value={t}>
                    {t}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const medalStr =
                  achMedal === "Other"
                    ? achCustomMedal.trim()
                    : achMedal === "Gold"
                    ? "Winner"
                    : achMedal === "Silver"
                    ? "Runner-up"
                    : "Semi-Finalist";
                if (medalStr && achTournament.trim()) {
                  const val = `${achCategory} ${achEventType} ${medalStr} - ${achTournament.trim()}`;
                  setAchievementsRaw(
                    achievementsRaw.trim() ? achievementsRaw.trim() + ", " + val : val,
                  );
                  setAchCustomMedal("");
                  setAchTournament("");
                }
              }}
              disabled={
                !(achMedal === "Other" ? achCustomMedal.trim() : true) || !achTournament.trim()
              }
              className="px-4 py-2 bg-primary hover:bg-primary disabled:opacity-50 text-primary-foreground rounded-xl text-xs font-bold transition shrink-0"
            >
              Add
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            First add Tournaments below, then select them here.
          </p>
        </div>
      </div>

      {/* Career Highlights Builder */}
      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-semibold text-muted-foreground dark:text-slate-300 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Career Highlights
          </label>
          <button
            type="button"
            onClick={() =>
              setCareerHighlights([
                ...careerHighlights,
                { year: "", title: "", description: "" },
              ])
            }
            className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30 transition shadow-sm"
          >
            + Add Highlight
          </button>
        </div>

        {careerHighlights.length === 0 ? (
          <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
            <p className="text-muted-foreground dark:text-muted-foreground text-sm">
              Add custom narrative milestones (e.g. "Joined IISc Team") to show on your profile timeline.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {careerHighlights.map((hl, idx) => (
              <div
                key={idx}
                className="relative bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm pr-12"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCareerHighlights(careerHighlights.filter((_, i) => i !== idx))
                  }
                  className="absolute top-4 right-4 text-rose-500 hover:text-rose-600 dark:text-rose-400 font-black p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition"
                  title="Remove highlight"
                >
                  ×
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Year
                    </label>
                    <input
                      type="text"
                      value={hl.year}
                      placeholder="e.g. 2023"
                      onChange={(e) => {
                        const arr = [...careerHighlights];
                        arr[idx].year = e.target.value;
                        setCareerHighlights(arr);
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={hl.title}
                      placeholder="e.g. Inter-University Quarter-Finalist"
                      onChange={(e) => {
                        const arr = [...careerHighlights];
                        arr[idx].title = e.target.value;
                        setCareerHighlights(arr);
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={hl.description}
                      rows={2}
                      placeholder="Briefly describe this milestone..."
                      onChange={(e) => {
                        const arr = [...careerHighlights];
                        arr[idx].description = e.target.value;
                        setCareerHighlights(arr);
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
