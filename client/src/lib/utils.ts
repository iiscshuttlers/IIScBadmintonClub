import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from "@capacitor/core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBaseShareUrl() {
  return "https://iiscshuttlers.github.io/IIScBadmintonClub";
}

export function getCourtColor(court: string | null | undefined): string {
  if (!court) return "text-blue-400";
  const c = String(court).trim().toLowerCase();
  if (c.includes("1")) return "text-emerald-400";
  if (c.includes("2")) return "text-amber-400";
  if (c.includes("3")) return "text-rose-400";
  if (c.includes("4")) return "text-violet-400";
  if (c.includes("5")) return "text-cyan-400";
  if (c.includes("6")) return "text-fuchsia-400";
  if (c.includes("7")) return "text-indigo-400";
  if (c.includes("8")) return "text-teal-400";
  return "text-blue-400";
}

export function isFuzzyMatch(search: string, text: string): boolean {
  if (!search) return true;
  const s = search.toLowerCase();
  const t = text.toLowerCase();
  
  if (t.includes(s)) return true;
  
  let sIdx = 0;
  for (let i = 0; i < t.length && sIdx < s.length; i++) {
    if (t[i] === s[sIdx]) sIdx++;
  }
  if (sIdx === s.length) return true;
  
  const sWords = s.split(/\s+/);
  const tWords = t.split(/\s+/);
  
  const getDistance = (a: string, b: string) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[a.length][b.length];
  };

  for (const sw of sWords) {
    if (sw.length < 3) continue;
    for (const tw of tWords) {
      if (Math.abs(sw.length - tw.length) > 2) continue;
      const dist = getDistance(sw, tw);
      if (dist <= 2) return true;
    }
  }
  
  return false;
}
