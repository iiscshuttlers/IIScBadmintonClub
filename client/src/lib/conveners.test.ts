import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("./supabase", () => ({ supabase: {} }));

import { DEFAULT_CONVENER_DATA, normaliseConvenerData, resolveConvener } from "./conveners";

const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");

describe("resolveConvener", () => {
  it("keeps the built-in photo and signature for the current conveners", () => {
    const r = resolveConvener("convener", DEFAULT_CONVENER_DATA.convener);
    expect(r.name).toBe("Raja Janmejay");
    expect(r.photoUrl).toBe(`${base}convener.webp`);
    expect(r.signatureUrl).toBe(`${base}sign-convener.png`);
    expect(r.playerId).toBeNull();
  });

  it("built-in assets follow the person, not the role", () => {
    const r = resolveConvener("convener", { ...DEFAULT_CONVENER_DATA.convener, name: "Aneesh Varla" });
    expect(r.signatureUrl).toBe(`${base}sign-co-convener.png`);
  });

  it("never shows a previous convener's photo or signature under a new name", () => {
    const r = resolveConvener("convener", { name: "New Person", description: "", imageUrl: "" });
    expect(r.photoUrl).toBe("");
    expect(r.signatureUrl).toBe("");
  });

  it("a linked player supplies the name, avatar and profile link", () => {
    const r = resolveConvener(
      "coConvener",
      { name: "Old typed name", description: "", imageUrl: "", playerId: "p1" },
      { id: "p1", full_name: "Linked Player", avatar_url: "https://img/avatar.jpg" },
    );
    expect(r).toMatchObject({ name: "Linked Player", title: "Co-Convener", photoUrl: "https://img/avatar.jpg", playerId: "p1" });
  });

  it("custom uploads win over the profile photo and built-in files", () => {
    const r = resolveConvener(
      "convener",
      { ...DEFAULT_CONVENER_DATA.convener, imageUrl: "https://img/custom.jpg", signatureUrl: "https://img/sig.png", playerId: "p1" },
      { id: "p1", full_name: "Raja Janmejay", avatar_url: "https://img/avatar.jpg" },
    );
    expect(r.photoUrl).toBe("https://img/custom.jpg");
    expect(r.signatureUrl).toBe("https://img/sig.png");
  });

  it("drops the profile link when the linked player no longer exists", () => {
    const r = resolveConvener("convener", { ...DEFAULT_CONVENER_DATA.convener, playerId: "gone" }, undefined);
    expect(r.playerId).toBeNull();
    expect(r.name).toBe("Raja Janmejay");
  });
});

describe("normaliseConvenerData", () => {
  it("fills missing roles and fields from the defaults", () => {
    const d = normaliseConvenerData({ convener: { name: "X" } as any });
    expect(d.convener.name).toBe("X");
    expect(d.convener.imageUrl).toBe("");
    expect(d.coConvener.name).toBe("Aneesh Varla");
  });
});
