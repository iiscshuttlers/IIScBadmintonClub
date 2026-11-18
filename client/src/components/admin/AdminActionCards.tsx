import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useAdminActionItems } from "@/hooks/queries/useAdminActionItems";
import type { AdminActionCard } from "@/lib/adminActions";

/**
 * "Needs attention" list at the top of the admin dashboard (WP7). Every card
 * opens the screen that resolves it; counts come from the server on each
 * visit, never from a cached total.
 */
export function AdminActionCards({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const [, setLocation] = useLocation();
  const q = useAdminActionItems(true);

  const open = (card: AdminActionCard) => {
    if (card.href.startsWith("#")) onOpenTab(card.href.slice(1));
    else setLocation(card.href);
  };
  const error = q.error as { code?: string; status?: number } | null;
  const denied = error?.code === "42501" || error?.status === 401 || error?.status === 403;

  return (
    <section aria-labelledby="admin-actions-heading" className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 id="admin-actions-heading" className="text-sm font-black uppercase tracking-wider text-muted-foreground flex-1">
          Needs attention
        </h2>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
          aria-label="Refresh the list of items needing attention"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${q.isFetching ? "animate-spin" : ""}`} aria-hidden /> Refresh
        </button>
      </div>

      {q.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Checking…
        </p>
      ) : q.isError && !q.data ? (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm">
          {denied
            ? "You don't have permission to inspect these operational issue sources. No all-clear can be calculated. "
            : "Couldn't check for outstanding items, so their status is unknown. "}
          <button type="button" className="underline font-bold" onClick={() => void q.refetch()}>Try again</button>
        </p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <CheckCircle2 className="w-4 h-4 text-[var(--success)]" aria-hidden /> Nothing needs attention right now.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {(q.data ?? []).map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => open(card)}
                className={`w-full text-left rounded-2xl border p-4 min-h-[44px] bg-card transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  card.severity === "high" ? "border-[var(--danger)]/50" : "border-border"
                }`}
              >
                <span className="flex items-start gap-2">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${card.severity === "high" ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-sm break-words">{card.title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{card.detail}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-black text-primary">
                      {card.actionLabel} <ArrowRight className="w-3 h-3" aria-hidden />
                    </span>
                  </span>
                </span>
                <span className="sr-only">{card.severity === "high" ? "High priority" : "Medium priority"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.isError && q.data && (
        <p className="mt-1 text-xs text-muted-foreground">Last refresh failed; showing the previous check.</p>
      )}
    </section>
  );
}
