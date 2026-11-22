import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Bell,
  CalendarDays,
  Eye,
  Home,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Palmtree,
  Plus,
  ScrollText,
  Sparkles,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { safeGetSearchParams, safeReplaceState, isCapacitor } from "@/lib/navUtils";
import { buildHomeBanners, isoDay, todayIST } from "@/lib/homeBanners";
import type { Announcement, EventItem } from "./editors/shared";
import { AnnouncementEditor } from "./editors/AnnouncementEditor";
import { EventEditor } from "./editors/EventEditor";
import { FlyerEditor } from "./editors/FlyerEditor";
import { HolidayEditor } from "./editors/HolidayEditor";
import { PollEditor, defaultPollTournament, newPoll, useTournamentOptions } from "./editors/PollEditor";
import { PushBroadcastPanel } from "./editors/PushBroadcastPanel";
import { VideoEditor } from "./editors/VideoEditor";
import { ConvenerEditor } from "./ConvenerEditor";
import { ClubPageEditor } from "./content/ClubPageEditor";
import { ContentOverview, type QuickAction } from "./content/ContentOverview";
import { ContentSaveBar } from "./content/ContentSaveBar";
import { ContentSection, statusCounts } from "./content/ContentSection";
import { HomeBannerEditor, newHomeBanner } from "./content/HomeBannerEditor";
import { HomePreview } from "./content/HomePreview";
import { contentAttention, DOC_SPECS, itemStatus, pollStatus, type ContentTab } from "./content/contentModel";
import { ContentStoreProvider, useContentDoc, useContentStore } from "./content/contentStore";

/**
 * Content hub: everything members read that isn't a tournament. One row of
 * tabs grouped by where things appear; each tab stacks its editors as
 * sections, and a single bar saves every change together.
 *
 *   Overview  what's live, what's coming, what needs fixing, quick create
 *   Home      Home preview, Home banners, ticker flyers
 *   Posts     announcements (incl. automatic posts), polls, push
 *   Calendar  events, holidays
 *   Club page About text and numbers, conveners, videos
 */
const TABS: { id: ContentTab; label: string; Icon: typeof Home }[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "home", label: "Home", Icon: Home },
  { id: "posts", label: "Posts", Icon: Megaphone },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "club", label: "Club page", Icon: Users },
];

/** Old sub-tab names (?tab=… and #… links) mapped to the tab that holds them now. */
const LEGACY_TAB: Record<string, ContentTab> = {
  landing: "club",
  config: "club",
  banners: "home",
  home_banners: "home",
  flyers: "home",
  noticeboard: "posts",
  announcements: "posts",
  push: "posts",
  polls: "posts",
  events: "calendar",
  holidays: "calendar",
  videos: "club",
  conveners: "club",
  convener_photos: "club",
};

function initialTab(): ContentTab {
  const fromQuery = safeGetSearchParams().get("tab") ?? "";
  if (TABS.some((t) => t.id === fromQuery)) return fromQuery as ContentTab;
  if (LEGACY_TAB[fromQuery]) return LEGACY_TAB[fromQuery];
  const fromHash = typeof window === "undefined" ? "" : window.location.hash.replace("#", "").split("/")[0];
  return LEGACY_TAB[fromHash] ?? "overview";
}

export function ContentHub() {
  return (
    <ContentStoreProvider>
      <ContentHubBody />
    </ContentStoreProvider>
  );
}

