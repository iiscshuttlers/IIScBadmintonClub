/**
 * The Content hub's data model, free of React so it can be unit-tested.
 *
 * Every piece of editable site content lives in one `site_data` row. This file
 * says, for each row: how to read it into editor shape, how to write it back
 * without losing changes other people made meanwhile (votes, YouTube imports,
 * push banners, Settings), how to describe a change in words, and what looks
 * wrong enough to flag on the Overview.
 */
import type { Announcement, DynamicFlyer, EventItem, Holiday, VideoItem } from "../editors/shared";
import type { Poll, PollOption } from "../../feed/PollsSection";
import { normaliseConvenerData, CONVENER_ROLES, type ConvenerData } from "@/lib/conveners";
import type { ClubStats } from "@/lib/clubStats";
import { bannerListFrom, buildHomeBanners, isoDay, withinDates, type HomeBanner } from "@/lib/homeBanners";

export const CONTENT_KEYS = [
  "announcements",
  "events",
  "flyers",
  "home_banners",
  "polls",
  "holidays",
  "videos",
  "convener_photos",
  "club_settings",
] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

export type ContentTab = "overview" | "home" | "posts" | "calendar" | "club";

export interface AnnouncementsDoc {
  recent: Announcement[];
  /** Automatic tournament posts an admin chose to keep off the Feed. */
  hiddenAuto: string[];
}

/** The part of `club_settings` the Content hub owns. Settings owns the rest. */
export interface ClubPageContent {
  about: { mission: string; history: string };
  stats: ClubStats;
}

export interface ContentDocs {
  announcements: AnnouncementsDoc;
  events: EventItem[];
  flyers: DynamicFlyer[];
  home_banners: HomeBanner[];
  polls: Poll[];
  holidays: Holiday[];
  videos: VideoItem[];
  convener_photos: ConvenerData;
  club_settings: ClubPageContent;
}

