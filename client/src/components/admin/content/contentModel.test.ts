import { describe, expect, it } from "vitest";
import {
  CONTENT_KEYS,
  DOC_SPECS,
  contentAttention,
  itemStatus,
  keepAddedElsewhere,
  mergePolls,
  pollStatus,
  summarizeChange,
  type ContentDocs,
} from "./contentModel";
import type { Poll } from "../../feed/PollsSection";

const poll = (over: Partial<Poll> = {}): Poll => ({
  id: "p1",
  question: "Who wins?",
  options: [
    { id: "a", text: "A", votes: [] },
    { id: "b", text: "B", votes: [] },
  ],
  created_at: "2026-11-01T00:00:00Z",
  is_active: true,
  tournament_id: "t1",
  ...over,
});

const emptyDocs = (): ContentDocs => {
  const docs = {} as Record<string, unknown>;
  for (const key of CONTENT_KEYS) docs[key] = DOC_SPECS[key].read(undefined);
  return docs as unknown as ContentDocs;
};

describe("DOC_SPECS.read", () => {
  it("gives every row a usable empty value, so nothing waits on a missing row", () => {
    const docs = emptyDocs();
    expect(docs.announcements).toEqual({ recent: [], hiddenAuto: [] });
    expect(docs.home_banners).toEqual([]);
    expect(docs.polls).toEqual([]);
    expect(docs.club_settings.about).toEqual({ mission: "", history: "" });
    expect(docs.convener_photos.convener).toBeTruthy();
  });

  it("reads polls and banners in either stored shape", () => {
    expect(DOC_SPECS.polls.read({ polls: [poll()] })).toHaveLength(1);
    expect(DOC_SPECS.home_banners.read({ banners: [{ id: "x" }] })).toHaveLength(1);
  });
});

