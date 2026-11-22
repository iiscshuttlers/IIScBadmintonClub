import { describe, expect, it } from "vitest";
import { sortParticipantsAlphabetically } from "./LivePlayersSection";

const p = (display_name: string | null, full_name: string | null = null) => ({
  display_name,
  player: full_name === null ? null : { full_name, department: null },
});

const names = (list: ReturnType<typeof p>[]) => list.map((x) => x.display_name ?? x.player?.full_name ?? "");

describe("sortParticipantsAlphabetically", () => {
  it("sorts singles A–Z ignoring case", () => {
    const sorted = sortParticipantsAlphabetically([p("Utkarsh Yadav"), p("anurag Tamuli"), p("Chethan"), p("Raja Janmejay")]);
    expect(names(sorted)).toEqual(["anurag Tamuli", "Chethan", "Raja Janmejay", "Utkarsh Yadav"]);
  });

  it("sorts doubles pairs by their first player", () => {
    const sorted = sortParticipantsAlphabetically([p("Sathish Kumar & Anil"), p("Kaustav B & Raja J")]);
    expect(names(sorted)).toEqual(["Kaustav B & Raja J", "Sathish Kumar & Anil"]);
  });

  it("falls back to the player's name and puts unnamed entries last", () => {
    const sorted = sortParticipantsAlphabetically([p(null, null), p(null, "Zara"), p("Bala")]);
    expect(names(sorted)).toEqual(["Bala", "Zara", ""]);
  });

  it("does not change the input array", () => {
    const input = [p("B"), p("A")];
    sortParticipantsAlphabetically(input);
    expect(names(input)).toEqual(["B", "A"]);
  });
});
