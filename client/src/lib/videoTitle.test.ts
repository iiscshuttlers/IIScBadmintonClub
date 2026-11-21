import { describe, it, expect } from "vitest";
import { parseTeamsFromTitle } from "./videoTitle";

describe("parseTeamsFromTitle", () => {
  it("reads the original 'and … || Event' convention", () => {
    expect(parseTeamsFromTitle("Radhika and Kaling vs Tanisha and Aneesh || XD Finals")).toEqual({
      teamA: ["Radhika", "Kaling"],
      teamB: ["Tanisha", "Aneesh"],
    });
    expect(parseTeamsFromTitle("Radhika vs Tanisha || WS Finals")).toEqual({ teamA: ["Radhika"], teamB: ["Tanisha"] });
  });

  it("reads '&' pairs, as auto-added YouTube videos use", () => {
    expect(parseTeamsFromTitle("Asha Rao & Bina Das vs Chetan K & Dev M")).toEqual({
      teamA: ["Asha Rao", "Bina Das"],
      teamB: ["Chetan K", "Dev M"],
    });
  });

  it("drops an 'Event:' prefix and '| Tournament' suffix from raw YouTube titles", () => {
    expect(parseTeamsFromTitle("Men's Doubles Semifinal: A & B vs C & D | Open Tournament August 2026")).toEqual({
      teamA: ["A", "B"],
      teamB: ["C", "D"],
    });
    expect(parseTeamsFromTitle("Asha vs Bina | Women's Singles Semifinal | Open 2026")).toEqual({
      teamA: ["Asha"],
      teamB: ["Bina"],
    });
  });

  it("returns null without exactly one 'vs'", () => {
    expect(parseTeamsFromTitle("IISc Badminton Club")).toBeNull();
    expect(parseTeamsFromTitle("A vs B vs C")).toBeNull();
    expect(parseTeamsFromTitle("")).toBeNull();
  });
});
