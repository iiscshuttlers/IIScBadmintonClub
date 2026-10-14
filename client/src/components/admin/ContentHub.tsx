import { useState } from "react";
import {
  Paintbrush,
  Megaphone,
  Calendar,
  Video,
  UserRound,
} from "lucide-react";
import { ContentEditorWrapper } from "./ContentEditorWrapper";
import { ConfigEditor } from "./editors/ConfigEditor";
import { HolidayEditor } from "./editors/HolidayEditor";
import { PollEditor } from "./editors/PollEditor";
import { VideoEditor } from "./editors/VideoEditor";
import { NoticeboardManager } from "./NoticeboardManager";
import { HomeBannerManager } from "./HomeBannerManager";
import { ConvenerEditor, DEFAULT_CONVENER_DATA } from "./ConvenerEditor";

/**
 * Content hub — unifies the former Landing Pages, Home Banners, Noticeboard,
 * Polls, Holidays, Videos and Convener Photos tabs into one panel with
 * sub-tabs. The underlying editors (ContentEditorWrapper + its writeTransformer
 * logic, NoticeboardManager, HomeBannerManager) are unchanged.
 */
type SubTab =
  | "landing"
  | "banners"
  | "noticeboard"
  | "polls"
  | "holidays"
  | "videos"
  | "conveners";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Paintbrush }[] = [
  { id: "landing", label: "Landing", icon: Paintbrush },
  { id: "banners", label: "Home Banners", icon: Megaphone },
  { id: "noticeboard", label: "Noticeboard", icon: Megaphone },
  { id: "polls", label: "Polls", icon: Megaphone },
  { id: "holidays", label: "Holidays", icon: Calendar },
  { id: "videos", label: "Videos", icon: Video },
  { id: "conveners", label: "Conveners", icon: UserRound },
];

export function ContentHub() {
  const [tab, setTab] = useState<SubTab>("landing");
  // NoticeboardManager reports per-section counts; the hub doesn't surface them,
  // so absorb them into local state to satisfy the prop.
  const [, setTabCounts] = useState<Record<string, number>>({});

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
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

      {tab === "landing" && (
        <ContentEditorWrapper
          dbKey="site_config"
          emptyState={null}
          editorName="Landing Page Config"
          EditorComponent={ConfigEditor}
        />
      )}

      {tab === "banners" && <HomeBannerManager />}

      {tab === "noticeboard" && <NoticeboardManager setTabCounts={setTabCounts} />}

      {tab === "polls" && (
        <ContentEditorWrapper
          dbKey="polls"
          emptyState={{ polls: [] }}
          editorName="Polls"
          EditorComponent={(props: any) => (
            <PollEditor data={props.data.polls || []} onChange={(d) => props.onChange({ polls: d })} />
          )}
          writeTransformer={(data: any) => ({ polls: data.polls })}
          countExtractor={(data: any) => data.polls?.length ?? 0}
        />
      )}

      {tab === "holidays" && (
        <ContentEditorWrapper
          dbKey="holidays"
          emptyState={[]}
          editorName="Holidays"
          EditorComponent={HolidayEditor}
          writeTransformer={(data) => data.filter((h: any) => h.date && h.name)}
        />
      )}

      {tab === "videos" && (
        <ContentEditorWrapper
          dbKey="videos"
          emptyState={[]}
          editorName="Videos"
          EditorComponent={VideoEditor}
          writeTransformer={(data) => data.filter((v: any) => v.title && v.videoId)}
        />
      )}

      {tab === "conveners" && (
        <ContentEditorWrapper
          dbKey="convener_photos"
          emptyState={DEFAULT_CONVENER_DATA}
          editorName="Convener Photos"
          EditorComponent={ConvenerEditor}
        />
      )}
    </div>
  );
}
