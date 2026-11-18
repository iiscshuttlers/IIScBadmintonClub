import { describe, expect, it } from "vitest";
import { notificationTarget } from "./notificationDeepLinks";

describe("notificationTarget", () => {
  it("prefers the canonical link supplied by the authoritative sender", () => {
    expect(notificationTarget({
      type: "tournament_reminder",
      action: "view_announcements",
      link: "/tournaments/t1/matches/m1?tab=summary#score",
    })).toEqual({ kind: "internal", path: "/tournaments/t1/matches/m1?tab=summary#score" });
  });

  it("builds a canonical match route when cold-start data has ids but no link", () => {
    expect(notificationTarget({ tournament_id: "t one", match_id: "m/1", action: "view_match" })).toEqual({
      kind: "internal",
      path: "/tournaments/t%20one/matches/m%2F1",
    });
  });

  it("rejects protocol-relative and backslash paths", () => {
    expect(notificationTarget({ link: "//evil.example/path", type: "announcement" })).toEqual({
      kind: "internal",
      path: "/pulse#announcements",
    });
    expect(notificationTarget({ link: "/safe\\evil", action: "view_match" })).toEqual({
      kind: "internal",
      path: "/my-matches",
    });
  });

  it("keeps the app-update destination external and allow-listed", () => {
    expect(notificationTarget({ type: "app_update" })).toEqual({
      kind: "external",
      url: "https://play.google.com/store/apps/details?id=shuttlers.iisc.com",
    });
  });

  it("maps the retired lost-found hub route to Club", () => {
    expect(notificationTarget({ action: "view_find_lost" })).toEqual({ kind: "internal", path: "/club?tab=lost-found" });
  });
});

