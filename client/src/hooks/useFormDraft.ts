import { useState, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

/**
 * Persists a standard React state form to localStorage.
 */
export function useFormDraft<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`draft_${key}`);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`draft_${key}`, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(`draft_${key}`);
      setState(initialValue);
    } catch {
      // ignore
    }
  };

  return [state, setState, clearDraft];
}

/**
 * Persists a react-hook-form state to localStorage.
 */
export function useRHFDraft<T extends Record<string, any>>(key: string, methods: UseFormReturn<T>, defaultValues?: Partial<T>) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`draft_${key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        methods.reset(parsed);
      }
    } catch {
      // ignore
    }
  }, [key, methods]);

  useEffect(() => {
    const subscription = methods.watch((value) => {
      try {
        localStorage.setItem(`draft_${key}`, JSON.stringify(value));
      } catch {
        // ignore
      }
    });
    return () => subscription.unsubscribe();
  }, [key, methods]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(`draft_${key}`);
      if (defaultValues) {
        methods.reset(defaultValues as any);
      }
    } catch {
      // ignore
    }
  };

  return { clearDraft };
}
