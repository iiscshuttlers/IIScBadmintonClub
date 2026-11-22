/**
 * What the Home page shows, worked out in one place so the admin Content hub
 * can preview exactly what members will see.
 *
 * Two surfaces read this:
 * - the Home notice stack (HomeAnnouncementBar): explicit Home banners plus
 *   announcements, events and flyers an admin marked "Show on Home";
 * - the scrolling ticker at the top of Home (StatusBanner): enabled flyers
 *   and announcement flyers inside their date window.
 *
 * Dates are YYYY-MM-DD strings compared in IST, the club's time zone.
 */

export type HomeBannerType = "announcement" | "notice" | "registration" | "custom";
export type HomeBannerColor = "blue" | "green" | "amber" | "red" | "purple";

export interface HomeBanner {
  id: string;
  type: HomeBannerType;
  title: string;
  message: string;
  color: HomeBannerColor;
  link_url?: string;
  link_label?: string;
  active: boolean;
  pinned?: boolean;
  /** Change it to show a dismissed banner to everyone again. */
  dismiss_key?: string;
  /** First day the banner shows (YYYY-MM-DD). Empty = from now. */
  starts_on?: string;
  /** Last day the banner shows (YYYY-MM-DD). Empty = until hidden. */
  ends_on?: string;
}

export type HomeBannerSource = "banner" | "announcement" | "event" | "flyer";

/** A banner as Home will show it, with where it came from. */
export interface ResolvedHomeBanner extends HomeBanner {
  source: HomeBannerSource;
  /** Index of the item in its own list (home_banners, announcements.recent, events, flyers). */
  sourceIndex: number;
}

export interface TickerFlyer {
  id: string;
  enabled: boolean;
  bgColorClass: string;
  items: { text: string; colorClass: string }[];
  startDate?: string;
  endDate?: string;
  speed?: "slow" | "normal" | "fast" | "custom";
  customSpeed?: number;
  url?: string;
  showOnHome?: boolean;
}

export interface HomeContentValues {
  home_banners?: unknown;
  announcements?: unknown;
  events?: unknown;
  flyers?: unknown;
}

/** Today's date in IST as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** The YYYY-MM-DD part of a date string, or undefined when it isn't one. */
export function isoDay(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
}

/** Whether `today` falls inside [start, end]; either bound may be missing. */
export function withinDates(today: string, start?: unknown, end?: unknown): boolean {
  const from = isoDay(start);
  const until = isoDay(end);
  if (from && today < from) return false;
  if (until && today > until) return false;
  return true;
}

/** home_banners has been stored both as a bare array and as `{ banners }`. */
export function bannerListFrom(value: unknown): HomeBanner[] {
  if (Array.isArray(value)) return value as HomeBanner[];
  if (value && typeof value === "object" && Array.isArray((value as { banners?: unknown }).banners)) {
    return (value as { banners: HomeBanner[] }).banners;
  }
  return [];
}

const slug = (s: unknown, sep: string) => (typeof s === "string" ? s.replace(/[^a-zA-Z0-9]/g, sep) : "");

/**
 * Every notice the Home stack would show today, pinned first and otherwise in
 * the order admins arranged them. Dismissals are per-device, so they are left
 * to the caller.
 */
export function buildHomeBanners(values: HomeContentValues, today: string = todayIST()): ResolvedHomeBanner[] {
  const out: ResolvedHomeBanner[] = [];

  // 1. Explicit Home banners, inside their optional date window.
  bannerListFrom(values.home_banners).forEach((b, i) => {
    if (b && b.active && withinDates(today, b.starts_on, b.ends_on)) {
      out.push({ ...b, source: "banner", sourceIndex: i });
    }
  });

  // 2. Announcements marked for Home, until their end date passes.
  const recent = (values.announcements as { recent?: unknown } | null | undefined)?.recent;
  if (Array.isArray(recent)) {
    recent.forEach((a: any, i: number) => {
      if (!a || !(a.showOnHome || a.flyer?.showOnHome)) return;
      if (!withinDates(today, undefined, a.endDate)) return;
      const id = `ann_${slug(a.title, "_") || i}`;
      out.push({
        id,
        type: "announcement",
        title: a.title,
        message: a.content,
        color: "blue",
        link_url: a.url || `/club?tab=news#feed-${slug(a.title, "-").toLowerCase()}`,
        link_label: "View",
        active: true,
        pinned: a.priority === "high",
        dismiss_key: id,
        source: "announcement",
        sourceIndex: i,
      });
    });
  }

  // 3. Events marked for Home, until the event is over.
  if (Array.isArray(values.events)) {
    values.events.forEach((e: any, i: number) => {
      if (!e || !e.showOnHome) return;
      if (!withinDates(today, undefined, e.endDate || e.date)) return;
      const id = `ev_${slug(e.title, "_") || i}`;
      const link = e.link || e.url || undefined;
      out.push({
        id,
        type: "registration",
        title: e.title,
        message: e.date ? `Event Date: ${new Date(e.date).toLocaleDateString()}` : "",
        color: "green",
        link_url: link,
        link_label: link ? "View Details" : undefined,
        active: true,
        dismiss_key: id,
        source: "event",
        sourceIndex: i,
      });
    });
  }

  // 4. Flyers marked for Home, inside their date window.
  if (Array.isArray(values.flyers)) {
    values.flyers.forEach((f: any, i: number) => {
      if (!f || !f.showOnHome || !f.enabled) return;
      if (!withinDates(today, f.startDate, f.endDate)) return;
      const text = Array.isArray(f.items) ? f.items.map((it: any) => it?.text).filter(Boolean).join(" • ") : "";
      if (!text) return;
      out.push({
        id: f.id,
        type: "notice",
        title: text,
        message: "",
        color: "purple",
        link_url: f.url || undefined,
        link_label: f.url ? "View" : undefined,
        active: true,
        source: "flyer",
        sourceIndex: i,
      });
    });
  }

  // Pinned first; Array.prototype.sort is stable, so admin order survives.
  return out.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
}

/** Flyers scrolling in the ticker today: enabled flyers, then announcement flyers. */
export function activeTickerFlyers(
  flyers: unknown,
  announcements: unknown,
  today: string = todayIST(),
): TickerFlyer[] {
  const live = (f: TickerFlyer | undefined | null): f is TickerFlyer =>
    !!f && !!f.enabled && withinDates(today, f.startDate, f.endDate);
  const base = Array.isArray(flyers) ? (flyers as TickerFlyer[]).filter(live) : [];
  const fromAnnouncements = Array.isArray(announcements)
    ? (announcements as { flyer?: TickerFlyer }[]).map((a) => a?.flyer).filter(live)
    : [];
  return [...base, ...fromAnnouncements];
}
