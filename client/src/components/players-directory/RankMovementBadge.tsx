import { movementLabel, type RankMovement } from "@/lib/rankMovement";

const TONE: Record<string, string> = {
  up: "text-success",
  down: "text-danger",
  same: "text-muted-foreground",
  new: "text-info",
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
