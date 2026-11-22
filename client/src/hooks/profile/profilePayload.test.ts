import { describe, expect, it } from "vitest";
import { PREDEFINED_DEPARTMENTS } from "@/data/departments";
import {
  buildProfilePayload,
  isIiscEmail,
  mediaFromStats,
  missingProfileFields,
  racketsFromProfile,
  shoesFromProfile,
  splitDepartment,
  type ProfileFormValues,
} from "./profilePayload";

const values = (o: Partial<ProfileFormValues> = {}): ProfileFormValues => ({
  fullName: "Asha Rao",
  nickname: "",
  status: null,
  isGuest: false,
  isRetired: false,
  iiscEmail: "asha@iisc.ac.in",
  contactNumber: "9999999999",
  department: PREDEFINED_DEPARTMENTS[0],
  customDepartment: "",
  joinedYear: "2023",
  playingLevel: "Intermediate",
  playingStyle: "",
  dominantHand: "Right-handed",
  favoriteShot: "",
  favoriteIdol: "",
  gender: "Female",
  favoriteFormat: "",
  quote: "",
  avatarUrl: "https://example.test/a.png",
  rackets: [{ name: "", string: "", tension: "" }],
  primaryRacketIndex: 0,
  shoesList: [{ name: "" }],
  primaryShoeIndex: 0,
  originalStats: {},
  mediaImages: [],
  mediaVideos: [],
  nationality: "",
  homeState: "",
  height: "",
  startedPlayingYear: "",
  coach: "",
  bio: "",
  apparel: "",
  instagram: "",
  achievementsRaw: "",
  tournamentsRaw: "",
  careerHighlights: [],
  ...o,
});

describe("splitDepartment", () => {
  it("keeps a listed department as is", () => {
    expect(splitDepartment(PREDEFINED_DEPARTMENTS[0])).toEqual({ department: PREDEFINED_DEPARTMENTS[0], customDepartment: "" });
    expect(splitDepartment("OTHER - Other")).toEqual({ department: "OTHER - Other", customDepartment: "" });
  });

  it("shows an unlisted department as Other with free text", () => {
    expect(splitDepartment("Centre for Something New")).toEqual({ department: "OTHER - Other", customDepartment: "Centre for Something New" });
  });

  it("handles a missing department", () => {
    expect(splitDepartment(null)).toEqual({ department: "", customDepartment: "" });
  });
});

describe("racketsFromProfile", () => {
  it("loads racket rows with digits-only tension and finds the primary", () => {
    expect(racketsFromProfile(
      [
        { name: "Astrox 88", string: "BG80", tension: "26 lbs" },
        { name: "Nanoflare", string: "", tension: "", primary: true },
      ],
      "Astrox 88",
    )).toEqual({
      rackets: [
        { name: "Astrox 88", string: "BG80", tension: "26" },
        { name: "Nanoflare", string: "", tension: "" },
      ],
      // The first racket matches current_racket, which wins over a later primary flag.
      primaryIndex: 0,
    });
  });

  it("falls back to current_racket, then to one empty row", () => {
    expect(racketsFromProfile(null, "Arcsaber 11")).toEqual({ rackets: [{ name: "Arcsaber 11", string: "", tension: "" }], primaryIndex: 0 });
    expect(racketsFromProfile([], "")).toEqual({ rackets: [{ name: "", string: "", tension: "" }], primaryIndex: 0 });
  });
});

describe("shoesFromProfile", () => {
  it("parses the stored JSON list and its primary pair", () => {
    expect(shoesFromProfile(JSON.stringify([{ name: "SHB65" }, { name: "Aerus Z", primary: true }]))).toEqual({
      shoes: [{ name: "SHB65" }, { name: "Aerus Z" }],
      primaryIndex: 1,
    });
  });

  it("keeps an old plain-text value and survives broken JSON", () => {
    expect(shoesFromProfile("Yonex SHB65")).toEqual({ shoes: [{ name: "Yonex SHB65" }], primaryIndex: 0 });
    expect(shoesFromProfile("[not json")).toEqual({ shoes: [{ name: "[not json" }], primaryIndex: 0 });
    expect(shoesFromProfile(null)).toEqual({ shoes: [{ name: "" }], primaryIndex: 0 });
  });
});

describe("mediaFromStats", () => {
  it("splits images and videos", () => {
    expect(mediaFromStats({
      media: [
        { type: "image", url: "a.png", caption: "Final" },
        { type: "video", url: "https://youtu.be/x" },
        { type: "image", url: "" },
      ],
    })).toEqual({
      images: [{ url: "a.png", caption: "Final" }, { url: "", caption: "" }],
      videos: [{ url: "https://youtu.be/x", caption: "" }],
    });
  });

  it("is null when there is no media", () => {
    expect(mediaFromStats({ wins: 3 })).toBeNull();
    expect(mediaFromStats(null)).toBeNull();
  });
});

