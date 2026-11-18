import { describe, expect, it } from "vitest";
import {
  isTournamentReturnRoute,
  recalledScroll,
  rememberScroll,
  rememberTournamentReturnRoute,
  routeKey,
  tournamentIdForReturnRoute,
  tournamentReturnRoute,
} from "./routeContinuity";

const ID = "00000000-0000-4000-8000-000000000101";

describe("route continuity", () => {
  it("keeps the complete filter and hash state in the route key", () => {
    expect(routeKey(`/tournaments/${ID}/schedule`, "cat=XD&court=2", "match-7")).toBe(
      `/tournaments/${ID}/schedule?cat=XD&court=2#match-7`,
    );
  });

  it("recognises tournament pages but never match or unknown-tab pages", () => {
    expect(tournamentIdForReturnRoute(`/tournaments/${ID}/schedule?cat=XD`)).toBe(ID);
    expect(tournamentIdForReturnRoute(`/tournaments/${ID}/matches/m1`)).toBeNull();
    expect(tournamentIdForReturnRoute(`/tournaments/${ID}/unknown`)).toBeNull();
  });

  it("restores only context belonging to the requested tournament", () => {
    const storage = new MapStorage();
    const filtered = `/tournaments/${ID}/schedule?cat=XD&court=2&status=upcoming`;
    rememberTournamentReturnRoute(filtered, storage);
    expect(tournamentReturnRoute(ID, storage)).toBe(filtered);
    expect(isTournamentReturnRoute(filtered, ID)).toBe(true);
    expect(tournamentReturnRoute("00000000-0000-4000-8000-000000000202", storage)).toBe(
      "/tournaments/00000000-0000-4000-8000-000000000202",
    );
  });

  it("round-trips a valid scroll offset and ignores invalid values", () => {
    const storage = new MapStorage();
    rememberScroll("/route?a=1", 487.4, storage);
    expect(recalledScroll("/route?a=1", storage)).toBe(487);
    storage.setItem("iiscshuttlers:scroll:/bad", "NaN");
    expect(recalledScroll("/bad", storage)).toBeNull();
  });
});

class MapStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
