import { useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Undo2, type LucideIcon } from "lucide-react";
import type { ItemStatus } from "./contentModel";

/**
 * A collapsible block inside a Content hub tab. Several sections share one
 * page instead of hiding behind a second row of tabs; the hub-wide save bar
 * saves them together.
 */
export function ContentSection({
  id,
  icon: Icon,
  title,
  description,
  count,
  updatedAt,
  dirty,
  onDiscard,
  actions,
  defaultOpen = true,
  children,
}: {
  /** Anchor id, so the Overview can jump straight here. */
  id: string;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Short status text, e.g. "3 live · 1 scheduled". */
  count?: ReactNode;
  updatedAt?: string | null;
  dirty?: boolean;
  onDiscard?: () => void;
  /** Buttons on the right of the header (e.g. "Add banner"). */
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${id}-body`;

  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-border bg-card/60 shadow-sm">
      <div className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={title}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-black text-foreground">{title}</span>
              {dirty && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-warning">
                  Unsaved
                </span>
              )}
            </span>
            {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold text-muted-foreground">
              {count}
              {updatedAt && <span>Saved {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}</span>}
            </span>
          </span>
          <ChevronDown
            className={`mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {(actions || (dirty && onDiscard)) && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {dirty && onDiscard && (
              <button
                type="button"
                onClick={onDiscard}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
              </button>
            )}
            {actions}
          </div>
        )}
      </div>
      {open && (
        <div id={bodyId} className="border-t border-border p-4 sm:p-5">
          {children}
        </div>
      )}
    </section>
  );
}

const STATUS_STYLE: Record<ItemStatus | "archived", { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-success/15 text-success border-success/30" },
  scheduled: { label: "Scheduled", cls: "bg-info/15 text-info border-info/30" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground border-border-strong" },
  off: { label: "Off", cls: "bg-muted text-muted-foreground border-border-strong" },
  archived: { label: "Archived", cls: "bg-muted text-muted-foreground border-border-strong" },
};

export function StatusChip({ status }: { status: ItemStatus | "archived" }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

/** "3 live · 1 scheduled" from a list of statuses (zero counts left out). */
export function statusCounts(statuses: (ItemStatus | "archived")[]): string {
  const order: (ItemStatus | "archived")[] = ["live", "scheduled", "ended", "off", "archived"];
  const parts = order
    .map((s) => [s, statuses.filter((x) => x === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${STATUS_STYLE[s].label.toLowerCase()}`);
  return parts.length ? parts.join(" · ") : "None yet";
}
