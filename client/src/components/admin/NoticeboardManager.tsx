import React, { useState } from "react";
import { Megaphone, CalendarDays, FileImage } from "lucide-react";
import { ContentEditorWrapper } from "./ContentEditorWrapper";
import { FlyerEditor } from "./editors/FlyerEditor";
import { AnnouncementEditor } from "./editors/AnnouncementEditor";
import { EventEditor } from "./editors/EventEditor";
import { PushBroadcastPanel } from "./editors/PushBroadcastPanel";
import { Bell } from "lucide-react";

type SubTabId = "announcements" | "events" | "flyers" | "push";

export function NoticeboardManager({
  setTabCounts
}: {
  setTabCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  const [activeTab, setActiveTab] = useState<SubTabId>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as SubTabId;
    return ["announcements", "events", "flyers", "push"].includes(tab) ? tab : "announcements";
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", newUrl);
  }, [activeTab]);
  const tabs: { id: SubTabId; label: string; icon: any }[] = [
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "events", label: "Events", icon: CalendarDays },
    { id: "flyers", label: "Flyers", icon: FileImage },
    { id: "push", label: "Broadcast", icon: Bell },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex bg-white dark:bg-slate-900 rounded-2xl p-1.5 border border-slate-200 dark:border-slate-800 w-fit max-w-full overflow-x-auto mx-auto sm:mx-0 shadow-sm">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Renders - Keeping them mounted so unsaved changes aren't lost when switching sub-tabs */}
      <div className={activeTab === "announcements" ? "block" : "hidden"}>
        <ContentEditorWrapper
          dbKey="announcements"
          emptyState={{ recent: [] }}
          editorName="Announcements"
          EditorComponent={(props: any) => (
            <AnnouncementEditor
              data={props.data.recent || []}
              onChange={(d) => props.onChange({ recent: d })}
            />
          )}
          writeTransformer={(data: any) => ({
            recent: data.recent.filter((a: any) => a.title),
          })}
          setTabCount={(c) =>
            setTabCounts((prev) => ({ ...prev, announcements: c }))
          }
          countExtractor={(data: any) => data.recent?.length ?? 0}
        />
      </div>

      <div className={activeTab === "events" ? "block" : "hidden"}>
        <ContentEditorWrapper
          dbKey="events"
          emptyState={[]}
          editorName="Events"
          EditorComponent={EventEditor}
          writeTransformer={(data) =>
            data.filter((e: any) => e.title && e.date)
          }
          setTabCount={(c) =>
            setTabCounts((prev) => ({ ...prev, events: c }))
          }
        />
      </div>

      <div className={activeTab === "flyers" ? "block" : "hidden"}>
        <ContentEditorWrapper
          dbKey="flyers"
          emptyState={[]}
          editorName="Flyers"
          EditorComponent={FlyerEditor}
          setTabCount={(c) =>
            setTabCounts((prev) => ({ ...prev, flyers: c }))
          }
        />
      </div>

      <div className={activeTab === "push" ? "block max-w-2xl mx-auto" : "hidden"}>
        <PushBroadcastPanel />
      </div>
    </div>
  );
}