describe("writes keep other people's changes", () => {
  it("keeps items added elsewhere and honours deletions", () => {
    const original = [{ id: "1" }, { id: "2" }];
    const draft = [{ id: "1" }]; // admin deleted 2
    const fresh = [{ id: "1" }, { id: "2" }, { id: "3" }]; // 3 arrived meanwhile
    expect(keepAddedElsewhere(draft, original, fresh).map((x) => x.id)).toEqual(["1", "3"]);
  });

  it("takes poll votes from the database, never from the stale draft", () => {
    const original = [poll()];
    const draft = [poll({ question: "Who wins the final?" })];
    const fresh = [
      poll({ options: [{ id: "a", text: "A", votes: ["u1", "u2"] }, { id: "b", text: "B", votes: ["u3"] }] }),
      poll({ id: "p2", question: "Organiser poll" }),
    ];
    const merged = mergePolls(draft, original, fresh);
    expect(merged[0].question).toBe("Who wins the final?");
    expect(merged[0].options.map((o) => o.votes.length)).toEqual([2, 1]);
    expect(merged.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("writes only about/stats into club_settings and leaves Settings' keys alone", () => {
    const draft = { about: { mission: " Play hard ", history: "" }, stats: { members: "400", tournaments: "", courts: "", trophies: "" } };
    const out = DOC_SPECS.club_settings.write(draft, {
      fresh: { maintenanceMode: true, about: { mission: "old" } },
      original: DOC_SPECS.club_settings.read(undefined),
    }) as Record<string, any>;
    expect(out.maintenanceMode).toBe(true);
    expect(out.about.mission).toBe("Play hard");
    expect(out.stats.members).toBe("400");
  });

  it("drops untitled announcements and keeps hidden automatic posts", () => {
    const out = DOC_SPECS.announcements.write(
      { recent: [{ title: "", content: "", category: "general" }, { title: "Hi", content: "", category: "general" }], hiddenAuto: ["k"] },
      { fresh: undefined, original: { recent: [], hiddenAuto: [] } },
    ) as { recent: unknown[]; hiddenAuto: string[] };
    expect(out.recent).toHaveLength(1);
    expect(out.hiddenAuto).toEqual(["k"]);
  });

  it("saves holidays in date order", () => {
    const out = DOC_SPECS.holidays.write(
      [{ date: "2026-12-25", name: "Christmas" }, { date: "2026-11-01", name: "Rajyotsava" }, { date: "", name: "x" }],
      { fresh: undefined, original: [] },
    ) as { date: string }[];
    expect(out.map((h) => h.date)).toEqual(["2026-11-01", "2026-12-25"]);
  });
});

describe("summarizeChange", () => {
  it("names added, removed and edited items", () => {
    const lines = summarizeChange(
      "home_banners",
      [{ id: "1", title: "Old" }, { id: "2", title: "Gone" }] as never,
      [{ id: "1", title: "New" }, { id: "3", title: "Fresh" }] as never,
    );
    expect(lines).toEqual([
      { kind: "edited", text: "New" },
      { kind: "added", text: "Fresh" },
      { kind: "removed", text: "Gone" },
    ]);
  });

  it("pairs edits by title for lists without ids", () => {
    const lines = summarizeChange(
      "holidays",
      [{ date: "2026-12-25", name: "Christmas" }],
      [{ date: "2026-12-26", name: "Christmas" }],
    );
    expect(lines).toEqual([{ kind: "edited", text: "Christmas (2026-12-26)" }]);
  });

  it("reports a pure reorder", () => {
    const a = { id: "1", title: "A" };
    const b = { id: "2", title: "B" };
    expect(summarizeChange("home_banners", [a, b] as never, [b, a] as never)).toEqual([{ kind: "edited", text: "Order changed" }]);
  });
});

describe("status helpers", () => {
  it("itemStatus", () => {
    expect(itemStatus(false, "", "", "2026-11-22")).toBe("off");
    expect(itemStatus(true, "2026-12-01", "", "2026-11-22")).toBe("scheduled");
    expect(itemStatus(true, "", "2026-11-21", "2026-11-22")).toBe("ended");
    expect(itemStatus(true, "", "2026-11-22", "2026-11-22")).toBe("live");
  });

  it("pollStatus matches the Predict tab, to the minute", () => {
    const now = new Date("2026-11-22T12:00:00").getTime();
    expect(pollStatus(poll({ end_date: "2026-11-22T11:59" }), now)).toBe("ended");
    expect(pollStatus(poll({ start_date: "2026-11-22T12:30" }), now)).toBe("scheduled");
    expect(pollStatus(poll({ is_archived: true }), now)).toBe("archived");
    expect(pollStatus(poll(), now)).toBe("live");
  });
});

describe("contentAttention", () => {
  const today = "2026-11-22";
  const now = new Date("2026-11-22T12:00:00").getTime();

  it("flags open polls that closed, can't be voted on, or aren't linked", () => {
    const docs = emptyDocs();
    docs.polls = [
      poll({ id: "late", end_date: "2026-11-20T10:00" }),
      poll({ id: "thin", options: [{ id: "a", text: "A", votes: [] }] }),
      poll({ id: "loose", tournament_id: undefined }),
      poll({ id: "done", is_active: false, end_date: "2026-11-01T10:00" }),
    ];
    docs.holidays = [{ date: "2026-12-25", name: "Christmas" }];
    const ids = contentAttention(docs, today, now).map((a) => a.id);
    expect(ids).toEqual(["poll-ended-late", "poll-options-thin", "poll-tournament-loose"]);
  });

  it("offers fixes that only touch the draft", () => {
    const docs = emptyDocs();
    docs.holidays = [{ date: "2026-12-25", name: "Christmas" }];
    docs.home_banners = [{ id: "b", type: "notice", title: "Old", message: "", color: "blue", active: true, ends_on: "2026-11-01" }];
    const item = contentAttention(docs, today, now).find((a) => a.id === "hb-ended-b");
    expect(item?.fix?.label).toBe("Switch off");
    const next = item!.fix!.apply(docs) as ContentDocs["home_banners"];
    expect(next[0].active).toBe(false);
    expect(docs.home_banners[0].active).toBe(true);
  });

  it("nudges when no upcoming holidays are listed", () => {
    const ids = contentAttention(emptyDocs(), today, now).map((a) => a.id);
    expect(ids).toContain("hol-none");
  });
});
