/**
 * navUtils.ts — Safe wrappers for browser navigation APIs that crash on Capacitor.
 *
 * On Capacitor (Android/iOS WebView), calling `window.history.replaceState` or
 * setting `window.location.hash` can trigger a crash. All URL manipulation in
 * the app should go through these helpers.
 */

import { Capacitor } from '@capacitor/core';

/** True when running inside a Capacitor native shell (Android / iOS) */
export const isCapacitor = Capacitor.isNativePlatform();

/**
 * Safely update the URL without adding a browser history entry.
 * No-op on Capacitor.
 */
export function safeReplaceState(url: string): void {
  if (isCapacitor) return;
  try {
    window.history.replaceState(null, "", url);
  } catch {
    // Ignore – some strict environments block this
  }
}

/**
 * Safely push a new URL history entry.
 * No-op on Capacitor.
 */
export function safePushState(url: string): void {
  if (isCapacitor) return;
  try {
    window.history.pushState(null, "", url);
  } catch {
    // Ignore
  }
}

/**
 * Safely set the URL hash fragment (e.g. tab state).
 * No-op on Capacitor.
 */
export function safeSetHash(hash: string): void {
  if (isCapacitor) return;
  try {
    window.location.hash = hash;
  } catch {
    // Ignore
  }
}

/**
 * Safely read the current URL hash.
 * Returns "" on Capacitor.
 */
export function safeGetHash(): string {
  if (isCapacitor) return "";
  try {
    return window.location.hash.replace("#", "");
  } catch {
    return "";
  }
}

/**
 * Safely read the current URL search params.
 * Returns empty URLSearchParams on Capacitor.
 */
export function safeGetSearchParams(): URLSearchParams {
  if (isCapacitor) return new URLSearchParams();
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}
