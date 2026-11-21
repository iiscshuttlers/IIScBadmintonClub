import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { OnboardingTour, isTourEntryPath, resetOnboardingTour } from "./OnboardingTour";

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <OnboardingTour />
    </Router>,
  );
}

describe("OnboardingTour", () => {
  beforeEach(() => resetOnboardingTour());
  afterEach(() => cleanup());

  it("opens when a first visit starts on Home", () => {
    renderAt("/");
    expect(screen.getByText("Welcome to IISc Badminton Club!")).toBeInTheDocument();
  });

  it("stays closed when a visit starts on a shared match link", () => {
    renderAt("/tournaments/t1/matches/m1");
    expect(screen.queryByText("Welcome to IISc Badminton Club!")).not.toBeInTheDocument();
  });

  it("stays closed once it has been seen", () => {
    localStorage.setItem("onboarding_completed_v1", "1");
    renderAt("/");
    expect(screen.queryByText("Welcome to IISc Badminton Club!")).not.toBeInTheDocument();
  });

  it("only treats Home as an entry page", () => {
    expect(isTourEntryPath("/")).toBe(true);
    expect(isTourEntryPath("/tournaments/t1/live")).toBe(false);
    expect(isTourEntryPath("/player/p1")).toBe(false);
  });
});
