import { afterEach, describe, expect, it, vi } from "vitest";
import { currentReturnUrl, toAppPath } from "./returnUrl";

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

describe("toAppPath", () => {
  it("strips the GitHub Pages base so wouter doesn't add it twice", () => {
    vi.stubEnv("BASE_URL", "/IIScBadmintonClub/");
    expect(toAppPath("/IIScBadmintonClub/club")).toBe("/club");
    expect(toAppPath("/IIScBadmintonClub/tournaments/abc?panel=organizer")).toBe("/tournaments/abc?panel=organizer");
    expect(toAppPath("/IIScBadmintonClub")).toBe("/");
    expect(toAppPath("/IIScBadmintonClub?x=1")).toBe("/?x=1");
  });

  it("leaves base-relative paths and look-alike prefixes alone", () => {
    vi.stubEnv("BASE_URL", "/IIScBadmintonClub/");
    expect(toAppPath("/club")).toBe("/club");
    expect(toAppPath("/officiate")).toBe("/officiate");
    expect(toAppPath("/IIScBadmintonClubX/club")).toBe("/IIScBadmintonClubX/club");
  });

  it("changes nothing without a base (Netlify, native)", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(toAppPath("/club")).toBe("/club");
    vi.stubEnv("BASE_URL", "./");
    expect(toAppPath("/club")).toBe("/club");
  });
});

describe("currentReturnUrl", () => {
  it("keeps the query and hash of the current page", () => {
    vi.stubEnv("BASE_URL", "/IIScBadmintonClub/");
    window.history.replaceState(null, "", "/IIScBadmintonClub/pulse?tab=live#m1");
    expect(currentReturnUrl()).toBe("/pulse?tab=live#m1");
  });
});
