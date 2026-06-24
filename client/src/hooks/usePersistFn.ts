import { useRef } from "react";

type noop = (...args: any[]) => any;

/**
 * Stable function reference that always calls the latest version of fn.
 * Use instead of useCallback when the function body changes frequently.
 */
export function usePersistFn<T extends noop>(fn: T) {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T>(null);
  if (!persistFn.current) {
    persistFn.current = function (this: unknown, ...args) {
      return fnRef.current!.apply(this, args);
    } as T;
  }

  return persistFn.current!;
}
