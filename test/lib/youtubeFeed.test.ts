import { describe, it, expect } from "vitest";
import {
  decodeXml,
  mergeVideos,
  parseFeed,
  parseVideoTitle,
  pickNewEntries,
  toSiteVideo,
  type SiteVideo,
} from "../../supabase/functions/_shared/youtubeFeed";

// Same shape as https://www.youtube.com/feeds/videos.xml?channel_id=…
const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>IISc Badminton Club</title>
 <entry>
  <id>yt:video:AAAAAAAAAA1</id>
  <yt:videoId>AAAAAAAAAA1</yt:videoId>
  <title>Asha Rao vs Bina Das | Women's Singles Semifinal | Open Tournament August 2026</title>
  <published>2026-11-18T11:51:31+00:00</published>
  <media:group><media:title>Asha Rao vs Bina Das | Women's Singles Semifinal | Open Tournament August 2026</media:title></media:group>
 </entry>
 <entry>
  <id>yt:video:BBBBBBBBB-2</id>
  <yt:videoId>BBBBBBBBB-2</yt:videoId>
  <title>Men's Doubles Semifinal: Chetan K &amp; Dev M vs Eshan P &amp; Farhan Q</title>
  <published>2026-11-18T15:03:35+00:00</published>
 </entry>
 <entry>
  <id>yt:video:not-an-id</id>
  <yt:videoId>bad</yt:videoId>
  <title>Broken entry</title>
 </entry>
</feed>`;

describe("parseFeed", () => {
  it("reads id, decoded title and publish time; skips malformed entries", () => {
    expect(parseFeed(FEED)).toEqual([
      {
        videoId: "AAAAAAAAAA1",
        title: "Asha Rao vs Bina Das | Women's Singles Semifinal | Open Tournament August 2026",
        publishedAt: "2026-11-18T11:51:31+00:00",
      },
      {
        videoId: "BBBBBBBBB-2",
        title: "Men's Doubles Semifinal: Chetan K & Dev M vs Eshan P & Farhan Q",
        publishedAt: "2026-11-18T15:03:35+00:00",
      },
    ]);
  });

  it("returns nothing for a page that isn't a feed", () => {
    expect(parseFeed("<html><body>consent</body></html>")).toEqual([]);
  });
});

describe("decodeXml", () => {
  it("decodes named and numeric entities and CDATA", () => {
    expect(decodeXml("A &amp; B &#39;26 &#x2764; &quot;x&quot;")).toBe("A & B '26 ❤ \"x\"");
    expect(decodeXml("<![CDATA[A & B]]>")).toBe("A & B");
    expect(decodeXml("&bogus; &#0;")).toBe("&bogus; &#0;");
  });
});

describe("parseVideoTitle", () => {
  it("matchup | event | tournament", () => {
    expect(parseVideoTitle("Asha Rao vs Bina Das | Women's Singles Semifinal | Open Tournament August 2026")).toEqual({
      matchup: "Asha Rao vs Bina Das",
      event: "Women's Singles Semifinal",
      tournament: "Open Tournament August 2026",
    });
  });

  it("Event: matchup, with and without a tournament part", () => {
    expect(parseVideoTitle("Men's Doubles 3RD Place Playoff: A & B vs C & D")).toEqual({
      matchup: "A & B vs C & D",
      event: "Men's Doubles 3RD Place Playoff",
      tournament: null,
    });
    expect(parseVideoTitle("Men's Singles Quarterfinal: A vs B | Open Tournament August 2026")).toEqual({
      matchup: "A vs B",
      event: "Men's Singles Quarterfinal",
      tournament: "Open Tournament August 2026",
    });
  });

  it("the older 'A vs B || Event' convention", () => {
    expect(parseVideoTitle("Radhika vs Tanisha || WS Finals")).toEqual({
      matchup: "Radhika vs Tanisha",
      event: "WS Finals",
      tournament: null,
    });
  });

  it("normalises 'vs.' and spacing; ignores a colon after the vs", () => {
    expect(parseVideoTitle("A  VS.  B: decider").matchup).toBe("A vs B: decider");
  });

  it("returns nulls when there is no matchup", () => {
    expect(parseVideoTitle("IISc Badminton Club")).toEqual({ matchup: null, event: null, tournament: null });
  });
});

describe("toSiteVideo", () => {
  it("uses the matchup as the title and keeps the YouTube title", () => {
    const [entry] = parseFeed(FEED);
    expect(toSiteVideo(entry)).toEqual({
      id: "yt-AAAAAAAAAA1",
      title: "Asha Rao vs Bina Das",
      videoId: "AAAAAAAAAA1",
      category: "Women's Singles Semifinal",
      tournament: "Open Tournament August 2026",
      chapters: [],
      source: "youtube",
      youtubeTitle: "Asha Rao vs Bina Das | Women's Singles Semifinal | Open Tournament August 2026",
      publishedAt: "2026-11-18T11:51:31+00:00",
    });
  });

  it("falls back to the raw title and no tournament", () => {
    const v = toSiteVideo({ videoId: "CCCCCCCCCC3", title: "Club promo", publishedAt: "" });
    expect(v.title).toBe("Club promo");
    expect(v.category).toBe("");
    expect("tournament" in v).toBe(false);
  });
});

const saved = (videoId: string, extra: Partial<SiteVideo> = {}): SiteVideo => ({
  id: `v-${videoId}`,
  title: "saved",
  videoId,
  category: "",
  ...extra,
});

describe("pickNewEntries", () => {
  const entries = parseFeed(FEED);

  it("skips videos already listed, hidden ones included, and newest comes first", () => {
    expect(pickNewEntries([], entries).map((e) => e.videoId)).toEqual(["BBBBBBBBB-2", "AAAAAAAAAA1"]);
    expect(pickNewEntries([saved("AAAAAAAAAA1", { hidden: true })], entries).map((e) => e.videoId)).toEqual([
      "BBBBBBBBB-2",
    ]);
  });

  it("skips remembered Shorts and duplicate feed rows", () => {
    expect(pickNewEntries([], [...entries, entries[0]], ["BBBBBBBBB-2"]).map((e) => e.videoId)).toEqual([
      "AAAAAAAAAA1",
    ]);
  });
});

describe("mergeVideos", () => {
  it("puts new videos on top and never touches or duplicates existing ones", () => {
    const existing = [saved("AAAAAAAAAA1", { chapters: [{ time: 5, title: "Rally" }] })];
    const merged = mergeVideos(existing, [
      toSiteVideo({ videoId: "BBBBBBBBB-2", title: "X vs Y", publishedAt: "" }),
      toSiteVideo({ videoId: "AAAAAAAAAA1", title: "dup", publishedAt: "" }),
    ]);
    expect(merged.map((v) => v.videoId)).toEqual(["BBBBBBBBB-2", "AAAAAAAAAA1"]);
    expect(merged[1]).toBe(existing[0]);
  });
});
