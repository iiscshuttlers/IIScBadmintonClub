import { act, render } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollToTop } from "./ScrollToTop";

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

    act(() => loc.navigate("/tournaments/t1/schedule?cat=XD"));

    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        expect(window.scrollTo).toHaveBeenCalledWith(0, 420);
        resolve();
      }),
    );
  });
});
