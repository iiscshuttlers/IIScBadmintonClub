import { useEffect } from "react";

export interface UmpireKeyboardActions {
  onAddPointTeam1?: () => void;
  onAddPointTeam2?: () => void;
  onDeductPointTeam1?: () => void;
  onDeductPointTeam2?: () => void;
  onCallLet?: () => void;
  onCallServiceFault?: () => void;
  enabled?: boolean;
}

export function useUmpireKeyboard({
  onAddPointTeam1,
  onAddPointTeam2,
  onDeductPointTeam1,
  onDeductPointTeam2,
  onCallLet,
  onCallServiceFault,
  enabled = true,
}: UmpireKeyboardActions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      switch (key) {
        case "1":
        case "q":
          e.preventDefault();
          onAddPointTeam1?.();
          break;
        case "2":
        case "p":
          e.preventDefault();
          onAddPointTeam2?.();
          break;
        case "u":
        case "z":
          e.preventDefault();
          // Prefer team 1 deduct or generic undo
          onDeductPointTeam1?.();
          break;
        case "l":
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          onCallLet?.();
          break;
        case "f":
          e.preventDefault();
          onCallServiceFault?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    onAddPointTeam1,
    onAddPointTeam2,
    onDeductPointTeam1,
    onDeductPointTeam2,
    onCallLet,
    onCallServiceFault,
  ]);
}
