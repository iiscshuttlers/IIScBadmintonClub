import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { canGoBackInApp, runParentFallback, runStepHandlers } from "@/lib/navHistory";

function showExitToast(onDone: () => void) {
  const toast = document.createElement("div");
  toast.textContent = "Press back again to exit";
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "40px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "color-mix(in srgb, var(--popover) 92%, transparent)",
    color: "var(--popover-foreground)",
    padding: "10px 22px",
    borderRadius: "30px",
    fontSize: "14px",
    fontWeight: "600",
    zIndex: "99999",
    backdropFilter: "blur(8px)",
    boxShadow: "0 4px 20px color-mix(in srgb, var(--scrim) 40%, transparent)",
    transition: "opacity 0.3s ease",
    pointerEvents: "none",
  });

  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    window.setTimeout(() => {
      toast.remove();
      onDone();
    }, 300);
  }, 2000);
}

/**
 * Detects any open overlay that should capture the Back button before
 * we do history navigation:
 *  – Radix UI Dialog / Sheet / AlertDialog / DropdownMenu / Select / Combobox
 *  – Vaul (swipe-up) drawers
 *  – Any element whose body scroll-lock indicates an open overlay
 *
 * Returns true when such an overlay is present.
 */
function hasOpenOverlay(): boolean {
  // 1. Radix UI: data-state="open" on ARIA roles
  const radixOpen = document.querySelector(
    '[role="dialog"][data-state="open"],' +
    '[role="alertdialog"][data-state="open"],' +
    '[role="menu"][data-state="open"],' +
    '[role="listbox"][data-state="open"],' +
    '[role="tooltip"][data-state="open"]',
  );
  if (radixOpen) return true;

  // 2. Radix UI popover/combobox content wrapper (not always a dialog role)
  const radixPopover = document.querySelector(
    '[data-radix-popper-content-wrapper] [data-state="open"],' +
    '[data-radix-popper-content-wrapper]',
  );
  if (radixPopover) return true;

  // 3. Vaul drawer (swipe-up sheet used on mobile)
  const vaulDrawer = document.querySelector(
    '[data-vaul-drawer][data-state="open"],' +
    '[vaul-drawer][data-state="open"]',
  );
  if (vaulDrawer) return true;

  // 4. Body scroll-lock is Radix's / Vaul's signal that a layer is open
  //    Radix sets overflow:hidden; Vaul does the same.
  const bodyStyle = window.getComputedStyle(document.body);
  if (bodyStyle.overflow === "hidden" || bodyStyle.overflowY === "hidden") return true;

  // 5. Legacy pointer-events block (Radix v1 compat)
  if (document.body.style.pointerEvents === "none") return true;

  return false;
}

/**
 * Android's Back key. Follows the same rule as the on-screen Back controls
 * (see lib/navHistory): close an overlay, undo an in-page step, return to the
 * previous in-app screen, else go to the screen's parent; on home, press twice
 * to exit.
 */
export function useNativeBackButton() {
  const backPressedRef = useRef(false);
  const lastPressTime = useRef(0);
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const goHome = () => navigateRef.current("/", { replace: true });

    const listener = CapApp.addListener("backButton", () => {
      const now = Date.now();
      // Debounce: ignore duplicate events within 300 ms
      if (now - lastPressTime.current < 300) return;
      lastPressTime.current = now;

      // 1. Dismiss any open overlay (modal, sheet, drawer, menu, popover)
      if (hasOpenOverlay()) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
          }),
        );
        return;
      }

      const path = window.location.pathname;
      const isHome =
        path === "/" ||
        path === "" ||
        path === "/iiscshuttlers" ||
        path === "/iiscshuttlers/";

      // 2. Undo an in-page step (wizard step, opened match, drill-down) —
      //    the same thing the screen's own Back control does.
      if (runStepHandlers()) return;

      // 3. Previous in-app screen. Covers route changes, useHashTab /
      //    useQueryState tabs and useHistoryStep steps, which all push entries.
      if (!isHome && canGoBackInApp()) {
        window.history.back();
        return;
      }

      // 4. No earlier screen (deep link, notification, cold start): go to the
      //    screen's parent, as its on-screen Back control would; with no
      //    registered parent, go home.
      if (!isHome) {
        if (!runParentFallback()) goHome();
        return;
      }

      // 5. Double-tap-to-exit on home.
      if (backPressedRef.current) {
        CapApp.exitApp();
        return;
      }
      backPressedRef.current = true;
      showExitToast(() => {
        backPressedRef.current = false;
      });
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);
}
