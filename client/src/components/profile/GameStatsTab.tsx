import React from "react";
import { motion } from "framer-motion";

interface GameStatsTabProps {
  playingLevel: string;
  setPlayingLevel: (val: string) => void;
  playingStyle: string;
  setPlayingStyle: (val: string) => void;
  dominantHand: string;
  setDominantHand: (val: string) => void;
  favoriteShot: string;
  setFavoriteShot: (val: string) => void;
  yearsPlaying: string;
  setYearsPlaying: (val: string) => void;
  coach: string;
  setCoach: (val: string) => void;
  favoriteIdol: string;
  setFavoriteIdol: (val: string) => void;
  favoriteFormat: string;
  setFavoriteFormat: (val: string) => void;
}

export function GameStatsTab({
  playingLevel,
  setPlayingLevel,
  playingStyle,
  setPlayingStyle,
  dominantHand,
  setDominantHand,
  favoriteShot,
  setFavoriteShot,
  yearsPlaying,
  setYearsPlaying,
  coach,
  setCoach,
  favoriteIdol,
  setFavoriteIdol,
  favoriteFormat,
  setFavoriteFormat,
}: GameStatsTabProps) {
  return (
    <motion.div
      key="badminton"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Playing Level *
          </label>
          <select
            value={playingLevel}
            onChange={(e) => setPlayingLevel(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
            <option value="Professional">Professional</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Playing Style
          </label>
          <input
            type="text"
            value={playingStyle}
            onChange={(e) => setPlayingStyle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            placeholder="e.g. Aggressive, Defensive, All-round"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Dominant Hand
          </label>
          <select
            value={dominantHand}
            onChange={(e) => setDominantHand(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="Right-handed">Right-handed</option>
            <option value="Left-handed">Left-handed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Signature Shot
          </label>
          <input
            type="text"
            value={favoriteShot}
            onChange={(e) => setFavoriteShot(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            placeholder="e.g. Net Cross Drop, Jump Smash"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Years Playing Badminton
          </label>
          <input
            type="number"
            value={yearsPlaying}
            onChange={(e) => setYearsPlaying(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            placeholder="e.g. 5"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Coach
          </label>
          <input
            type="text"
            value={coach}
            onChange={(e) => setCoach(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            placeholder="e.g. Self-coached or Academy Name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Badminton Idol
          </label>
          <input
            type="text"
            value={favoriteIdol}
            onChange={(e) => setFavoriteIdol(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            placeholder="e.g. Lin Dan, Viktor Axelsen"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Favorite Format
          </label>
          <select
            required
            value={favoriteFormat}
            onChange={(e) => setFavoriteFormat(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="" disabled>Select your favorite format</option>
            <option value="Singles">Singles</option>
            <option value="Doubles">Doubles</option>
            <option value="Mixed Doubles">Mixed Doubles</option>
          </select>
        </div>
      </div>
    </motion.div>
  );
}
