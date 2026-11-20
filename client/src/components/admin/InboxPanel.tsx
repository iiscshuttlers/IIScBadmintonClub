import { useState } from "react";
import { MessageSquare, ShieldAlert } from "lucide-react";
import { AdminFeedbackPanel } from "./AdminFeedbackPanel";
import { ModerationPanel } from "./ModerationPanel";

/**
 * Inbox — unifies the admin review queues (user feedback and player
 * reports/moderation) into one panel with sub-tabs. The underlying panels
 * are unchanged.
 */
type SubTab = "feedback" | "reports";

const SUB_TABS: { id: SubTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: ShieldAlert },
];

export function InboxPanel() {
  const [tab, setTab] = useState<SubTab>("feedback");

  return (
    <div className="space-y-6">
      <div className="flex w-fit gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition-all ${
                active
                  ? "bg-primary/40 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "feedback" && <AdminFeedbackPanel />}
      {tab === "reports" && <ModerationPanel />}
    </div>
  );
}
