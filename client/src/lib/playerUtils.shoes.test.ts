import { describe, expect, it } from "vitest";
import { parseShoesList } from "./playerUtils";

describe("parseShoesList", () => {
  it("reads the JSON list profile setup saves", () => {
    expect(parseShoesList('[{"name":"Asics COURT FF 3","primary":true}]')).toEqual([
      { name: "Asics COURT FF 3", primary: true },
    ]);
    expect(parseShoesList('[{"name":"A","primary":false},{"name":"B","primary":true}]')).toEqual([
      { name: "A", primary: false },
      { name: "B", primary: true },
    ]);
  });

  it("keeps older plain-text values as one primary shoe", () => {
    expect(parseShoesList("Yonex SHB 65Z")).toEqual([{ name: "Yonex SHB 65Z", primary: true }]);
  });

  it("returns nothing for empty values and drops nameless entries", () => {
    expect(parseShoesList(null)).toEqual([]);
    expect(parseShoesList("")).toEqual([]);
    expect(parseShoesList("[]")).toEqual([]);
    expect(parseShoesList('[{"name":"  "},{"primary":true},null]')).toEqual([]);
    expect(parseShoesList('{"name":"x"}')).toEqual([{ name: '{"name":"x"}', primary: true }]);
  });

  it("shows text that only looks like a list as a plain name", () => {
    expect(parseShoesList("[not json")).toEqual([{ name: "[not json", primary: true }]);
  });
});