describe("missingProfileFields", () => {
  const filled = { fullName: "A", isGuest: false, iiscEmail: "a@iisc.ac.in", contactNumber: "1", gender: "Male", joinedYear: "2020", department: "X" };

  it("lists every empty required field in form order", () => {
    expect(missingProfileFields({ fullName: " ", isGuest: false, iiscEmail: "", contactNumber: "", gender: "", joinedYear: " ", department: "" }))
      .toEqual(["Full Name", "IISc Email", "Contact Number", "Gender", "Joined Year", "Department"]);
    expect(missingProfileFields(filled)).toEqual([]);
  });

  it("does not ask guests for an IISc email", () => {
    expect(missingProfileFields({ ...filled, isGuest: true, iiscEmail: "" })).toEqual([]);
  });
});

describe("isIiscEmail", () => {
  it("accepts IISc and alumni addresses in any case", () => {
    expect(isIiscEmail("asha@iisc.ac.in")).toBe(true);
    expect(isIiscEmail("Asha@IISC.AC.IN")).toBe(true);
    expect(isIiscEmail("asha@alum.iisc.ac.in")).toBe(true);
  });

  it("rejects other domains and look-alikes", () => {
    expect(isIiscEmail("asha@gmail.com")).toBe(false);
    expect(isIiscEmail("asha@iisc.ac.in.evil.com")).toBe(false);
    expect(isIiscEmail("asha@notiisc.ac.in.co")).toBe(false);
  });
});

describe("buildProfilePayload", () => {
  it("drops blank equipment and media and marks the primary racket and shoes", () => {
    const p = buildProfilePayload(values({
      rackets: [
        { name: "Astrox 88", string: "", tension: "" },
        { name: "Nanoflare", string: "BG66", tension: "27" },
      ],
      primaryRacketIndex: 1,
      shoesList: [{ name: "SHB65" }, { name: "  " }],
      primaryShoeIndex: 0,
      mediaImages: [{ url: "a.png", caption: "Final" }, { url: " ", caption: "" }],
      mediaVideos: [{ url: "https://youtu.be/x", caption: "" }],
      originalStats: { wins: 4, media: [{ type: "image", url: "old.png" }] },
    }));

    expect(p.current_racket).toBe("Nanoflare");
    expect(p.racket_details).toEqual([
      { name: "Astrox 88", string: "Yonex BG65", tension: "24 lbs", primary: false },
      { name: "Nanoflare", string: "BG66", tension: "27 lbs", primary: true },
    ]);
    expect(JSON.parse(p.shoes)).toEqual([{ name: "SHB65", primary: true }]);
    expect(p.stats).toEqual({
      wins: 4,
      media: [
        { type: "image", url: "a.png", caption: "Final" },
        { type: "video", url: "https://youtu.be/x", caption: "" },
      ],
    });
  });

  it("falls back to the first racket when the primary index is out of range", () => {
    const p = buildProfilePayload(values({ rackets: [{ name: "Only", string: "", tension: "25 lbs" }], primaryRacketIndex: 3 }));
    expect(p.current_racket).toBe("Only");
    expect(p.racket_details).toEqual([{ name: "Only", string: "Yonex BG65", tension: "25 lbs", primary: true }]);
  });

  it("writes the free-text department for Other and nulls empty optional fields", () => {
    const p = buildProfilePayload(values({ department: "OTHER - Other", customDepartment: "New Centre", nickname: "", dominantHand: "" }));
    expect(p.department).toBe("New Centre");
    expect(p.nickname).toBeNull();
    expect(p.dominant_hand).toBeNull();
    expect(p.iisc_email).toBe("asha@iisc.ac.in");
  });

  it("derives is_looking_to_play from status and always undeletes", () => {
    expect(buildProfilePayload(values({ status: "looking" })).is_looking_to_play).toBe(true);
    expect(buildProfilePayload(values({ status: "resting" })).is_looking_to_play).toBe(false);
    expect(buildProfilePayload(values({ status: null })).is_looking_to_play).toBe(false);
    expect(buildProfilePayload(values()).deleted_at).toBeNull();
    expect(buildProfilePayload(values())).not.toHaveProperty("status");
  });

  it("parses years and comma lists, and keeps only complete highlights", () => {
    const p = buildProfilePayload(values({
      joinedYear: "2021",
      startedPlayingYear: "",
      achievementsRaw: "Gold MS 2024, , Silver XD 2025 ",
      tournamentsRaw: "",
      careerHighlights: [
        { year: "2024", title: "Inter-IISc champion", description: "" },
        { year: "", title: "No year", description: "" },
      ],
    }));
    expect(p.joined_year).toBe(2021);
    expect(p.started_playing_year).toBeNull();
    expect(p.achievements).toEqual(["Gold MS 2024", "Silver XD 2025"]);
    expect(p.tournament_history).toEqual([]);
    expect(p.career_highlights).toEqual([{ year: "2024", title: "Inter-IISc champion", description: "" }]);
  });

  it("uses a generated avatar when none is set", () => {
    expect(buildProfilePayload(values({ avatarUrl: "", fullName: "Asha" })).avatar_url)
      .toBe("https://ui-avatars.com/api/?name=Asha&background=random");
  });
});
