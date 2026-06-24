import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Listen for the browser event that says "Hey, this is installable!"
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Stop the browser's default mini-infobar
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if user has previously dismissed the prompt (optional persistence)
    const dismissed = localStorage.getItem("pwa_install_dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
    }

    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;

    // Show the native browser install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // Clear the prompt
    setDeferredPrompt(null);
    setIsInstallable(false);

    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    }
  };

  const dismissInstall = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa_install_dismissed", "true");
  };

  return { isInstallable, isDismissed, triggerInstall, dismissInstall };
}

export function PwaInstallPrompt() {
  const { isInstallable, isDismissed, triggerInstall, dismissInstall } =
    useInstallPrompt();

  // Determine if it's iOS (doesn't support beforeinstallprompt)
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone === true;
    // Show iOS tooltip only if not already installed and is iOS
    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
    }
  }, []);

  if (isDismissed) return null;

  return (
    <AnimatePresence>
      {(isInstallable || isIOS) && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md text-white px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">Get the App</p>
              {isIOS ? (
                <p className="text-xs text-blue-100">
                  Tap Share &gt; Add to Home Screen
                </p>
              ) : (
                <p className="text-xs text-blue-100">
                  Install for a faster, app-like experience.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isIOS && (
              <button
                onClick={triggerInstall}
                className="bg-white text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                Install
              </button>
            )}
            <button
              onClick={dismissInstall}
              className="text-white/60 hover:text-white p-1 rounded-md transition-colors"
              title="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
