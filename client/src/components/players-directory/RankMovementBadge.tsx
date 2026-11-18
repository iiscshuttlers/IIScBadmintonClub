import { movementLabel, type RankMovement } from "@/lib/rankMovement";

const TONE: Record<string, string> = {
  up: "text-emerald-700 dark:text-emerald-400",
  down: "text-rose-700 dark:text-rose-400",
  same: "text-muted-foreground",
  new: "text-sky-700 dark:text-sky-400",
};

/** ▲3 / ▼1 / – / NEW / RE — arrow and number (or word), never colour alone. */
export function RankMovementBadge({ movement, className = "" }: { movement: RankMovement | undefined; className?: string }) {
  const l = movementLabel(movement);
  if (!l) return null;
  return (
    <span title={l.long} className={`inline-flex items-center font-black tabular-nums text-[10px] leading-none ${TONE[l.tone] ?? ""} ${className}`}>
      <span aria-hidden>{l.text}</span>
      <span className="sr-only">{l.long}</span>
    </span>
  );
}
