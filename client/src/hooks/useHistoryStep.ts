import { useCallback, useEffect, useRef, useState } from "react";
import { currentNavIndex, registerStepHandler } from "@/lib/navHistory";

type StateRecord = Record<string, unknown>;

function readState(): StateRecord {
  const state = window.history.state;
  return state && typeof state === "object" && !Array.isArray(state) ? (state as StateRecord) : {};
}

function same<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (a && b && typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

export interface HistoryStep<T> {
  /** The current step. */
  value: T;
  /** Moves to a step. Pushes a history entry unless `replace` is set. */
  go: (next: T, options?: { replace?: boolean }) => void;
  /**
   * Undoes one step: pops the entry `go` pushed, or — when this step was
   * restored without one (reload from a draft, deep link) — replaces it with
   * `parentOf(value)`. Returns false when there is no step to undo
   * (`parentOf` gave undefined), so the caller can leave the screen instead.
   */
  back: () => boolean;
}

/**
 * An in-page step (wizard step, opened match, drill-down) that behaves like a
 * screen: moving forward adds a history entry, so the phone's Back key, the
 * browser's Back button and the on-screen Back control all undo it the same
 * way. The step is kept in `history.state` under `key`, so it survives a
 * reload. `T` must be serialisable (ids, not loaded objects) and must not
 * include `undefined`, which `parentOf` uses for "this is the first step".
 */
export function useHistoryStep<T>(
  key: string,
  initial: T | (() => T),
  parentOf: (value: T) => T | undefined,
): HistoryStep<T> {
  const pushedKey = `${key}~pushedAt`;
  const mountValue = useRef<T | undefined>(undefined);

  const [value, setValue] = useState<T>(() => {
    const state = readState();
    if (key in state) return state[key] as T;
    const resolved = typeof initial === "function" ? (initial as () => T)() : initial;
    return resolved;
  });
  if (mountValue.current === undefined) mountValue.current = value;

  const valueRef = useRef(value);
  valueRef.current = value;
  const parentOfRef = useRef(parentOf);
  parentOfRef.current = parentOf;

  // Record the starting step on the entry the screen opened on, so popping
  // back to it restores that step rather than whatever a draft says later.
  useEffect(() => {
    const state = readState();
    if (key in state) return;
    try {
      window.history.replaceState({ ...state, [key]: valueRef.current }, "");
    } catch {
      // ignore
    }
  }, [key]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state && typeof event.state === "object" ? (event.state as StateRecord) : {};
      setValue(key in state ? (state[key] as T) : (mountValue.current as T));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [key]);

  const go = useCallback(
    (next: T, options?: { replace?: boolean }) => {
      const state = readState();
      if (options?.replace) {
        try {
          window.history.replaceState({ ...state, [key]: next }, "");
        } catch {
          // ignore
        }
      } else {
        if (same(next, valueRef.current)) return;
        try {
          // The marker records which entry this hook pushed, so `back` knows
          // the entry before it is the previous step. It is the entry's own
          // index: a copy carried into a later entry by someone else's
          // pushState won't match that entry's index.
          window.history.pushState({ ...state, [key]: next, [pushedKey]: currentNavIndex() + 1 }, "");
        } catch {
          // ignore
        }
      }
      valueRef.current = next;
      setValue(next);
    },
    [key, pushedKey],
  );

  const back = useCallback((): boolean => {
    const state = readState();
    const pushedAt = state[pushedKey];
    if (typeof pushedAt === "number" && pushedAt === currentNavIndex() && key in state) {
      window.history.back();
      return true;
    }
    const parent = parentOfRef.current(valueRef.current);
    if (parent === undefined) return false;
    go(parent, { replace: true });
    return true;
  }, [go, key, pushedKey]);

  // The phone's Back key undoes this step first, like the on-screen control.
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => registerStepHandler(() => backRef.current()), []);

  return { value, go, back };
}
