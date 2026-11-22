import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/* ---- a tiny in-memory site_data ---------------------------------- */
type Row = { key: string; value: unknown; updated_at: string | null };
const db = vi.hoisted(() => ({
  rows: [] as { key: string; value: unknown; updated_at: string | null }[],
  upserts: [] as { key: string; value: unknown }[],
  failLoad: false,
}));

vi.mock("@/lib/supabase", () => {
  const from = () => {
    let key: string | undefined;
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = (_col: string, k: string) => {
      key = k;
      return q;
    };
    q.in = () =>
      Promise.resolve(db.failLoad ? { data: null, error: { message: "network down" } } : { data: db.rows, error: null });
    q.maybeSingle = () => Promise.resolve({ data: db.rows.find((r: Row) => r.key === key) ?? null, error: null });
    q.upsert = (row: Row) => {
      db.upserts.push(row);
      db.rows = [...db.rows.filter((r: Row) => r.key !== row.key), row];
      return Promise.resolve({ error: null });
    };
    return q;
  };
  return { supabase: { from, functions: { invoke: vi.fn() }, channel: vi.fn() }, isSupabaseConfigured: true };
});

const recordAction = vi.fn(async () => {});
vi.mock("@/contexts/AdminHistoryContext", () => ({ useAdminHistory: () => ({ recordAction, reloadTrigger: 0 }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/contexts/ConfirmContext", () => ({ useConfirm: () => ({ confirm: async () => true }) }));
vi.mock("@/services/tournamentService", () => ({ fetchTournaments: vi.fn(async () => []) }));
vi.mock("@/hooks/queries/useAutoFeedTournaments", () => ({
  useAutoFeedTournaments: () => ({ data: [], isLoading: false, error: null }),
}));
vi.mock("./ConvenerEditor", () => ({ ConvenerEditor: () => <div>Convener editor</div> }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));

import { ContentHub } from "./ContentHub";

beforeEach(() => {
  db.rows = [];
  db.upserts = [];
  db.failLoad = false;
  recordAction.mockClear();
  window.history.replaceState(null, "", "/admin#content");
});

describe("ContentHub", () => {
  it("opens with no content rows at all instead of spinning forever", async () => {
    render(<ContentHub />);
    expect(await screen.findByText("Needs attention")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading content" })).toBeNull();
    // The old Landing tab case: no club_settings row, About editor still usable.
    fireEvent.click(screen.getByRole("tab", { name: /Club page/ }));
    expect(await screen.findByLabelText("Our mission")).toBeTruthy();
  });

  it("shows a retry instead of a spinner when loading fails", async () => {
    db.failLoad = true;
    render(<ContentHub />);
    expect(await screen.findByText("Couldn't load site content")).toBeTruthy();
    db.failLoad = false;
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByText("Needs attention")).toBeTruthy();
  });

  it("opens the tab an old link points at", async () => {
    window.history.replaceState(null, "", "/admin#polls");
    render(<ContentHub />);
    expect(await screen.findByRole("tab", { name: /Posts/, selected: true })).toBeTruthy();
    expect(window.location.search).toBe("?tab=posts");
  });

  it("saves a new Home banner through one save bar, keeping a banner added meanwhile", async () => {
    db.rows = [{ key: "home_banners", value: [], updated_at: "2026-11-01T00:00:00Z" }];
    render(<ContentHub />);
    fireEvent.click(await screen.findByRole("tab", { name: /Home/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add banner/ }));
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Courts closed Sunday" } });

    // It shows up in the Home preview straight away.
    const preview = document.getElementById("content-preview")!;
    expect(within(preview).getByText("Courts closed Sunday")).toBeTruthy();

    // Meanwhile a push broadcast adds its own banner to the row.
    db.rows = [
      {
        key: "home_banners",
        value: [{ id: "push-1", type: "custom", title: "From a push", message: "", color: "amber", active: true }],
        updated_at: "2026-11-22T10:00:00Z",
      },
    ];

    const bar = screen.getByRole("region", { name: "Unsaved content changes" });
    expect(within(bar).getByText("Home banners")).toBeTruthy();
    fireEvent.click(within(bar).getByRole("button", { name: /Review/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Courts closed Sunday")).toBeTruthy();
    expect(await within(dialog).findByText(/Someone else changed this/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Save 1 section/ }));

    await waitFor(() => expect(db.upserts).toHaveLength(1));
    const saved = db.upserts[0].value as { title: string }[];
    expect(saved.map((b) => b.title)).toEqual(["Courts closed Sunday", "From a push"]);
    expect(recordAction).toHaveBeenCalledWith(expect.objectContaining({ entity_id: "home_banners" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Unsaved content changes" })).toBeNull());
  });

  it("writes About text into club_settings without touching maintenance mode", async () => {
    db.rows = [{ key: "club_settings", value: { maintenanceMode: true }, updated_at: null }];
    render(<ContentHub />);
    fireEvent.click(await screen.findByRole("tab", { name: /Club page/ }));
    fireEvent.change(screen.getByLabelText("Our mission"), { target: { value: "Play more badminton." } });
    fireEvent.click(screen.getByRole("button", { name: /Review/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Save 1 section/ }));
    await waitFor(() => expect(db.upserts).toHaveLength(1));
    expect(db.upserts[0]).toMatchObject({
      key: "club_settings",
      value: { maintenanceMode: true, about: { mission: "Play more badminton.", history: "" } },
    });
  });
});
