import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from "@capacitor/core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBaseShareUrl() {
  return "https://iiscshuttlers.github.io/iiscshuttlers";
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
