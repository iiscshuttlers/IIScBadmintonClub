import { describe, expect, it } from "vitest";
import { isVenueDataStale, venueTournamentUrl } from "./venueDisplay";

describe("venue display contract", () => {
  it("marks cached data stale after the documented freshness window", () => {
    expect(isVenueDataStale(1_000, 76_000)).toBe(false);
    expect(isVenueDataStale(1_000, 76_001)).toBe(true);
    expect(isVenueDataStale(null, 999_999)).toBe(false);
  });

  it("uses the public site rather than a device-local origin", () => {
    expect(venueTournamentUrl("t 1")).toBe(
      "https://iiscshuttlers.github.io/IIScBadmintonClub/tournaments/t%201",
    );
  });
});
