import { ArrowRight, BarChart3, ClipboardList, Loader2, Megaphone, MessageSquare, Send, Trophy, UserCheck } from "lucide-react";
import { useLocation } from "wouter";
import { AdminActionCards } from "@/components/admin/AdminActionCards";
import { useRecentAdminActivity } from "@/hooks/queries/useAdminHome";

/**
 * Admin landing page (#overview, shown as "Home"): what needs attention first,
 * then the jobs admins do most, then the latest admin actions. The statistics
 * charts live under Insights → Statistics.
 */
interface QuickAction {
  label: string;
  hint: string;
  href: string;
  icon: typeof Trophy;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "New tournament", hint: "Open the tournament manager", href: "/tournament-admin", icon: Trophy },
  { label: "Post an announcement", hint: "News, notices and polls", href: "/admin?tab=posts#content", icon: Megaphone },
  { label: "Send a push", hint: "Notify members' phones", href: "/admin?tab=posts#content", icon: Send },
  { label: "Review inbox", hint: "Feedback and reports", href: "#inbox", icon: MessageSquare },
  { label: "Approve players", hint: "New sign-ups and profiles", href: "#players", icon: UserCheck },
  { label: "Club statistics", hint: "Members, matches and ratings", href: "#stats", icon: BarChart3 },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminHome({ onOpenTab }: { onOpenTab: (hashOrTab: string) => void }) {
  const [, setLocation] = useLocation();
  const activity = useRecentAdminActivity(true, 5);

  const open = (href: string) => {
    if (href.startsWith("#")) onOpenTab(href.slice(1));
    else if (href.startsWith("/admin")) {
      // Same page, different panel + sub-tab (ContentHub reads ?tab= when it mounts).
      window.history.pushState(null, "", href);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else setLocation(href);
  };

  return (
    <div className="space-y-8">
      <AdminActionCards onOpenTab={onOpenTab} />

      <section aria-labelledby="admin-quick-heading">
        <h2 id="admin-quick-heading" className="mb-2 text-sm font-black uppercase tracking-wider text-muted-foreground">
          Quick actions
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <li key={a.label}>
                <button
                  type="button"
                  onClick={() => open(a.href)}
                  className="flex h-full min-h-[44px] w-full items-start gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground">{a.label}</span>
                    <span className="block text-xs text-muted-foreground">{a.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="admin-recent-heading">
        <div className="mb-2 flex items-center gap-2">
          <h2 id="admin-recent-heading" className="flex-1 text-sm font-black uppercase tracking-wider text-muted-foreground">
            Recent admin activity
          </h2>
          <button
            type="button"
            onClick={() => onOpenTab("activity_log")}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-xs font-bold text-primary hover:bg-muted"
          >
            See all <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
        {activity.isPending ? (
          <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </p>
        ) : activity.isError ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Couldn't load recent activity.{" "}
            <button type="button" className="font-bold underline" onClick={() => void activity.refetch()}>Try again</button>
          </p>
        ) : (activity.data ?? []).length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <ClipboardList className="h-4 w-4" aria-hidden /> No admin actions logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {(activity.data ?? []).map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
                <span className="min-w-0 flex-1 break-words text-sm font-bold capitalize text-foreground">
                  {log.action.replace(/_/g, " ").toLowerCase()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {log.admin_email.split("@")[0]} · {formatWhen(log.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
