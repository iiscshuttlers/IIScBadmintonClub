import { Star } from "lucide-react";
import { getTournamentTheme, RANKED_TOKENS, type TournamentThemeInput } from "@/lib/tournamentTheme";

/**
 * One line of text naming the event family and whether it counts for Elo,
 * e.g. "Individual · ★ Ranked". Words, not icon-only badges, so a viewer
 * can read it without knowing the icons.
 */
export function EventKindLabel({ className = "", ...input }: TournamentThemeInput & { className?: string }) {
  const { familyLabel, tokens, ranked } = getTournamentTheme(input);
  const rank = ranked ? RANKED_TOKENS.ranked : RANKED_TOKENS.unranked;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${className}`}
      title={`${familyLabel} · ${rank.label} (${rank.sublabel})`}
    >
      <span className={tokens.text}>{familyLabel}</span>
      <span className="text-faint" aria-hidden="true">·</span>
      <span className={`inline-flex items-center gap-1 ${rank.text}`}>
        {ranked && <Star className="w-3 h-3 fill-current" aria-hidden="true" />}
        {rank.label}
      </span>
    </span>
  );
}
