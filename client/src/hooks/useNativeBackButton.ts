import { useEffect, useRef } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

function showExitToast(onDone: () => void) {
  const toast = document.createElement("div");
  toast.textContent = "Press back again to exit";
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "40px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15,23,42,0.92)",
    color: "#fff",
    padding: "10px 22px",
    borderRadius: "30px",
    fontSize: "14px",
    fontWeight: "600",
    zIndex: "99999",
    backdropFilter: "blur(8px)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
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

export function useNativeBackButton() {
  const backPressedRef = useRef(false);
  const lastPressTime = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapApp.addListener("backButton", (event) => {
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

      // 2. Double-tap-to-exit when on home or nothing in history
      if (isHome || !event.canGoBack) {
        if (backPressedRef.current) {
          CapApp.exitApp();
          return;
        }
        backPressedRef.current = true;
        showExitToast(() => {
          backPressedRef.current = false;
        });
        return;
      }

      // 3. Standard back navigation — works for both:
      //    • wouter route changes (URL-based)
      //    • useHashTab tab states (state-object-based pushState)
      //    • useQueryState subtab changes (query-string pushState)
      window.history.back();
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);
}
