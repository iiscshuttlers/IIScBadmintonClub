import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { VideoItem } from "./shared";

const { syncStatus, invoke, toast } = vi.hoisted(() => ({
  syncStatus: {
    lastRunAt: "2026-11-21T08:17:00Z",
    ok: true,
    lastAddedCount: 2,
    lastAddedAt: "2026-11-21T08:17:00Z",
    shortIds: [] as string[],
  },
  invoke: vi.fn(),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: syncStatus }, error: null }) }) }),
    }),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));
vi.mock("@/contexts/AdminHistoryContext", () => ({ useAdminHistory: () => ({}) }));
vi.mock("sonner", () => ({ toast }));

import { VideoEditor } from "./VideoEditor";

const yt: VideoItem = {
  id: "yt-AAAAAAAAAA1",
  title: "Asha vs Bina",
  videoId: "AAAAAAAAAA1",
  category: "Women's Singles Semifinal",
  tournament: "Open 2026",
  chapters: [],
  source: "youtube",
  youtubeTitle: "Asha vs Bina | Women's Singles Semifinal | Open 2026",
};
const manual: VideoItem = { id: "v1", title: "Old final", videoId: "BBBBBBBBBB2", category: "", chapters: [] };

const renderEditor = (data: VideoItem[], extra: { reload?: () => Promise<void>; isDirty?: boolean } = {}) => {
  const onChange = vi.fn();
  render(<VideoEditor data={data} onChange={onChange} {...extra} />);
  return onChange;
};

beforeEach(() => {
  invoke.mockReset();
  toast.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("VideoEditor", () => {
  it("shows the sync status and marks videos added from YouTube", async () => {
    renderEditor([yt, manual]);
    expect(await screen.findByText(/Last checked .*: added 2/)).toBeTruthy();
    expect(screen.getAllByText("Added from YouTube")).toHaveLength(1);
    expect(screen.getByText(/On YouTube: Asha vs Bina \| Women's Singles Semifinal/)).toBeTruthy();
  });

  it("hides a saved video instead of deleting it", () => {
    const onChange = renderEditor([yt, manual]);
    fireEvent.click(screen.getAllByRole("button", { name: "Hide from the website" })[0]);
    expect(onChange).toHaveBeenCalledWith([{ ...yt, hidden: true }, manual]);
  });

  it("deletes an unsaved blank row outright", () => {
    const blank: VideoItem = { id: "v9", title: "", videoId: "", category: "", chapters: [] };
    const onChange = renderEditor([manual, blank]);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith([manual]);
  });

  it("lists hidden videos separately and can show them again", () => {
    const onChange = renderEditor([{ ...yt, hidden: true }, manual]);
    expect(screen.queryByDisplayValue("Asha vs Bina")).toBeNull();
    expect(screen.getByText("Hidden from the website (1)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Show again/ }));
    expect(onChange).toHaveBeenCalledWith([{ ...yt, hidden: false }, manual]);
  });

  it("Check now runs the sync and reloads when something was added", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    invoke.mockResolvedValue({ data: { added: [{ videoId: "CCCCCCCCCC3", title: "New" }], status: syncStatus }, error: null });
    renderEditor([manual], { reload });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Check now/ }));
    });
    expect(invoke).toHaveBeenCalledWith("sync-youtube-videos", { body: { type: "admin" } });
    expect(toast.success).toHaveBeenCalledWith("Added 1 new video from YouTube");
    expect(reload).toHaveBeenCalled();
  });

  it("Check now refuses while there are unsaved edits", async () => {
    renderEditor([manual], { isDirty: true });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Check now/ }));
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("Check now reports a failed sync", async () => {
    invoke.mockResolvedValue({
      data: { added: [], status: { ...syncStatus, ok: false, lastError: "YouTube feed returned HTTP 500" } },
      error: null,
    });
    renderEditor([manual]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Check now/ }));
    });
    expect(toast.error).toHaveBeenCalledWith("YouTube check failed: YouTube feed returned HTTP 500");
    expect(screen.getByText(/Last check failed/)).toBeTruthy();
  });
});
