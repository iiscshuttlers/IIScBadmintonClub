import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NAV_INDEX_KEY,
  canGoBackInApp,
  currentNavIndex,
  indexOfState,
  installNavHistory,
  registerParentFallback,
  registerStepHandler,
  runParentFallback,
  runStepHandlers,
} from "./navHistory";

/** jsdom traverses history asynchronously; wait for the popstate. */
function back(): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    window.history.back();
  });
}

describe("navHistory", () => {
  let uninstall: () => void;

  beforeEach(() => {
    // A previous site's entry with no stamp, then the app's landing entry.
    window.history.replaceState(null, "", "/landing");
    uninstall = installNavHistory();
  });

  afterEach(() => uninstall());

  it("stamps the landing entry as the first screen of the app", () => {
    expect(indexOfState(window.history.state)).toBe(0);
    expect(currentNavIndex()).toBe(0);
    expect(canGoBackInApp()).toBe(false);
  });

  it("counts pushed entries and keeps the stamp through replaceState(null)", () => {
    window.history.pushState(null, "", "/pulse");
    window.history.pushState({ tab: "h2h" }, "", "/pulse#h2h");
    expect(currentNavIndex()).toBe(2);
    expect(window.history.state).toMatchObject({ tab: "h2h", [NAV_INDEX_KEY]: 2 });

    window.history.replaceState(null, "", "/pulse#live");
    expect(indexOfState(window.history.state)).toBe(2);
    expect(canGoBackInApp()).toBe(true);
  });

  it("follows Back to the entry's own index", async () => {
    window.history.pushState(null, "", "/a");
    window.history.pushState(null, "", "/b");
    await back();
    expect(currentNavIndex()).toBe(1);
    await back();
    expect(currentNavIndex()).toBe(0);
    expect(canGoBackInApp()).toBe(false);
  });

  it("stamps entries created by a fragment navigation", () => {
    window.location.hash = "players";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(currentNavIndex()).toBe(1);
    expect(indexOfState(window.history.state)).toBe(1);
    // A second event for the same navigation is a no-op.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(currentNavIndex()).toBe(1);
  });

  it("resumes from the stored index after a reload", () => {
    window.history.pushState(null, "", "/a");
    window.history.pushState(null, "", "/b");
    uninstall();
    uninstall = installNavHistory();
    expect(currentNavIndex()).toBe(2);
    expect(canGoBackInApp()).toBe(true);
  });
});

describe("back handlers", () => {
  it("tries step handlers newest first and stops at the first that handles Back", () => {
    const calls: string[] = [];
    const offOuter = registerStepHandler(() => (calls.push("outer"), true));
    const offInner = registerStepHandler(() => (calls.push("inner"), false));
    expect(runStepHandlers()).toBe(true);
    expect(calls).toEqual(["inner", "outer"]);
    offInner();
    offOuter();
    expect(runStepHandlers()).toBe(false);
  });

  it("uses the newest parent fallback and forgets it on unregister", () => {
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = registerParentFallback(first);
    const offSecond = registerParentFallback(second);
    expect(runParentFallback()).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    offSecond();
    runParentFallback();
    expect(first).toHaveBeenCalledOnce();
    offFirst();
    expect(runParentFallback()).toBe(false);
  });
});
