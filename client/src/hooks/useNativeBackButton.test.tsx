import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("useNativeBackButton tournament history", () => {
  afterEach(() => {
    native.listener = null;
    vi.restoreAllMocks();
  });

  it("uses browser history from a match so the filtered tournament entry remains available", () => {
    window.history.replaceState({}, "", "/tournaments/3f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e5f/schedule?cat=XD&court=2");
    window.history.pushState({}, "", "/tournaments/3f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e5f/matches/7f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e6a");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    renderHook(() => useNativeBackButton());

    expect(native.listener).toBeTypeOf("function");
    act(() => native.listener?.({ canGoBack: true }));

    expect(back).toHaveBeenCalledOnce();
    expect(native.exitApp).not.toHaveBeenCalled();
  });
});
