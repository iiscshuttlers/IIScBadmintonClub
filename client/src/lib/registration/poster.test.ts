import { describe, expect, it } from "vitest";
import { posterHtml, publicLink } from "./poster";

describe("registration poster", () => {
  it("links to the public https site", () => {
    expect(publicLink("/tournaments/t1?panel=my-entry")).toBe(
      "https://iiscshuttlers.github.io/IIScBadmintonClub/tournaments/t1?panel=my-entry",
    );
    expect(publicLink("tournaments/t1")).toBe("https://iiscshuttlers.github.io/IIScBadmintonClub/tournaments/t1");
  });

  it("builds an A4 page with the QR, categories and escaped text", () => {
    const html = posterHtml({
      tournament: "Open <2026> & co",
      dates: "Sat 5 Dec",
      categories: [{ label: "Men's Doubles", closes: "Fri 27 Nov, 6 PM" }, { label: "Women's Singles" }],
      link: "https://example.test/t?a=1&b=2",
      qrSvg: "<svg data-qr></svg>",
    });
    expect(html).toContain("@page { size: A4");
    expect(html).toContain("<h1>Open &lt;2026&gt; &amp; co</h1>");
    expect(html).toContain("<svg data-qr></svg>");
    expect(html).toContain("<em>closes Fri 27 Nov, 6 PM</em>");
    expect(html).toContain("Women&#39;s Singles".replace("&#39;", "'"));
    expect(html).toContain("https://example.test/t?a=1&amp;b=2");
    expect(html).toContain('lang="en"');
  });

  it("falls back to 'All events' with no categories", () => {
    expect(posterHtml({ tournament: "T", categories: [], link: "x", qrSvg: "" })).toContain("All events");
  });
});
