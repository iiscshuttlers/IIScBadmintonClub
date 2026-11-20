import { describe, expect, it } from "vitest";
import {
  albumAlertOn,
  albumLabel,
  albumMutedByAdmin,
  alertableAlbums,
  overridesByAlbum,
  parseAlbumList,
  readLegacyAlbumChoices,
  type AlbumAlertState,
} from "./galleryAlerts";

const state = (s: Partial<AlbumAlertState> = {}): AlbumAlertState => ({
  enabled: true,
  overrides: {},
  muted: [],
  ...s,
});

describe("albumAlertOn", () => {
  it("is on by default, including for albums nobody has seen yet", () => {
    expect(albumAlertOn("Brand New Album", state())).toBe(true);
  });

  it("is off everywhere when the member's gallery switch is off", () => {
    expect(albumAlertOn("A", state({ enabled: false, overrides: { A: true } }))).toBe(false);
  });

  it("honours a per-album opt-out", () => {
    expect(albumAlertOn("A", state({ overrides: { A: false } }))).toBe(false);
    expect(albumAlertOn("B", state({ overrides: { A: false } }))).toBe(true);
  });

  it("is off for an album an admin muted, unless the member turned it on", () => {
    expect(albumAlertOn("A", state({ muted: ["A"] }))).toBe(false);
    expect(albumAlertOn("A", state({ muted: ["A"], overrides: { A: true } }))).toBe(true);
  });

  it("does not treat inherited object keys as overrides", () => {
    expect(albumAlertOn("constructor", state())).toBe(true);
  });
});

describe("albumMutedByAdmin", () => {
  it("is true only while the member hasn't overridden the mute", () => {
    expect(albumMutedByAdmin("A", state({ muted: ["A"] }))).toBe(true);
    expect(albumMutedByAdmin("A", state({ muted: ["A"], overrides: { A: true } }))).toBe(false);
    expect(albumMutedByAdmin("A", state({ muted: ["A"], overrides: { A: false } }))).toBe(true);
    expect(albumMutedByAdmin("B", state({ muted: ["A"] }))).toBe(false);
  });
});

describe("albumLabel", () => {
  it("matches the database's label", () => {
    expect(albumLabel("BPL-2024")).toBe("BPL 2024");
    expect(albumLabel("Open Tournament August 2026")).toBe("Open Tournament August 2026");
    expect(albumLabel(" a__b - c ")).toBe("a b c");
  });
});

describe("alertableAlbums", () => {
  it("lists each album once with its category, skipping loose photos", () => {
    expect(
      alertableAlbums([
        { subfolder: "IISM-2024", category: "Tournaments" },
        { subfolder: "", category: "Tournaments" },
        { subfolder: "IISM-2025", category: "Tournaments" },
        { subfolder: "IISM-2024", category: "Other" },
        { subfolder: null, category: "Events" },
      ]),
    ).toEqual([
      { album: "IISM-2025", category: "Tournaments" },
      { album: "IISM-2024", category: "Tournaments" },
    ]);
  });
});

describe("overridesByAlbum / parseAlbumList", () => {
  it("builds a plain lookup", () => {
    expect(overridesByAlbum([{ album: "A", subscribed: false }, { album: "B", subscribed: true }])).toEqual({ A: false, B: true });
  });

  it("keeps only non-empty strings", () => {
    expect(parseAlbumList(["A", "", 3, null, " ", "B"])).toEqual(["A", "B"]);
    expect(parseAlbumList("A")).toEqual([]);
    expect(parseAlbumList(null)).toEqual([]);
  });
});

describe("readLegacyAlbumChoices", () => {
  const storage = (items: Record<string, string>) => ({ getItem: (k: string) => items[k] ?? null });

  it("carries over the old browser-only bell choices", () => {
    expect(
      readLegacyAlbumChoices(storage({
        gallery_subscriptions: JSON.stringify(["A", "B"]),
        gallery_unsubscriptions: JSON.stringify(["B", "C"]),
      })),
    ).toEqual([
      { album: "A", subscribed: true },
      { album: "B", subscribed: false },
      { album: "C", subscribed: false },
    ]);
  });

  it("survives empty or corrupt storage", () => {
    expect(readLegacyAlbumChoices(storage({}))).toEqual([]);
    expect(readLegacyAlbumChoices(storage({ gallery_subscriptions: "{not json" }))).toEqual([]);
  });
});
