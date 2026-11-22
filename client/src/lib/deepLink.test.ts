import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { appPathFromUrl } from "@/lib/deepLink";
import { matchShareUrl } from "@/lib/matchViewShare";
import { venueTournamentUrl } from "@/lib/venueDisplay";
import { getBaseShareUrl } from "@/lib/utils";

const SITE = "https://iiscshuttlers.github.io/IIScBadmintonClub";

describe("appPathFromUrl", () => {
  it("opens the exact shared match page", () => {
    expect(appPathFromUrl(`${SITE}/tournaments/t1/matches/m1`)).toBe("/tournaments/t1/matches/m1");
  });

  it("keeps the query string and hash", () => {
    expect(appPathFromUrl(`${SITE}/tournaments/t1/draws?cat=MS&round=2#r2`)).toBe(
      "/tournaments/t1/draws?cat=MS&round=2#r2",
    );
  });

  it("maps the site root to home", () => {
    expect(appPathFromUrl(SITE)).toBe("/");
    expect(appPathFromUrl(`${SITE}/`)).toBe("/");
    expect(appPathFromUrl(`${SITE}/index.html`)).toBe("/");
  });

  it("is case-insensitive on host and base path", () => {
    expect(appPathFromUrl("https://IISCSHUTTLERS.github.io/iiscbadmintonclub/player/abc")).toBe("/player/abc");
  });

  it("round-trips every public share URL builder", () => {
    expect(appPathFromUrl(matchShareUrl({ tournamentId: "t 1", id: "m1" }))).toBe("/tournaments/t%201/matches/m1");
    expect(appPathFromUrl(venueTournamentUrl("t1"))).toBe("/tournaments/t1");
    expect(appPathFromUrl(`${getBaseShareUrl()}/player/p1`)).toBe("/player/p1");
    expect(appPathFromUrl(`${getBaseShareUrl()}/join-team/tok123`)).toBe("/join-team/tok123");
  });

  it("handles the custom app scheme", () => {
    expect(appPathFromUrl("iiscshuttlers://umpire")).toBe("/umpire");
    expect(appPathFromUrl("iiscshuttlers://player/abc?tab=stats")).toBe("/player/abc?tab=stats");
  });

  it("sends OAuth returns home", () => {
    expect(appPathFromUrl("iiscshuttlers://login-callback#access_token=x")).toBe("/");
    expect(appPathFromUrl(`${SITE}/login-callback?code=abc`)).toBe("/");
  });

  it("ignores URLs that are not ours", () => {
    expect(appPathFromUrl("https://example.com/IIScBadmintonClub/player/abc")).toBeNull();
    expect(appPathFromUrl("https://iiscshuttlers.github.io/OtherRepo/player/abc")).toBeNull();
    expect(appPathFromUrl("https://iiscshuttlers.github.io/IIScBadmintonClubX/abc")).toBeNull();
    expect(appPathFromUrl("not a url")).toBeNull();
    expect(appPathFromUrl("")).toBeNull();
    expect(appPathFromUrl(undefined)).toBeNull();
  });

  it("drops characters that are not valid in a URL", () => {
    expect(appPathFromUrl("iiscshuttlers://player/a<script>b")).toBe("/player/ascriptb");
  });
});

describe("Android App Links files", () => {
  const root = path.resolve(__dirname, "../../..");
  const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));

  it("root-domain assetlinks.json matches the one shipped with the site", () => {
    expect(read("deploy/org-pages-root/.well-known/assetlinks.json")).toEqual(
      read("client/public/.well-known/assetlinks.json"),
    );
  });

  it("assetlinks.json names the app package", () => {
    const [entry] = read("client/public/.well-known/assetlinks.json");
    expect(entry.relation).toContain("delegate_permission/common.handle_all_urls");
    expect(entry.target.package_name).toBe("shuttlers.iisc.com");
    expect(entry.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
  });
});
