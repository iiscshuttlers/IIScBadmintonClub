import { act, render } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollToTop } from "./ScrollToTop";
import { restoreScrollOnNextRoute } from "@/lib/scrollRestoreIntent";

function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
}

const LIST_KEY = "iiscshuttlers:scroll:/tournaments/t1/schedule?cat=XD";

describe("ScrollToTop", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setScrollY(0);
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  it("saves the list offset the user scrolled to, even when the next page clamps scrollY", () => {
    const loc = memoryLocation({ path: "/tournaments/t1/schedule?cat=XD" });
    render(
      <Router hook={loc.hook}>
        <ScrollToTop />
      </Router>,
    );

    setScrollY(700);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    // The match page is shorter, so the browser has clamped scrollY to 0 by
    // the time the app reacts to the route change.
    setScrollY(0);
    act(() => loc.navigate("/tournaments/t1/matches/m1"));

    expect(sessionStorage.getItem(LIST_KEY)).toBe("700");
  });

  it("restores the saved offset when Back returns to the list", () => {
    const loc = memoryLocation({ path: "/tournaments/t1/schedule?cat=XD" });
    render(
      <Router hook={loc.hook}>
        <ScrollToTop />
      </Router>,
    );
    setScrollY(420);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    act(() => loc.navigate("/tournaments/t1/matches/m1"));
    vi.mocked(window.scrollTo).mockClear();

    back(loc, "/tournaments/t1/schedule?cat=XD");

    return nextFrame().then(() => {
      expect(window.scrollTo).toHaveBeenCalledWith(0, 420);
    });
  });

  it("starts a link tap to a page visited earlier at the top", () => {
    const loc = memoryLocation({ path: "/tournaments/t1/schedule?cat=XD" });
    render(
      <Router hook={loc.hook}>
        <ScrollToTop />
      </Router>,
    );
    setScrollY(420);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    act(() => loc.navigate("/tournaments/t1/matches/m1"));
    vi.mocked(window.scrollTo).mockClear();

    // A push (link / nav tab), not Back.
    act(() => loc.navigate("/tournaments/t1/schedule?cat=XD"));

    return nextFrame().then(() => {
      expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
      expect(window.scrollTo).not.toHaveBeenCalledWith(0, 420);
    });
  });

  it("stops restoring once the user scrolls, so the page is not yanked back", () => {
    const loc = memoryLocation({ path: "/tournaments/t1/schedule?cat=XD" });
    render(
      <Router hook={loc.hook}>
        <ScrollToTop />
      </Router>,
    );
    setScrollY(420);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    act(() => loc.navigate("/tournaments/t1/matches/m1"));
    vi.mocked(window.scrollTo).mockClear();

    back(loc, "/tournaments/t1/schedule?cat=XD");
    window.dispatchEvent(new Event("touchstart"));

    return nextFrame().then(() => {
      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });

  it("restores when useGoBack falls back to the parent route", () => {
    const loc = memoryLocation({ path: "/tournaments/t1/schedule?cat=XD" });
    render(
      <Router hook={loc.hook}>
        <ScrollToTop />
      </Router>,
    );
    setScrollY(300);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    act(() => loc.navigate("/tournaments/t1/matches/m1"));
    vi.mocked(window.scrollTo).mockClear();

    restoreScrollOnNextRoute();
    act(() => loc.navigate("/tournaments/t1/schedule?cat=XD", { replace: true }));

    return nextFrame().then(() => {
      expect(window.scrollTo).toHaveBeenCalledWith(0, 300);
    });
  });
});

/** Browser Back: popstate fires, then the router moves to the earlier route. */
function back(loc: { navigate: (path: string, options?: { replace?: boolean }) => void }, path: string) {
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
    loc.navigate(path, { replace: true });
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
