/**
 * In-app back navigation — one rule for every Back control and the phone's
 * Back key:
 *
 *   1. If the current screen has an in-page step to undo (a wizard step, an
 *      opened match, a drill-down), undo it.
 *   2. Otherwise, if there is an earlier screen of this app in the tab's
 *      history, go back to it.
 *   3. Otherwise (opened from a link, a notification or a cold start), go to
 *      the screen's parent, replacing the current entry.
 *
 * Step 2 needs to know whether the previous history entry belongs to the
 * app. `window.history.length` cannot tell: it counts every entry in the tab,
 * including other sites before the app and forward entries. So every entry
 * the app creates is stamped with its position (`__navIdx`), counting from the
 * entry the app was first loaded on in this tab. Index 0 means "nothing of
 * ours behind this entry". The stamp lives in `history.state`, so it survives
 * reloads and leaving the site and coming back.
 */

export const NAV_INDEX_KEY = "__navIdx";

type StateRecord = Record<string, unknown>;

let currentIndex = 0;
let uninstall: (() => void) | null = null;

function isRecord(state: unknown): state is StateRecord {
  return !!state && typeof state === "object" && !Array.isArray(state);
}

export function indexOfState(state: unknown): number | null {
  if (!isRecord(state)) return null;
  const value = state[NAV_INDEX_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stamp(state: unknown, index: number): unknown {
  if (state == null) return { [NAV_INDEX_KEY]: index };
  if (isRecord(state)) return { ...state, [NAV_INDEX_KEY]: index };
  // A primitive or array state can't carry the stamp; leave it untouched.
  return state;
}

/**
 * Wraps history.pushState / replaceState so every entry carries its index,
 * and follows Back / Forward and fragment navigations. Call once, before the
 * router renders. Returns an uninstaller (used by tests).
 */
export function installNavHistory(win: Window = window): () => void {
  if (uninstall) return uninstall;
  const history = win.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;

  const existing = indexOfState(history.state);
  currentIndex = existing ?? 0;
  if (existing == null) {
    try {
      originalReplace.call(history, stamp(history.state, 0), "");
    } catch {
      // Sandboxed frames can refuse history writes; Back then falls back to parents.
    }
  }

  history.pushState = function pushState(data: unknown, unused: string, url?: string | URL | null) {
    const next = currentIndex + 1;
    const result = originalPush.call(this, stamp(data, next), unused, url);
    currentIndex = next;
    return result;
  };

  history.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null) {
    // Callers often pass `null` (or a fresh object) and would wipe the stamp.
    return originalReplace.call(this, stamp(data, currentIndex), unused, url);
  };

  // Back / Forward land on stamped entries. A fragment navigation
  // (`location.hash = …`) creates a new, unstamped entry right after the
  // current one — stamp it. Both events can fire for one navigation; the
  // second sees the stamp and is a no-op.
  const sync = () => {
    const index = indexOfState(history.state);
    if (index != null) {
      currentIndex = index;
      return;
    }
    currentIndex += 1;
    try {
      originalReplace.call(history, stamp(history.state, currentIndex), "");
    } catch {
      // ignore
    }
  };
  win.addEventListener("popstate", sync);
  win.addEventListener("hashchange", sync);

  uninstall = () => {
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    win.removeEventListener("popstate", sync);
    win.removeEventListener("hashchange", sync);
    uninstall = null;
    currentIndex = 0;
  };
  return uninstall;
}

/** Position of the current entry; 0 = the first entry of the app in this tab. */
export function currentNavIndex(): number {
  return currentIndex;
}

/** True when the previous history entry is a screen of this app. */
export function canGoBackInApp(): boolean {
  return currentIndex > 0;
}

// ── Back handlers ────────────────────────────────────────────────────────────
//
// The phone's Back key has no component of its own, so screens register what
// it should do. Step handlers (rule 1) are tried newest-first; the newest
// parent fallback (rule 3) is used when there is no in-app history.

type StepHandler = () => boolean;
type ParentFallback = () => void;

const stepHandlers: StepHandler[] = [];
const parentFallbacks: ParentFallback[] = [];

function register<T>(list: T[], item: T): () => void {
  list.push(item);
  return () => {
    const index = list.lastIndexOf(item);
    if (index >= 0) list.splice(index, 1);
  };
}

/** Registers an in-page step undo. Return true when it handled Back. */
export function registerStepHandler(handler: StepHandler): () => void {
  return register(stepHandlers, handler);
}

/** Registers where Back goes when there is no earlier in-app screen. */
export function registerParentFallback(fallback: ParentFallback): () => void {
  return register(parentFallbacks, fallback);
}

/** Rule 1: lets the newest in-page step handler take Back. */
export function runStepHandlers(): boolean {
  for (let i = stepHandlers.length - 1; i >= 0; i -= 1) {
    if (stepHandlers[i]()) return true;
  }
  return false;
}

/** Rule 3: navigates to the current screen's parent, if one is registered. */
export function runParentFallback(): boolean {
  const fallback = parentFallbacks[parentFallbacks.length - 1];
  if (!fallback) return false;
  fallback();
  return true;
}
