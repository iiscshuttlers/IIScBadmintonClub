import { useState } from "react";
import { MessageSquare, ShieldAlert, AlertTriangle } from "lucide-react";
import { AdminFeedbackPanel } from "./AdminFeedbackPanel";
import { ModerationPanel } from "./ModerationPanel";
import { DisputePanel } from "./DisputePanel";

/**
 * Inbox — unifies the three admin review queues (user feedback, player
 * reports/moderation, match disputes) into one panel with sub-tabs. The
 * underlying panels are unchanged.
 */
type SubTab = "feedback" | "reports" | "disputes";

const SUB_TABS: { id: SubTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: ShieldAlert },
  { id: "disputes", label: "Disputes", icon: AlertTriangle },
];

export function InboxPanel() {
  const [tab, setTab] = useState<SubTab>("feedback");

  return (
    <div className="space-y-6">
      <div className="flex w-fit gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition-all ${
                active
                  ? "bg-primary/10 text-primary dark:bg-primary/40 dark:text-primary"
                  : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
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
      {tab === "disputes" && <DisputePanel />}
    </div>
  );
}
