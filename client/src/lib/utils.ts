import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from "@capacitor/core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBaseShareUrl() {
  if (Capacitor.isNativePlatform()) {
    return "https://iiscshuttlers.github.io/iiscshuttlers";
  }
  return window.location.origin + (import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL);
}
