import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from "@capacitor/core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBaseShareUrl() {
  return "https://iiscshuttlers.github.io/iiscshuttlers";
}

export function getEloTier(elo: number | undefined | null) {
  const rating = elo || 1200;
  if (rating < 1000) return { name: "Bronze", text: "text-amber-700 dark:text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", icon: "b" };
  if (rating < 1300) return { name: "Silver", text: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", icon: "s" };
  if (rating < 1600) return { name: "Gold", text: "text-yellow-600 dark:text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30", icon: "g" };
  if (rating < 1900) return { name: "Platinum", text: "text-cyan-600 dark:text-cyan-500", bg: "bg-cyan-100 dark:bg-cyan-900/30", icon: "p" };
  if (rating < 2200) return { name: "Diamond", text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900/30", icon: "d" };
  return { name: "Grandmaster", text: "text-rose-600 dark:text-rose-500", bg: "bg-rose-100 dark:bg-rose-900/30", icon: "gm" };
}
