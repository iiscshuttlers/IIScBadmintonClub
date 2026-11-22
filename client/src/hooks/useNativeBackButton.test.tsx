import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installNavHistory, registerParentFallback, registerStepHandler } from "@/lib/navHistory";
import { useNativeBackButton } from "./useNativeBackButton";

const native = vi.hoisted(() => ({
  listener: null as null | ((event: { canGoBack: boolean }) => void),
  remove: vi.fn(),
  exitApp: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn((_event: string, listener: typeof native.listener) => {
      native.listener = listener;
      return Promise.resolve({ remove: native.remove });
    }),
    exitApp: native.exitApp,
  },
}));

const TOURNAMENT = "/tournaments/3f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e5f";
const press = (canGoBack = true) => act(() => native.listener?.({ canGoBack }));

describe("useNativeBackButton", () => {
  let uninstall: () => void;
  let now = 1_000;
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    window.history.replaceState(null, "", `${TOURNAMENT}/schedule?cat=XD&court=2`);
    uninstall = installNavHistory();
    // Presses within 300 ms are treated as one; space them out.
    vi.spyOn(Date, "now").mockImplementation(() => (now += 1_000));
  });

  afterEach(() => {
    cleanups.splice(0).forEach((off) => off());
    uninstall();
    native.listener = null;
    native.exitApp.mockReset();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("goes back to the filtered tournament entry from a match", () => {
    window.history.pushState({}, "", `${TOURNAMENT}/matches/7f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e6a`);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    renderHook(() => useNativeBackButton());

    press();

    expect(back).toHaveBeenCalledOnce();
    expect(native.exitApp).not.toHaveBeenCalled();
  });

  it("lets an in-page step take Back before history", () => {
    window.history.pushState({}, "", "/host-tournament/new");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const step = vi.fn(() => true);
    cleanups.push(registerStepHandler(step));
    renderHook(() => useNativeBackButton());

    press();

    expect(step).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
  });

  it("goes to the screen's parent when the app was opened on this screen", () => {
    // Opened from a notification: no earlier screen of ours, though the
    // WebView itself may report history.
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const parent = vi.fn();
    cleanups.push(registerParentFallback(parent));
    renderHook(() => useNativeBackButton());

    press(true);

    expect(parent).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
    expect(native.exitApp).not.toHaveBeenCalled();
  });

  it("goes home when the screen has no parent registered", () => {
    renderHook(() => useNativeBackButton());

    press(false);

    expect(window.location.pathname).toBe("/");
    expect(native.exitApp).not.toHaveBeenCalled();
  });

  it("asks for a second press before exiting from home", () => {
    window.history.replaceState(null, "", "/");
    renderHook(() => useNativeBackButton());

    press(false);
    expect(native.exitApp).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Press back again to exit");

    press(false);
    expect(native.exitApp).toHaveBeenCalledOnce();
  });
});
