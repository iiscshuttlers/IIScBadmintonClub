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

export function useNativeBackButton() {
  const backPressedRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapApp.addListener("backButton", (event) => {
      const path = window.location.pathname;
      const isRootTab =
        path === "/" ||
        path === "" ||
        path === "/pulse" ||
        path === "/legacy" ||
        path === "/hub" ||
        path === "/iiscshuttlers" ||
        path === "/iiscshuttlers/";

      // If we are not on a root tab, go back.
      if (!isRootTab) {
        window.history.back();
        return;
      }

      // If we are on a root tab but not Home, maybe go to Home instead of exiting?
      // (Optional pattern, but standard Android is often to go to Home)
      if (path !== "/" && path !== "" && path !== "/iiscshuttlers" && path !== "/iiscshuttlers/") {
         window.location.href = "/";
         return;
      }

      // If we are on the Home tab, handle double-tap to exit
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
