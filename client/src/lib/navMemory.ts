/**
 * navMemory — persists UI navigation state to localStorage.
 * Survives page refresh, cross-page navigation, and app restarts.
 */

const PREFIX = "nav_";

export function navGet(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function navSet(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function navRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}

/** Read with fallback — checks localStorage, then returns defaultVal */
export function navRead(key: string, defaultVal: string): string {
  return navGet(key) ?? defaultVal;
}
