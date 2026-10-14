import { useState } from "react";
import { Grid, BarChart3 } from "lucide-react";
import { AdminAllFeaturesPanel } from "./AdminAllFeaturesPanel";
import { FeatureMapDashboard } from "./FeatureMapDashboard";

/**
 * Features — merges the former "All Features" catalog and "Codebase Survey"
 * statistics into one panel with sub-tabs. (Live operational tools live
 * separately under System › Live Ops / AdminFeaturesPanel.)
 */
type SubTab = "catalog" | "survey";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Grid }[] = [
  { id: "catalog", label: "Catalog", icon: Grid },
  { id: "survey", label: "Survey", icon: BarChart3 },
];

export function FeaturesPanel() {
  const [tab, setTab] = useState<SubTab>("catalog");

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

      <div className={tab === "catalog" ? "block" : "hidden"}>
        <AdminAllFeaturesPanel />
      </div>
      <div className={tab === "survey" ? "block" : "hidden"}>
        <FeatureMapDashboard />
      </div>
    </div>
  );
}
