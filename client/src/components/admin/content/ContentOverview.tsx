import { AlertTriangle, ArrowRight, Bell, CalendarDays, CheckCircle2, Home, Info, ListChecks, Megaphone, Plus, Wrench } from "lucide-react";
import { activeTickerFlyers, buildHomeBanners, isoDay, todayIST } from "@/lib/homeBanners";
import { contentAttention, pollStatus, type ContentKey, type ContentTab } from "./contentModel";
import { useContentStore } from "./contentStore";
import { HomePreview } from "./HomePreview";

export type QuickAction = "announcement" | "banner" | "poll" | "event" | "push";

const QUICK: { id: QuickAction; label: string; Icon: typeof Plus }[] = [
  { id: "announcement", label: "Announcement", Icon: Megaphone },
  { id: "banner", label: "Home banner", Icon: Home },
  { id: "poll", label: "Poll", Icon: ListChecks },
  { id: "event", label: "Event", Icon: CalendarDays },
  { id: "push", label: "Push notification", Icon: Bell },
];

/** Date `days` after today, in IST, as YYYY-MM-DD. */
const inDays = (days: number) => todayIST(new Date(Date.now() + days * 86_400_000));

/** One screen answering: what's live, what's coming, and what needs fixing. */
export function ContentOverview({
  today,
  onJump,
  onQuick,
}: {
  today: string;
  onJump: (tab: ContentTab, section?: ContentKey | string) => void;
  onQuick: (action: QuickAction) => void;
}) {
  const { docs, setDoc, dirtyKeys } = useContentStore();
  const homeDirty = dirtyKeys.some((k) => k === "home_banners" || k === "announcements" || k === "events" || k === "flyers");
  const onHome = buildHomeBanners(
    { home_banners: docs.home_banners, announcements: docs.announcements, events: docs.events, flyers: docs.flyers },
    today,
  );
  const ticker = activeTickerFlyers(docs.flyers, docs.announcements.recent, today);
  const livePolls = docs.polls.filter((p) => pollStatus(p) === "live");
  const liveVotes = livePolls.reduce((n, p) => n + (p.options ?? []).reduce((m, o) => m + (o.votes?.length ?? 0), 0), 0);
  const horizon = inDays(30);
  const upcomingEvents = docs.events
    .filter((e) => {
      const d = isoDay(e.date);
      return d && d >= today && d <= horizon;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingHolidays = docs.holidays.filter((h) => h.date >= today && h.date <= horizon);
  const attention = contentAttention(docs, today);

  const tiles: { label: string; value: number; sub: string; Icon: typeof Home; tab: ContentTab; section?: string }[] = [
    {
      label: "On Home",
      value: onHome.length,
      sub: ticker.length ? `${ticker.length} in the ticker` : "Ticker empty",
      Icon: Home,
      tab: "home",
      section: "preview",
    },
    {
      label: "Announcements",
      value: docs.announcements.recent.length,
      sub: docs.announcements.hiddenAuto.length ? `${docs.announcements.hiddenAuto.length} auto posts hidden` : "All auto posts shown",
      Icon: Megaphone,
      tab: "posts",
      section: "announcements",
    },
    {
      label: "Polls open",
      value: livePolls.length,
      sub: `${liveVotes} vote${liveVotes === 1 ? "" : "s"} so far`,
      Icon: ListChecks,
      tab: "posts",
      section: "polls",
    },
    {
      label: "Next 30 days",
      value: upcomingEvents.length + upcomingHolidays.length,
      sub: upcomingEvents[0] ? `Next: ${upcomingEvents[0].title}` : `${upcomingHolidays.length} holiday${upcomingHolidays.length === 1 ? "" : "s"}`,
      Icon: CalendarDays,
      tab: "calendar",
      section: "events",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(({ label, value, sub, Icon, tab, section }) => (
          <button
            key={label}
            type="button"
            onClick={() => onJump(tab, section)}
            className="group rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              {label}
              <Icon className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <span className="mt-1 block text-3xl font-black text-foreground tabular-nums">{value}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{sub}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Create</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onQuick(id)}
              className="flex items-center gap-2 rounded-xl border border-border-strong bg-muted px-3 py-2 text-sm font-bold text-foreground transition hover:border-primary/50 hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5 text-primary" aria-hidden />
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <section aria-labelledby="content-attention" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 id="content-attention" className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" aria-hidden /> Needs attention
            {attention.length > 0 && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">{attention.length}</span>
            )}
          </h2>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Nothing needs fixing.
            </p>
          ) : (
            <ul className="space-y-2">
              {attention.map((a) => (
                <li key={a.id} className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="flex items-start gap-2 text-sm text-soft">
                    {a.tone === "warn" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
                    )}
                    <span className="min-w-0 break-words">{a.text}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                    {a.fix && (
                      <button
                        type="button"
                        onClick={() => setDoc(a.fix!.key, a.fix!.apply(docs) as never)}
                        className="rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/25"
                      >
                        {a.fix.label}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onJump(a.tab, a.section)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {attention.some((a) => a.fix) && (
            <p className="mt-3 text-xs text-muted-foreground">Fixes change your draft; they go live when you save.</p>
          )}
        </section>

        <section aria-labelledby="content-home-now" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 id="content-home-now" className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <Home className="h-3.5 w-3.5" aria-hidden /> {homeDirty ? "Home after you save" : "Home right now"}
          </h2>
          <HomePreview today={today} onJump={onJump} />
        </section>
      </div>
    </div>
  );
}
