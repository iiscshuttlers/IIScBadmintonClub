import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installNavHistory } from "@/lib/navHistory";
import { BackButton } from "./BackButton";

describe("BackButton", () => {
  let uninstall: () => void;

  beforeEach(() => {
    window.history.replaceState(null, "", "/player/asha");
    uninstall = installNavHistory();
  });

  afterEach(() => {
    uninstall();
    vi.restoreAllMocks();
  });

  it("links to the parent so a new tab still lands somewhere sensible", () => {
    render(<BackButton parent="/pulse#h2h" />);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/pulse#h2h");
  });

  it("returns to the previous in-app screen when there is one", () => {
    window.history.pushState(null, "", "/player/bina");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    render(<BackButton parent="/pulse#h2h" />);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(back).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/player/bina");
  });

  it("replaces the entry with the parent when opened directly", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const length = window.history.length;
    render(<BackButton parent="/pulse#h2h" />);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(back).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.hash).toBe("/pulse#h2h");
    expect(window.history.length).toBe(length);
  });

  it("undoes an in-page step before leaving", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const stepBack = vi.fn(() => true);
    render(<BackButton parent="/host-tournament" onBeforeLeave={stepBack} />);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(stepBack).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/player/asha");
  });
});
