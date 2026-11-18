import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import type { MatchView } from "@/lib/matchView";
import { canShareResult } from "@/lib/matchViewShare";
import { fetchTournamentName } from "@/services/tournamentService";

/**
 * "Share result" for a decided tournament match: renders the PNG score card
 * and opens the native/Web share sheet (download fallback). The share code
 * (canvas + Capacitor plugins) is loaded on first tap.
 */
export function ShareResultButton({
  view,
  tournamentName,
  variant = "button",
}: {
  view: MatchView;
  tournamentName?: string | null;
  variant?: "button" | "icon";
}) {
  const [busy, setBusy] = useState(false);
  if (!canShareResult(view)) return null;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      let name = tournamentName ?? null;
      if (!name) {
        name = await fetchTournamentName(view.tournamentId);
      }
      const { shareTournamentMatch } = await import("@/lib/shareMatch");
      await shareTournamentMatch(view, name);
    } finally {
      setBusy(false);
    }
  };

  const label = `Share result: ${view.sides[0].label} versus ${view.sides[1].label}`;
  const Icon = busy ? Loader2 : Share2;

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title="Share result"
        aria-busy={busy}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
      >
        <Icon className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-busy={busy}
      className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-primary text-primary-foreground text-sm font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-60"
      disabled={busy}
    >
      <Icon className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
      Share result
    </button>
  );
}
