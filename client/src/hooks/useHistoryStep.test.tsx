import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installNavHistory, runStepHandlers } from "@/lib/navHistory";
import { useHistoryStep } from "./useHistoryStep";

const parentOf = (step: number) => (step > 1 ? step - 1 : undefined);

describe("useHistoryStep", () => {
  let uninstall: () => void;

  beforeEach(() => {
    window.history.replaceState(null, "", "/host-tournament/new");
    uninstall = installNavHistory();
  });

  afterEach(() => uninstall());

  it("pushes an entry per step and Back pops to the previous step", async () => {
    const { result } = renderHook(() => useHistoryStep("wizard", 1, parentOf));
    act(() => result.current.go(2));
    act(() => result.current.go(3));
    expect(result.current.value).toBe(3);

    act(() => {
      expect(result.current.back()).toBe(true);
    });
    await waitFor(() => expect(result.current.value).toBe(2));
    expect(window.history.state.wizard).toBe(2);

    // The browser's own Back walks the same entries.
    act(() => window.history.back());
    await waitFor(() => expect(result.current.value).toBe(1));
  });

  it("steps back without leaving when the step was restored with no entries behind it", () => {
    window.history.replaceState({ wizard: 3 }, "");
    const { result } = renderHook(() => useHistoryStep("wizard", 1, parentOf));
    expect(result.current.value).toBe(3);

    act(() => {
      expect(result.current.back()).toBe(true);
    });
    expect(result.current.value).toBe(2);
    expect(window.history.state.wizard).toBe(2);
  });

  it("reports nothing to undo on the first step", () => {
    const { result } = renderHook(() => useHistoryStep("wizard", 1, parentOf));
    act(() => {
      expect(result.current.back()).toBe(false);
    });
    expect(result.current.value).toBe(1);
  });

  it("seeds from the initial value and records it on the opening entry", () => {
    const { result } = renderHook(() => useHistoryStep("wizard", () => 2, parentOf));
    expect(result.current.value).toBe(2);
    expect(window.history.state.wizard).toBe(2);
  });

  it("lets the phone's Back key undo the step while mounted", async () => {
    const { result, unmount } = renderHook(() => useHistoryStep("wizard", 1, parentOf));
    act(() => result.current.go(2));
    act(() => {
      expect(runStepHandlers()).toBe(true);
    });
    await waitFor(() => expect(result.current.value).toBe(1));
    unmount();
    expect(runStepHandlers()).toBe(false);
  });

  it("ignores a push marker copied into an entry someone else pushed", () => {
    const { result } = renderHook(() => useHistoryStep("wizard", 1, parentOf));
    act(() => result.current.go(2));
    // e.g. a tab hook spreading the current state into its own entry
    act(() => window.history.pushState({ ...window.history.state, tab: "x" }, ""));
    act(() => {
      expect(result.current.back()).toBe(true);
    });
    // Not popped: replaced in place with the parent step.
    expect(window.history.state).toMatchObject({ wizard: 1, tab: "x" });
  });
});
