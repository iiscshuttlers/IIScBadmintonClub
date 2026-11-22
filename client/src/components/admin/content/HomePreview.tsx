import { CalendarDays, ClipboardList, EyeOff, Info, Megaphone, PartyPopper, Pencil, Pin } from "lucide-react";
import { activeTickerFlyers, buildHomeBanners, type HomeBannerSource, type ResolvedHomeBanner } from "@/lib/homeBanners";
import type { ContentKey, ContentTab } from "./contentModel";
import { useContentStore } from "./contentStore";

const SOURCE: Record<HomeBannerSource, { label: string; tab: ContentTab; section: ContentKey }> = {
  banner: { label: "Home banner", tab: "home", section: "home_banners" },
  announcement: { label: "Announcement", tab: "posts", section: "announcements" },
  event: { label: "Event", tab: "calendar", section: "events" },
  flyer: { label: "Flyer", tab: "home", section: "flyers" },
};

const TYPE_ICON = { announcement: Megaphone, notice: Info, registration: ClipboardList, custom: PartyPopper } as const;

const ICON_TONE: Record<string, string> = {
  blue: "bg-info/20 text-info",
  green: "bg-success/20 text-success",
  amber: "bg-warning/20 text-warning",
  red: "bg-danger/20 text-danger",
  purple: "bg-individual/20 text-individual",
};

/**
 * Home exactly as members will see it once the current drafts are saved:
 * the notice stack (one shown, the rest behind "Show more") and the ticker.
 */
export function HomePreview({ today, onJump }: { today: string; onJump: (tab: ContentTab, section: ContentKey) => void }) {
  const { docs, setDoc } = useContentStore();
  const banners = buildHomeBanners(
    { home_banners: docs.home_banners, announcements: docs.announcements, events: docs.events, flyers: docs.flyers },
    today,
  );
  const ticker = activeTickerFlyers(docs.flyers, docs.announcements.recent, today);

  const removeFromHome = (b: ResolvedHomeBanner) => {
    const i = b.sourceIndex;
    switch (b.source) {
      case "banner":
        setDoc("home_banners", (list) => list.map((x, j) => (j === i ? { ...x, active: false } : x)));
        break;
      case "announcement":
        setDoc("announcements", (d) => ({
          ...d,
          recent: d.recent.map((a, j) =>
            j === i ? { ...a, showOnHome: false, flyer: a.flyer ? { ...a.flyer, showOnHome: false } : a.flyer } : a,
          ),
        }));
        break;
      case "event":
        setDoc("events", (list) => list.map((x, j) => (j === i ? { ...x, showOnHome: false } : x)));
        break;
      case "flyer":
        setDoc("flyers", (list) => list.map((x, j) => (j === i ? { ...x, showOnHome: false } : x)));
        break;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Notices on Home</h3>
        {banners.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong p-4 text-center text-sm text-muted-foreground">
            Nothing is on Home. Add a banner, or tick “Show on Home” on an announcement or event.
          </p>
        ) : (
          <ol className="space-y-2">
            {banners.map((b, n) => {
              const Icon = TYPE_ICON[b.type] ?? Megaphone;
              const src = SOURCE[b.source];
              return (
                <li key={`${b.source}-${b.id}-${n}`} className={`rounded-xl border p-3 ${n === 0 ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ICON_TONE[b.color] ?? ICON_TONE.blue}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                        <span className={n === 0 ? "text-primary" : "text-muted-foreground"}>
                          {n === 0 ? "Shown first" : `Behind “Show more” · #${n + 1}`}
                        </span>
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">{src.label}</span>
                        {b.pinned && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-warning">
                            <Pin className="h-2.5 w-2.5" aria-hidden /> Pinned
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-bold text-foreground break-words">{b.title || "Untitled"}</p>
                      {b.message && <p className="mt-0.5 line-clamp-2 text-xs text-soft whitespace-pre-wrap">{b.message}</p>}
                      {b.link_url && (
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          Button: {b.link_label || "Learn More"} → <span className="font-mono">{b.link_url}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onJump(src.tab, src.section)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromHome(b)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-danger hover:bg-danger/10"
                    >
                      <EyeOff className="h-3.5 w-3.5" aria-hidden /> Remove from Home
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Scrolling ticker</h3>
        {ticker.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flyers are scrolling right now.</p>
        ) : (
          <ul className="space-y-1.5">
            {ticker.map((f, n) => (
              <li key={`${f.id}-${n}`} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-soft">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{(f.items ?? []).map((it) => it.text).join(" • ") || "Empty flyer"}</span>
                {f.endDate && <span className="ml-auto shrink-0 text-muted-foreground">until {f.endDate}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
