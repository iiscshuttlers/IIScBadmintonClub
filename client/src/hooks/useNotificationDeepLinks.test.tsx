import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationDeepLinks } from "./useNotificationDeepLinks";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  nativeListener: null as null | ((action: { notification?: { data?: Record<string, unknown> } }) => void),
  remove: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/", state.navigate] }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    addListener: vi.fn((_event: string, listener: typeof state.nativeListener) => {
      state.nativeListener = listener;
      return Promise.resolve({ remove: state.remove });
    }),
  },
}));

describe("useNotificationDeepLinks", () => {
  let webMessage: ((event: MessageEvent) => void) | null;

  beforeEach(() => {
    webMessage = null;
    state.navigate.mockReset();
    state.nativeListener = null;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        addEventListener: vi.fn((_event: string, listener: (event: MessageEvent) => void) => { webMessage = listener; }),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes cold native and warm web taps through the same canonical target", async () => {
    renderHook(() => useNotificationDeepLinks());
    await waitFor(() => expect(state.nativeListener).toBeTypeOf("function"));

    act(() => state.nativeListener?.({ notification: { data: { link: "/tournaments/t1/matches/m1" } } }));
    expect(state.navigate).toHaveBeenLastCalledWith("/tournaments/t1/matches/m1");

    act(() => webMessage?.({ data: { type: "PUSH_DEEP_LINK", path: "/tournaments/t2/matches/m2" } } as MessageEvent));
    expect(state.navigate).toHaveBeenLastCalledWith("/tournaments/t2/matches/m2");
  });
});