function ContentHubBody() {
  const [tab, setTab] = useState<ContentTab>(initialTab);
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);
  const store = useContentStore();
  const tournaments = useTournamentOptions();
  const today = todayIST();

  // Keep the open tab in the URL so a refresh or shared link lands here.
  useEffect(() => {
    const params = safeGetSearchParams();
    params.set("tab", tab);
    const hash = isCapacitor ? "" : "#content";
    safeReplaceState(`${window.location.pathname}?${params.toString()}${hash}`);
  }, [tab]);

  // After a jump, scroll the target section into view once the tab renders.
  useEffect(() => {
    if (!pendingScroll) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById(`content-${pendingScroll}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScroll(null);
    });
    return () => window.cancelAnimationFrame(id);
  }, [pendingScroll, tab]);

  const jump = (next: ContentTab, section?: string) => {
    setTab(next);
    setPendingScroll(section ?? null);
  };

  const quick = (action: QuickAction) => {
    switch (action) {
      case "announcement":
        store.setDoc("announcements", (d) => ({ ...d, recent: [newAnnouncement(), ...d.recent] }));
        return jump("posts", "announcements");
      case "banner":
        store.setDoc("home_banners", (list) => [newHomeBanner(), ...list]);
        return jump("home", "home_banners");
      case "poll":
        store.setDoc("polls", (list) => [newPoll(defaultPollTournament(tournaments)), ...list]);
        return jump("posts", "polls");
      case "event":
        store.setDoc("events", (list) => [newEvent(), ...list]);
        return jump("calendar", "events");
      case "push":
        return jump("posts", "push");
    }
  };

  const attentionCount = useMemo(
    () => contentAttention(store.docs, today).filter((a) => a.tone === "warn").length,
    [store.docs, today],
  );
  const dirtyTabs = new Set(store.dirtyKeys.map((k) => DOC_SPECS[k].tab));

  return (
    <div className="space-y-5">
      <nav aria-label="Content sections">
        <div role="tablist" className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            const badge = id === "overview" ? attentionCount : 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
                  active ? "bg-primary/40 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
                {badge > 0 && (
                  <span className="rounded-full bg-warning/20 px-1.5 text-[10px] font-black text-warning" aria-label={`${badge} warnings`}>
                    {badge}
                  </span>
                )}
                {dirtyTabs.has(id) && (
                  <span className="h-2 w-2 rounded-full bg-warning" aria-label="unsaved changes" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === "overview" && <ContentOverview today={today} onJump={jump} onQuick={quick} />}
      {tab === "home" && <HomeTab today={today} onJump={jump} />}
      {tab === "posts" && <PostsTab today={today} tournaments={tournaments} />}
      {tab === "calendar" && <CalendarTab today={today} />}
      {tab === "club" && <ClubTab />}

      <ContentSaveBar />
    </div>
  );
}

function newAnnouncement(): Announcement {
  return { title: "", date: todayIST(), category: "general", priority: "medium", content: "" };
}

function newEvent(): EventItem {
  return { date: "", title: "", link: "", registrationDeadline: "" };
}

const addBtn =
  "flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90";
const softBtn =
  "flex items-center gap-1.5 rounded-xl border border-border-strong px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground";

/* ------------------------------------------------------------------ */

function HomeTab({ today, onJump }: { today: string; onJump: (tab: ContentTab, section?: string) => void }) {
  const banners = useContentDoc("home_banners");
  const flyers = useContentDoc("flyers");
  const { docs } = useContentStore();
  const onHome = buildHomeBanners(
    { home_banners: docs.home_banners, announcements: docs.announcements, events: docs.events, flyers: docs.flyers },
    today,
  ).length;

  return (
    <div className="space-y-4">
      <ContentSection
        id="content-preview"
        icon={Eye}
        title="On Home now"
        description="Everything Home shows, from banners, announcements, events and flyers, in the order members see it."
        count={`${onHome} notice${onHome === 1 ? "" : "s"}`}
      >
        <HomePreview today={today} onJump={onJump} />
      </ContentSection>

      <ContentSection
        id="content-home_banners"
        icon={Megaphone}
        title="Home banners"
        description="Cards at the top of Home. Pinned ones go first and can't be dismissed. Set dates to schedule them."
        count={statusCounts(banners.value.map((b) => itemStatus(b.active, b.starts_on, b.ends_on, today)))}
        updatedAt={banners.updatedAt}
        dirty={banners.dirty}
        onDiscard={banners.discard}
        actions={
          <button type="button" className={addBtn} onClick={() => banners.set((list) => [newHomeBanner(), ...list])}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add banner
          </button>
        }
      >
        <HomeBannerEditor data={banners.value} onChange={banners.set} today={today} />
      </ContentSection>

      <ContentSection
        id="content-flyers"
        icon={Sparkles}
        title="Ticker flyers"
        description="Scrolling strip across the top of Home. Tick “Show on Home” on a flyer to also add it as a notice card."
        count={statusCounts(flyers.value.map((f) => itemStatus(f.enabled, f.startDate, f.endDate, today)))}
        updatedAt={flyers.updatedAt}
        dirty={flyers.dirty}
        onDiscard={flyers.discard}
      >
        <FlyerEditor data={flyers.value} onChange={flyers.set} />
      </ContentSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PostsTab({ today, tournaments }: { today: string; tournaments: ReturnType<typeof useTournamentOptions> }) {
  const ann = useContentDoc("announcements");
  const polls = useContentDoc("polls");
  const { originals } = useContentStore();
  const savedPollIds = useMemo(() => new Set(originals.polls.map((p) => p.id)), [originals.polls]);
  const onHome = ann.value.recent.filter(
    (a) => (a.showOnHome || a.flyer?.showOnHome) && (!isoDay(a.endDate) || (a.endDate as string) >= today),
  ).length;

  return (
    <div className="space-y-4">
      <ContentSection
        id="content-announcements"
        icon={ScrollText}
        title="Announcements"
        description="Posts on the Feed and the Home noticeboard. Tick “Show on Home” to add one to the Home stack too."
        count={`${ann.value.recent.length} post${ann.value.recent.length === 1 ? "" : "s"} · ${onHome} on Home`}
        updatedAt={ann.updatedAt}
        dirty={ann.dirty}
        onDiscard={ann.discard}
      >
        <AnnouncementEditor
          data={ann.value.recent}
          onChange={(recent) => ann.set((d) => ({ ...d, recent }))}
          hiddenAuto={ann.value.hiddenAuto}
          onHiddenAutoChange={(hiddenAuto) => ann.set((d) => ({ ...d, hiddenAuto }))}
        />
      </ContentSection>

      <ContentSection
        id="content-polls"
        icon={ListChecks}
        title="Polls"
        description="Prediction polls in a tournament's Live → Predict panel. Votes keep counting while you edit."
        count={statusCounts(polls.value.map((p) => pollStatus(p)))}
        updatedAt={polls.updatedAt}
        dirty={polls.dirty}
        onDiscard={polls.discard}
        actions={
          <button
            type="button"
            className={addBtn}
            onClick={() => polls.set((list) => [newPoll(defaultPollTournament(tournaments)), ...list])}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add poll
          </button>
        }
      >
        <PollEditor data={polls.value} onChange={polls.set} tournaments={tournaments} savedIds={savedPollIds} />
      </ContentSection>

      <ContentSection id="content-push" icon={Bell} title="Push notification" description="A one-off notification that isn't tied to a post or poll.">
        <PushBroadcastPanel />
      </ContentSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CalendarTab({ today }: { today: string }) {
  const events = useContentDoc("events");
  const holidays = useContentDoc("holidays");
  const upcomingEvents = events.value.filter((e) => (isoDay(e.endDate || e.date) ?? "") >= today).length;
  const upcomingHolidays = holidays.value.filter((h) => (isoDay(h.date) ?? "") >= today).length;
  const byDate = <T,>(list: T[], date: (t: T) => string | undefined) =>
    [...list].sort((a, b) => (date(a) ?? "9999").localeCompare(date(b) ?? "9999"));

  return (
    <div className="space-y-4">
      <ContentSection
        id="content-events"
        icon={CalendarDays}
        title="Events"
        description="Club events with dates and registration links. Past events drop off Home on their own."
        count={`${upcomingEvents} upcoming · ${events.value.length - upcomingEvents} past`}
        updatedAt={events.updatedAt}
        dirty={events.dirty}
        onDiscard={events.discard}
        actions={
          <>
            <button type="button" className={softBtn} onClick={() => events.set((list) => byDate(list, (e) => isoDay(e.date)))}>
              <ArrowDownUp className="h-3.5 w-3.5" aria-hidden /> Sort by date
            </button>
            <button type="button" className={addBtn} onClick={() => events.set((list) => [newEvent(), ...list])}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add event
            </button>
          </>
        }
      >
        <EventEditor data={events.value} onChange={events.set} />
      </ContentSection>

      <ContentSection
        id="content-holidays"
        icon={Palmtree}
        title="Holidays"
        description="Court closures. They show in the court calendar and as a heads-up banner the day before. Saved in date order."
        count={`${upcomingHolidays} upcoming`}
        updatedAt={holidays.updatedAt}
        dirty={holidays.dirty}
        onDiscard={holidays.discard}
      >
        <HolidayEditor data={holidays.value} onChange={holidays.set} />
      </ContentSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ClubTab() {
  const club = useContentDoc("club_settings");
  const conveners = useContentDoc("convener_photos");
  const videos = useContentDoc("videos");
  const shownVideos = videos.value.filter((v) => !v.hidden).length;

  return (
    <div className="space-y-4">
      <ContentSection
        id="content-club_settings"
        icon={ScrollText}
        title="About page"
        description="Mission, history and the “Club at a glance” numbers on Club → About & Contact."
        updatedAt={club.updatedAt}
        dirty={club.dirty}
        onDiscard={club.discard}
      >
        <ClubPageEditor data={club.value} onChange={club.set} />
      </ContentSection>

      <ContentSection
        id="content-convener_photos"
        icon={UserRound}
        title="Conveners"
        description="Club leadership on the About page and on certificates."
        updatedAt={conveners.updatedAt}
        dirty={conveners.dirty}
        onDiscard={conveners.discard}
      >
        <ConvenerEditor data={conveners.value} onChange={conveners.set} />
      </ContentSection>

      <ContentSection
        id="content-videos"
        icon={Video}
        title="Videos"
        description="Match videos. New YouTube uploads arrive on their own every hour."
        count={`${shownVideos} shown · ${videos.value.length - shownVideos} hidden`}
        updatedAt={videos.updatedAt}
        dirty={videos.dirty}
        onDiscard={videos.discard}
        defaultOpen={false}
      >
        <VideoEditor data={videos.value} onChange={videos.set} reload={videos.reload} isDirty={videos.dirty} />
      </ContentSection>
    </div>
  );
}
