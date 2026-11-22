import { describe, expect, it } from "vitest";
import { activeTickerFlyers, bannerListFrom, buildHomeBanners, todayIST, withinDates } from "./homeBanners";

const banner = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  type: "notice",
  title: "Courts closed",
  message: "",
  color: "blue",
  active: true,
  ...over,
});

describe("withinDates", () => {
  it("treats missing bounds as open and includes both end days", () => {
    expect(withinDates("2026-11-22")).toBe(true);
    expect(withinDates("2026-11-22", "2026-11-22", "2026-11-22")).toBe(true);
    expect(withinDates("2026-11-22", "2026-11-23")).toBe(false);
    expect(withinDates("2026-11-22", undefined, "2026-11-21")).toBe(false);
  });

  it("ignores values that aren't dates", () => {
    expect(withinDates("2026-11-22", "", "soon")).toBe(true);
  });
});

describe("todayIST", () => {
  it("rolls over at IST midnight, not UTC", () => {
    // 19:00 UTC on the 21st is 00:30 IST on the 22nd.
    expect(todayIST(new Date("2026-11-21T19:00:00Z"))).toBe("2026-11-22");
  });
});

describe("bannerListFrom", () => {
  it("accepts both stored shapes", () => {
    expect(bannerListFrom([banner()])).toHaveLength(1);
    expect(bannerListFrom({ banners: [banner(), banner({ id: "b2" })] })).toHaveLength(2);
    expect(bannerListFrom(null)).toEqual([]);
  });
});

describe("buildHomeBanners", () => {
  const today = "2026-11-22";

  it("keeps active banners inside their date window", () => {
    const out = buildHomeBanners(
      {
        home_banners: [
          banner({ id: "live" }),
          banner({ id: "off", active: false }),
          banner({ id: "later", starts_on: "2026-11-30" }),
          banner({ id: "over", ends_on: "2026-11-01" }),
        ],
      },
      today,
    );
    expect(out.map((b) => b.id)).toEqual(["live"]);
    expect(out[0]).toMatchObject({ source: "banner", sourceIndex: 0 });
  });

  it("adds announcements, events and flyers marked for Home, dropping ones that are over", () => {
    const out = buildHomeBanners(
      {
        announcements: {
          recent: [
            { title: "AGM", content: "Hall 1", showOnHome: true },
            { title: "Old", content: "", showOnHome: true, endDate: "2026-11-01" },
            { title: "Not on home", content: "" },
          ],
        },
        events: [
          { title: "Open", date: "2026-12-05", showOnHome: true },
          { title: "Past", date: "2026-10-05", showOnHome: true },
          { title: "Runs to today", date: "2026-11-20", endDate: "2026-11-22", showOnHome: true },
        ],
        flyers: [
          { id: "f1", enabled: true, showOnHome: true, items: [{ text: "Sale" }, { text: "Now" }] },
          { id: "f2", enabled: false, showOnHome: true, items: [{ text: "Off" }] },
        ],
      },
      today,
    );
    expect(out.map((b) => `${b.source}:${b.title}`)).toEqual([
      "announcement:AGM",
      "event:Open",
      "event:Runs to today",
      "flyer:Sale • Now",
    ]);
    expect(out[1].sourceIndex).toBe(0);
    expect(out[2].sourceIndex).toBe(2);
  });

  it("puts pinned notices first and keeps admin order otherwise", () => {
    const out = buildHomeBanners(
      {
        home_banners: [banner({ id: "a" }), banner({ id: "b", pinned: true }), banner({ id: "c" })],
        announcements: { recent: [{ title: "Urgent", content: "", showOnHome: true, priority: "high" }] },
      },
      today,
    );
    expect(out.map((b) => b.id)).toEqual(["b", "ann_Urgent", "a", "c"]);
  });
});

describe("activeTickerFlyers", () => {
  it("lists enabled flyers in their window, then announcement flyers", () => {
    const out = activeTickerFlyers(
      [
        { id: "on", enabled: true, items: [] },
        { id: "future", enabled: true, startDate: "2026-12-01", items: [] },
        { id: "off", enabled: false, items: [] },
      ],
      [{ flyer: { id: "ann", enabled: true, items: [] } }, { title: "no flyer" }],
      "2026-11-22",
    );
    expect(out.map((f) => f.id)).toEqual(["on", "ann"]);
  });
});
