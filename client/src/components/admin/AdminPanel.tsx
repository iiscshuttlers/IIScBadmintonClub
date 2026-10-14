import { ReactNode } from "react";
import { Inbox } from "lucide-react";

/**
 * Shared admin panel chrome — a consistent header (icon + title + optional
 * description + actions), plus matching loading and empty states. Panels keep
 * their own data/logic; this only standardizes the surrounding presentation so
 * every admin section reads as one system.
 */
export function AdminPanel({
  title,
  description,
  icon: Icon,
  actions,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-black leading-tight text-foreground">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Standard centered spinner for a loading panel. */
export function AdminLoading({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      {label && <p className="text-sm font-semibold">{label}</p>}
    </div>
  );
}

/** Standard empty state for a panel with no rows. */
export function AdminEmptyState({
  icon: Icon = Inbox,
  title,
  description,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-card/50 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-base font-black text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
