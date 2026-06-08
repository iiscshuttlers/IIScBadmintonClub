import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const CircularProgress = ({ value, size = 72, stroke = 7 }: { value: number; size?: number; stroke?: number; }) => {
  const radius = (size - stroke) / 2;
  const c = radius * 2 * Math.PI;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor"
          strokeWidth={stroke} fill="none" className="text-slate-200 dark:text-slate-700" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="url(#progressGrad)" strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-black text-slate-900 dark:text-white">{Math.round(value)}%</span>
      </div>
    </div>
  );
};

export const FormPill = ({ result, index }: { result: "W" | "L"; index: number; }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.4 + index * 0.07, type: "spring", stiffness: 220 }}
    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-md
      ${result === "W"
        ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/40"
        : "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/40"}`}
  >
    {result}
  </motion.div>
);

export const CategoryBar = ({ label, wins, losses, color }: { label: string; wins: number; losses: number; color: string; }) => {
  const total = wins + losses;
  const winPct = total ? (wins / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">({total} matches)</span>
        </div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {wins}<span className="text-slate-400 font-normal">W</span> – {losses}<span className="text-slate-400 font-normal">L</span>
        </div>
      </div>
      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${winPct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color}`}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${100 - winPct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
          className="h-full bg-slate-300 dark:bg-slate-700"
        />
      </div>
    </div>
  );
};

export const KPI = ({
  icon: Icon, label, value, sub, accent
}: { icon: any; label: string; value: string | number; sub?: string; accent: string; }) => (
  <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity ${accent}`} />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accent} bg-opacity-15`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{value}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{sub}</div>}
    </div>
  </div>
);

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070d1a] selection:bg-emerald-500/30 font-sans">
      <div className="relative overflow-hidden bg-slate-950" style={{ minHeight: '88vh' }}>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[60vh]">
            <div className="flex flex-col justify-center space-y-6">
              <div className="h-6 w-32 bg-slate-800 rounded-full animate-pulse" />
              <div className="space-y-4">
                <div className="h-20 sm:h-24 w-3/4 bg-slate-800 rounded-2xl animate-pulse" />
                <div className="h-20 sm:h-24 w-2/3 bg-slate-800 rounded-2xl animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-8 w-32 bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-8 w-20 bg-slate-800 rounded-lg animate-pulse" />
              </div>
              <div className="flex items-stretch gap-2 mt-4">
                <div className="h-24 w-24 bg-slate-800 rounded-2xl animate-pulse" />
                <div className="h-24 w-24 bg-slate-800 rounded-2xl animate-pulse" />
                <div className="h-24 w-24 bg-slate-800 rounded-2xl animate-pulse" />
              </div>
            </div>
            <div className="flex justify-center lg:justify-end items-center">
              <div className="w-[280px] h-[380px] sm:w-[360px] sm:h-[480px] bg-slate-800 rounded-[4rem] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
