import { describe, expect, it } from "vitest";
import {
  PANEL_META, SECTIONS, SECTION_OF, TABS, TAB_GROUPS, canSeePanel, isMasterOnlySection, resolveTab, sectionOfPanel, visiblePanels,
} from "./adminNav";

const admin = { isAdmin: true, isMasterAdmin: false };
const master = { isAdmin: true, isMasterAdmin: true };
const umpire = { isAdmin: false, isMasterAdmin: false };

describe("admin navigation", () => {
  it("has 8 sections in 2 groups, and every panel sits in exactly one section", () => {
    expect(TAB_GROUPS.map((g) => g.title)).toEqual(["Club", "System"]);
    expect(SECTIONS.map((s) => s.id)).toEqual(["home", "tournament", "people", "content", "insights", "system", "history", "developer"]);
    const placed = SECTIONS.flatMap((s) => s.panels);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(TABS.map((t) => t.id).sort());
    expect(SECTION_OF.get("inbox")).toBe("content");
  });

  it("Home is the landing panel", () => {
    expect(SECTIONS[0].panels).toEqual(["overview"]);
    expect(PANEL_META.get("overview")?.label).toBe("Home");
  });

  it("every old hash still opens a panel", () => {
    const old = [
      "overview", "analytics", "elo_audit", "inbox", "players", "role_manager", "guests", "tournament", "matches", "umpire",
      "content", "settings", "activity_log", "undo_history", "recycle_bin", "features", "features_catalog", "delivery",
      "changelog", "database_schema", "polls", "feedback", "moderation", "all_features", "architecture", "tooltips",
      "config", "noticeboard", "home_banners", "holidays", "videos", "convener_photos", "disputes", "feature_registry",
    ];
    for (const h of old) expect(resolveTab(`#${h}`), h).not.toBeNull();
    expect(resolveTab("#polls/edit")).toBe("content");
    expect(resolveTab("#home")).toBe("overview");
    expect(resolveTab("#health")).toBe("delivery");
    expect(resolveTab("#roles")).toBe("role_manager");
    expect(resolveTab("#nope")).toBeNull();
    expect(resolveTab("")).toBeNull();
  });

  it("master-only panels are hidden from plain admins; umpires see only umpire mode", () => {
    expect(canSeePanel(PANEL_META.get("role_manager"), admin)).toBe(false);
    expect(canSeePanel(PANEL_META.get("role_manager"), master)).toBe(true);
    expect(visiblePanels(sectionOfPanel("players"), admin).map((t) => t.id)).toEqual(["players", "guests"]);
    expect(visiblePanels(sectionOfPanel("changelog"), admin).map((t) => t.id)).toEqual(["changelog"]);
    const umpireSees = SECTIONS.filter((s) => visiblePanels(s, umpire).length > 0);
    expect(umpireSees.map((s) => s.id)).toEqual(["tournament"]);
    expect(visiblePanels(umpireSees[0], umpire).map((t) => t.id)).toEqual(["umpire"]);
    expect(SECTIONS.filter(isMasterOnlySection)).toEqual([]);
  });
});
