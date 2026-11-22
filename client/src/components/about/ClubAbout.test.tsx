import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/siteData", () => ({ fetchSiteData: vi.fn(async () => null) }));
vi.mock("@/lib/conveners", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/conveners")>();
  return {
    ...actual,
    loadConveners: vi.fn(async () => ({
      convener: actual.resolveConvener(
        "convener",
        { name: "Typed Name", description: "", imageUrl: "", playerId: "p-1" },
        { id: "p-1", full_name: "Linked Convener", avatar_url: null },
      ),
      coConvener: actual.resolveConvener("coConvener", { name: "Plain Name", description: "", imageUrl: "" }),
    })),
  };
});

import { ClubAbout } from "./ClubAbout";

beforeAll(() => {
  // framer-motion's whileInView needs IntersectionObserver, which jsdom lacks.
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
});

describe("ClubAbout leadership", () => {
  it("links a convener tied to a player profile and leaves an unlinked one as text", async () => {
    render(<ClubAbout />);
    const link = await screen.findByRole("link", { name: "Linked Convener" });
    expect(link.getAttribute("href")).toBe("/player/p-1");
    expect(screen.getByText("Plain Name").tagName).toBe("P");
    expect(screen.queryByRole("link", { name: "Plain Name" })).toBeNull();
  });
});
