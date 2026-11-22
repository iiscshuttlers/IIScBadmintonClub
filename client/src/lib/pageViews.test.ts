import { describe, expect, it } from "vitest";
import { normaliseRoute } from "./pageViews";

const T = "3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c";
const M = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("normaliseRoute", () => {
  it("keeps plain section routes", () => {
    expect(normaliseRoute("/")).toBe("/");
    expect(normaliseRoute("/club")).toBe("/club");
    expect(normaliseRoute("/players/")).toBe("/players");
  });

  it("drops the query string and hash", () => {
    expect(normaliseRoute("/club?tab=news#feed-x")).toBe("/club");
    expect(normaliseRoute("/admin#elo_audit")).toBe("/admin");
  });

  it("replaces ids but keeps tab names", () => {
    expect(normaliseRoute(`/tournaments/${T}`)).toBe("/tournaments/:id");
    expect(normaliseRoute(`/tournaments/${T}/draw`)).toBe("/tournaments/:id/draw");
    expect(normaliseRoute(`/tournaments/${T}/matches/${M}/points`)).toBe("/tournaments/:id/matches/:id/points");
    expect(normaliseRoute(`/tv/${M}`)).toBe("/tv/:id");
    expect(normaliseRoute("/matches/12345")).toBe("/matches/:id");
  });

  it("strips slugs, codes, tokens and player pairs", () => {
    expect(normaliseRoute("/player/raja-janmejay")).toBe("/player/:id");
    expect(normaliseRoute(`/player/${T}/edit`)).toBe("/player/:id/edit");
    expect(normaliseRoute("/events/bpl-2024")).toBe("/events/:slug");
    expect(normaliseRoute("/verify/ABC123")).toBe("/verify/:code");
    expect(normaliseRoute("/join-team/x7Gh2kLq9")).toBe("/join-team/:token");
    expect(normaliseRoute(`/compare/${T}/${M}`)).toBe("/compare/:a/:b");
    expect(normaliseRoute("/predict/abcdEFGH12345678")).toBe("/predict/:id");
  });
});
