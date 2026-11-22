import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const track = vi.fn();
let session: object | null = { user: { id: "p1" } };

vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ session }) }));

import { PageViewTracker } from "./PageViewTracker";

function renderAt(path: string) {
  const loc = memoryLocation({ path });
  render(
    <Router hook={loc.hook}>
      <PageViewTracker />
    </Router>,
  );
  return loc;
}

describe("PageViewTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    track.mockClear();
    session = { user: { id: "p1" } };
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("logs the route shape once the screen settles", () => {
    renderAt("/tournaments/3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c/draw");
    expect(track).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("page_view", { route: "/tournaments/:id/draw" });
  });

  it("skips screens left within a second (redirect hops)", () => {
    const loc = renderAt("/pulse");
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { loc.navigate("/tournaments", { replace: true }); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("page_view", { route: "/tournaments" });
  });

  it("logs each new screen but not a re-render of the same one", () => {
    const loc = renderAt("/club");
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { loc.navigate("/players"); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(track.mock.calls.map((c) => c[1].route)).toEqual(["/club", "/players"]);
  });

  it("sends nothing for signed-out visitors", () => {
    session = null;
    renderAt("/club");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(track).not.toHaveBeenCalled();
  });
});