interface DocSpec<T> {
  label: string;
  /** Which hub tab edits this row. */
  tab: ContentTab;
  /** Turn whatever is stored (or nothing) into the editor's shape. */
  read: (stored: unknown) => T;
  /**
   * The value to store. `fresh` is the row as it is in the database right now
   * (read just before saving); `original` is what the editor started from.
   */
  write: (draft: T, ctx: { fresh: unknown; original: T }) => unknown;
  /** True when `write` keeps items other people added since the page loaded. */
  keepsOutsideAdds?: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Keep items (by id) that appeared in the database after this page loaded. */
export function keepAddedElsewhere<T extends { id?: string }>(draft: T[], original: T[], fresh: T[]): T[] {
  const known = new Set<string>();
  for (const item of [...draft, ...original]) if (item?.id) known.add(item.id);
  return [...draft, ...fresh.filter((item) => item?.id && !known.has(item.id))];
}

export function pollsFrom(stored: unknown): Poll[] {
  if (Array.isArray(stored)) return stored as Poll[];
  return isObj(stored) ? arr<Poll>(stored.polls) : [];
}

/**
 * Admin poll edits merged onto the live row: votes always come from the
 * database (members keep voting while an admin edits), and polls organisers
 * created meanwhile are kept.
 */
export function mergePolls(draft: Poll[], original: Poll[], fresh: Poll[]): Poll[] {
  const live = new Map(fresh.map((p) => [p.id, p]));
  const merged = draft.map((p) => {
    const current = live.get(p.id);
    const options = (p.options ?? []).map((o): PollOption => {
      const liveVotes = current?.options?.find((lo) => lo.id === o.id)?.votes;
      return { ...o, votes: liveVotes ?? o.votes ?? [] };
    });
    return { ...p, options };
  });
  return keepAddedElsewhere(merged, original, fresh);
}

export const DOC_SPECS: { [K in ContentKey]: DocSpec<ContentDocs[K]> } = {
  announcements: {
    label: "Announcements",
    tab: "posts",
    read: (v) => ({
      recent: isObj(v) ? arr<Announcement>(v.recent) : [],
      hiddenAuto: isObj(v) ? arr<string>(v.hiddenAuto) : [],
    }),
    write: (d, { fresh }) => ({
      ...(isObj(fresh) ? fresh : {}),
      recent: d.recent.filter((a) => str(a.title).trim()),
      hiddenAuto: d.hiddenAuto,
    }),
  },
  events: {
    label: "Events",
    tab: "calendar",
    read: (v) => arr<EventItem>(v),
    write: (d) => d.filter((e) => str(e.title).trim() && e.date),
  },
  flyers: {
    label: "Ticker flyers",
    tab: "home",
    read: (v) => arr<DynamicFlyer>(v),
    write: (d, { fresh, original }) => keepAddedElsewhere(d, original, arr<DynamicFlyer>(fresh)),
    keepsOutsideAdds: true,
  },
  home_banners: {
    label: "Home banners",
    tab: "home",
    read: (v) => bannerListFrom(v),
    // Push broadcasts marked "Show on Home" add banners straight to the row.
    write: (d, { fresh, original }) =>
      keepAddedElsewhere(
        d.filter((b) => str(b.title).trim()),
        original,
        bannerListFrom(fresh),
      ),
    keepsOutsideAdds: true,
  },
  polls: {
    label: "Polls",
    tab: "posts",
    read: (v) => pollsFrom(v),
    write: (d, { fresh, original }) => ({ polls: mergePolls(d, original, pollsFrom(fresh)) }),
    keepsOutsideAdds: true,
  },
  holidays: {
    label: "Holidays",
    tab: "calendar",
    read: (v) => arr<Holiday>(v),
    write: (d) =>
      d.filter((h) => h.date && str(h.name).trim()).sort((a, b) => a.date.localeCompare(b.date)),
  },
  videos: {
    label: "Videos",
    tab: "club",
    read: (v) => arr<VideoItem>(v),
    // The hourly YouTube sync adds rows while an admin may be editing.
    write: (d, { fresh, original }) =>
      keepAddedElsewhere(
        d.filter((v) => str(v.title).trim() && v.videoId),
        original,
        arr<VideoItem>(fresh),
      ),
    keepsOutsideAdds: true,
  },
  convener_photos: {
    label: "Conveners",
    tab: "club",
    read: (v) => normaliseConvenerData(isObj(v) ? (v as Partial<ConvenerData>) : null),
    write: (d) => d,
  },
  club_settings: {
    label: "About page",
    tab: "club",
    read: (v) => {
      const about = isObj(v) && isObj(v.about) ? v.about : {};
      const stats = isObj(v) && isObj(v.stats) ? v.stats : {};
      return {
        about: { mission: str(about.mission), history: str(about.history) },
        stats: {
          members: str(stats.members),
          tournaments: str(stats.tournaments),
          courts: str(stats.courts),
          trophies: str(stats.trophies),
        },
      };
    },
    // Only `about` and `stats` are ours; maintenance mode etc. stay as stored.
    write: (d, { fresh }) => ({
      ...(isObj(fresh) ? fresh : {}),
      about: { mission: d.about.mission.trim(), history: d.about.history.trim() },
      stats: {
        members: d.stats.members.trim(),
        tournaments: d.stats.tournaments.trim(),
        courts: d.stats.courts.trim(),
        trophies: d.stats.trophies.trim(),
      },
    }),
  },
};

/* ------------------------------------------------------------------ */
/*  Change summaries for the review dialog                             */
/* ------------------------------------------------------------------ */

export type ChangeLine = { kind: "added" | "removed" | "edited"; text: string };

const json = (v: unknown) => JSON.stringify(v ?? null);

function diffList<T>(
  before: T[],
  after: T[],
  label: (t: T) => string,
  idOf?: (t: T) => string | undefined,
  /** For lists without ids: items with the same name count as one edited item. */
  nameOf: (t: T) => string = label,
): ChangeLine[] {
  const lines: ChangeLine[] = [];
  const byId = idOf && [...before, ...after].every((t) => !!idOf(t));
  if (byId) {
    const b = new Map(before.map((t) => [idOf!(t)!, t]));
    const a = new Map(after.map((t) => [idOf!(t)!, t]));
    for (const [id, t] of a) {
      if (!b.has(id)) lines.push({ kind: "added", text: label(t) });
      else if (json(b.get(id)) !== json(t)) lines.push({ kind: "edited", text: label(t) });
    }
    for (const [id, t] of b) if (!a.has(id)) lines.push({ kind: "removed", text: label(t) });
  } else {
    const remaining = new Map<string, T[]>();
    for (const t of before) {
      const k = json(t);
      remaining.set(k, [...(remaining.get(k) ?? []), t]);
    }
    const added: T[] = [];
    for (const t of after) {
      const left = remaining.get(json(t));
      if (left && left.length) left.pop();
      else added.push(t);
    }
    const removed = [...remaining.values()].flat();
    for (const t of added) {
      const twin = removed.findIndex((r) => nameOf(r) === nameOf(t));
      if (twin >= 0) {
        removed.splice(twin, 1);
        lines.push({ kind: "edited", text: label(t) });
      } else {
        lines.push({ kind: "added", text: label(t) });
      }
    }
    for (const t of removed) lines.push({ kind: "removed", text: label(t) });
  }
  if (lines.length === 0 && json(before) !== json(after)) lines.push({ kind: "edited", text: "Order changed" });
  return lines;
}

const titled = (s: unknown, fallback: string) => str(s).trim() || fallback;

/** Plain-language list of what changed in one row. */
export function summarizeChange<K extends ContentKey>(key: K, original: ContentDocs[K], draft: ContentDocs[K]): ChangeLine[] {
  switch (key) {
    case "announcements": {
      const o = original as AnnouncementsDoc;
      const d = draft as AnnouncementsDoc;
      const lines = diffList(
        o.recent,
        d.recent,
        (a) => titled(a.title, "Untitled announcement (dropped on save)"),
        undefined,
        (a) => str(a.title),
      );
      if (json(o.hiddenAuto) !== json(d.hiddenAuto)) lines.push({ kind: "edited", text: "Automatic tournament posts shown/hidden" });
      return lines;
    }
    case "events":
      return diffList(
        original as EventItem[],
        draft as EventItem[],
        (e) => (e.title && e.date ? `${e.title} (${e.date})` : `${titled(e.title, "Untitled event")}: needs a title and date (dropped on save)`),
        undefined,
        (e) => str(e.title),
      );
    case "holidays":
      return diffList(
        original as Holiday[],
        draft as Holiday[],
        (h) => `${titled(h.name, "Unnamed holiday")}${h.date ? ` (${h.date})` : ""}`,
        undefined,
        (h) => str(h.name),
      );
    case "flyers":
      return diffList(
        original as DynamicFlyer[],
        draft as DynamicFlyer[],
        (f) => titled((f.items ?? []).map((i) => i.text).join(" • "), "Empty flyer"),
        (f) => f.id,
      );
    case "home_banners":
      return diffList(
        original as HomeBanner[],
        draft as HomeBanner[],
        (b) => titled(b.title, "Untitled banner (dropped on save)"),
        (b) => b.id,
      );
    case "polls":
      return diffList(original as Poll[], draft as Poll[], (p) => titled(p.question, "Untitled poll"), (p) => p.id);
    case "videos":
      return diffList(original as VideoItem[], draft as VideoItem[], (v) => titled(v.title, "Untitled video"), (v) => v.id);
    case "convener_photos": {
      const o = original as ConvenerData;
      const d = draft as ConvenerData;
      return CONVENER_ROLES.filter(({ key: role }) => json(o[role]) !== json(d[role])).map(({ title }) => ({
        kind: "edited" as const,
        text: title,
      }));
    }
    case "club_settings": {
      const o = original as ClubPageContent;
      const d = draft as ClubPageContent;
      const lines: ChangeLine[] = [];
      if (o.about.mission !== d.about.mission) lines.push({ kind: "edited", text: "Our mission" });
      if (o.about.history !== d.about.history) lines.push({ kind: "edited", text: "Our history" });
      if (json(o.stats) !== json(d.stats)) lines.push({ kind: "edited", text: "Club at a glance numbers" });
      return lines;
    }
    default:
      return [{ kind: "edited", text: "Updated" }];
  }
}

/* ------------------------------------------------------------------ */
/*  Overview: things worth an admin's attention                        */
/* ------------------------------------------------------------------ */

export interface AttentionItem {
  id: string;
  tone: "warn" | "info";
  text: string;
  tab: ContentTab;
  /** Section anchor inside the tab. */
  section: ContentKey;
  /** One-click fix that edits the draft (still needs Save). */
  fix?: { label: string; key: ContentKey; apply: (docs: ContentDocs) => ContentDocs[ContentKey] };
}

const pollIsOpen = (p: Poll) => p.is_active && !p.is_archived;

export function contentAttention(docs: ContentDocs, today: string, now: number = Date.now()): AttentionItem[] {
  const items: AttentionItem[] = [];

  // Polls
  docs.polls.forEach((p, i) => {
    if (!pollIsOpen(p)) return;
    const name = titled(p.question, "Untitled poll");
    if (pollStatus(p, now) === "ended") {
      items.push({
        id: `poll-ended-${p.id}`,
        tone: "warn",
        text: `Poll “${name}” closed on ${isoDay(p.end_date)} but is still marked Active.`,
        tab: "posts",
        section: "polls",
        fix: {
          label: "Mark completed",
          key: "polls",
          apply: (d) => d.polls.map((q, j) => (j === i ? { ...q, is_active: false } : q)),
        },
      });
    }
    if ((p.options ?? []).length < 2) {
      items.push({
        id: `poll-options-${p.id}`,
        tone: "warn",
        text: `Poll “${name}” has ${(p.options ?? []).length} option${(p.options ?? []).length === 1 ? "" : "s"}; members need at least two to vote.`,
        tab: "posts",
        section: "polls",
      });
    }
    if (!p.tournament_id) {
      items.push({
        id: `poll-tournament-${p.id}`,
        tone: "info",
        text: `Poll “${name}” isn't linked to a tournament, so it only shows in the August 2026 tournament.`,
        tab: "posts",
        section: "polls",
      });
    }
  });

  // Rows the save would drop
  const untitledPosts = docs.announcements.recent.filter((a) => !str(a.title).trim()).length;
  if (untitledPosts) {
    items.push({
      id: "ann-untitled",
      tone: "warn",
      text: `${untitledPosts} announcement${untitledPosts === 1 ? " has" : "s have"} no title and will be dropped when you save.`,
      tab: "posts",
      section: "announcements",
    });
  }
  const incompleteEvents = docs.events.filter((e) => !str(e.title).trim() || !e.date).length;
  if (incompleteEvents) {
    items.push({
      id: "ev-incomplete",
      tone: "warn",
      text: `${incompleteEvents} event${incompleteEvents === 1 ? " is" : "s are"} missing a title or date and will be dropped when you save.`,
      tab: "calendar",
      section: "events",
    });
  }
  const untitledBanners = docs.home_banners.filter((b) => !str(b.title).trim()).length;
  if (untitledBanners) {
    items.push({
      id: "hb-untitled",
      tone: "warn",
      text: `${untitledBanners} Home banner${untitledBanners === 1 ? " has" : "s have"} no title and will be dropped when you save.`,
      tab: "home",
      section: "home_banners",
    });
  }

  // Things that ran out but are still switched on
  docs.home_banners.forEach((b, i) => {
    const end = isoDay(b.ends_on);
    if (b.active && end && end < today) {
      items.push({
        id: `hb-ended-${b.id}`,
        tone: "info",
        text: `Banner “${titled(b.title, "Untitled")}” ended on ${end}; Home already hides it.`,
        tab: "home",
        section: "home_banners",
        fix: {
          label: "Switch off",
          key: "home_banners",
          apply: (d) => d.home_banners.map((x, j) => (j === i ? { ...x, active: false } : x)),
        },
      });
    }
  });
  docs.events.forEach((e, i) => {
    const end = isoDay(e.endDate || e.date);
    if (e.showOnHome && end && end < today) {
      items.push({
        id: `ev-home-${i}`,
        tone: "info",
        text: `Event “${titled(e.title, "Untitled")}” is over but still marked Show on Home; Home already hides it.`,
        tab: "calendar",
        section: "events",
        fix: {
          label: "Untick",
          key: "events",
          apply: (d) => d.events.map((x, j) => (j === i ? { ...x, showOnHome: false } : x)),
        },
      });
    }
  });
  docs.flyers.forEach((f, i) => {
    const end = isoDay(f.endDate);
    if (f.enabled && end && end < today) {
      items.push({
        id: `fl-ended-${f.id}`,
        tone: "info",
        text: `Ticker flyer “${titled((f.items ?? []).map((x) => x.text).join(" • "), "Empty")}” ended on ${end}.`,
        tab: "home",
        section: "flyers",
        fix: {
          label: "Switch off",
          key: "flyers",
          apply: (d) => d.flyers.map((x, j) => (j === i ? { ...x, enabled: false } : x)),
        },
      });
    }
  });

  // Gentle nudges
  const onHome = buildHomeBanners(
    { home_banners: docs.home_banners, announcements: docs.announcements, events: docs.events, flyers: docs.flyers },
    today,
  ).length;
  if (onHome > 3) {
    items.push({
      id: "home-crowded",
      tone: "info",
      text: `${onHome} notices are on Home. Members see one at a time; the other ${onHome - 1} wait behind “Show more”.`,
      tab: "home",
      section: "home_banners",
    });
  }
  if (!docs.holidays.some((h) => isoDay(h.date) && h.date >= today)) {
    items.push({
      id: "hol-none",
      tone: "info",
      text: "No upcoming holidays are listed, so the court calendar can't warn members about closures.",
      tab: "calendar",
      section: "holidays",
    });
  }

  return items;
}

/* ------------------------------------------------------------------ */
/*  Item status chips                                                  */
/* ------------------------------------------------------------------ */

export type ItemStatus = "live" | "scheduled" | "ended" | "off";

/** Live / scheduled / ended / off for anything with an on switch and a date window. */
export function itemStatus(on: boolean, start: unknown, end: unknown, today: string): ItemStatus {
  if (!on) return "off";
  const from = isoDay(start);
  if (from && today < from) return "scheduled";
  return withinDates(today, undefined, end) ? "live" : "ended";
}

/** Same visibility rules as the Predict tab (PollsSection), to the minute. */
export function pollStatus(p: Poll, now: number = Date.now()): ItemStatus | "archived" {
  if (p.is_archived) return "archived";
  if (!p.is_active) return "off";
  if (p.start_date && now < new Date(p.start_date).getTime()) return "scheduled";
  if (p.end_date && now > new Date(p.end_date).getTime()) return "ended";
  return "live";
}
