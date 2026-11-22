import { describe, expect, it } from "vitest";
import { legacyRedirectTarget, personalRedirectTarget, pulseRedirectTarget } from "./sectionRedirects";

describe("personalRedirectTarget", () => {
  it("sends Personal Space pages to the profile's Training tab", () => {
    expect(personalRedirectTarget("/player/p1/personal")).toBe("/player/p1");
    expect(personalRedirectTarget("/player/p1/personal/home")).toBe("/player/p1");
    expect(personalRedirectTarget("/player/p1/personal/matches")).toBe("/player/p1#MATCHES");
    expect(personalRedirectTarget("/player/p1/personal/stats/phone")).toBe("/player/p1#STATS");
    expect(personalRedirectTarget("/player/p1/personal/training")).toBe("/player/p1#TRAINING");
    expect(personalRedirectTarget("/player/p1/personal/unknown")).toBe("/player/p1");
  });

  it("ignores other paths", () => {
    expect(personalRedirectTarget("/player/p1")).toBeNull();
    expect(personalRedirectTarget("/personal")).toBeNull();
  });
});

describe("pulseRedirectTarget", () => {
  it("sends Live and bare /pulse to Tournaments", () => {
    expect(pulseRedirectTarget("", "")).toBe("/tournaments");
    expect(pulseRedirectTarget("", "#live")).toBe("/tournaments");
    expect(pulseRedirectTarget("?subtab=matches", "#live")).toBe("/tournaments");
    expect(pulseRedirectTarget("", "#something-old")).toBe("/tournaments");
  });

  it("sends the feed to Club → News and keeps a shared post anchor", () => {
    expect(pulseRedirectTarget("", "#feed")).toBe("/club?tab=news");
    expect(pulseRedirectTarget("", "#announcements")).toBe("/club?tab=news");
    expect(pulseRedirectTarget("", "#feed-court-closed-friday")).toBe("/club?tab=news#feed-court-closed-friday");
  });

  it("sends the calendar to Club → Calendar", () => {
    expect(pulseRedirectTarget("", "#calendar")).toBe("/club?tab=calendar");
    expect(pulseRedirectTarget("", "#events")).toBe("/club?tab=calendar");
  });

  it("sends the directory to Players and keeps only directory filters", () => {
    expect(pulseRedirectTarget("", "#directory")).toBe("/players?tab=directory");
    expect(pulseRedirectTarget("", "#h2h")).toBe("/players?tab=directory&dir_view=h2h");
    expect(pulseRedirectTarget("?dir_q=raj&dir_sort=elo&other=1", "#directory")).toBe(
      "/players?tab=directory&dir_q=raj&dir_sort=elo",
    );
  });
});

describe("legacyRedirectTarget", () => {
  it("sends Champions and Records to Players", () => {
    expect(legacyRedirectTarget("", "#champions")).toBe("/players?tab=champions");
    expect(legacyRedirectTarget("", "#records")).toBe("/players?tab=records");
    expect(legacyRedirectTarget("", "")).toBe("/players?tab=champions");
  });

  it("sends the gallery to Club → Gallery and keeps filter and photo", () => {
    expect(legacyRedirectTarget("", "#albums")).toBe("/club?tab=gallery#albums");
    expect(legacyRedirectTarget("", "#videos")).toBe("/club?tab=gallery#videos");
    expect(legacyRedirectTarget("?filter=BPL-2024", "#albums")).toBe("/club?tab=gallery&filter=BPL-2024#albums");
    expect(legacyRedirectTarget("?filter=Open%20Tournament%20August%202026", "#albums")).toBe(
      "/club?tab=gallery&filter=Open+Tournament+August+2026#albums",
    );
    expect(legacyRedirectTarget("?filter=X&photo=a%2Fb.jpg", "")).toBe("/club?tab=gallery&filter=X&photo=a%2Fb.jpg#albums");
  });
});
