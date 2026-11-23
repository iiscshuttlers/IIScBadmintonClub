import { describe, expect, it } from "vitest";
import { dedupeImport, last10 } from "./importDedupe";

const entered = [{ player_id: "a", partner_id: "b" }];
const players = [
  { id: "a", email: "Asha@x.org", contact_number: "+91 98765 43210" },
  { id: "b", iisc_email: "bala@iisc.ac.in" },
  { id: "z", email: "zed@x.org" },
];

describe("dedupeImport", () => {
  it("skips the same player, e-mail (any case) or phone (last 10 digits)", () => {
    const rows = [
      { playerId: "a", partnerId: null },
      { playerId: null, partnerId: "b" },
      { playerId: null, partnerId: null, email: "asha@X.org" },
      { playerId: null, partnerId: null, phone1: "09876543210" },
      { playerId: "z", partnerId: null, email: "zed@x.org" },
      { playerId: null, partnerId: null, email: "new@x.org", phone1: "12345" },
    ];
    const { keep, skipped } = dedupeImport(rows, entered, players);
    expect(skipped).toHaveLength(4);
    expect(keep.map((k) => k.email ?? k.playerId)).toEqual(["zed@x.org", "new@x.org"]);
  });
  it("last10 needs ten digits", () => {
    expect(last10("+91-98765-43210")).toBe("9876543210");
    expect(last10("12345")).toBeNull();
  });
});
