import { useState, useEffect, useRef } from "react";
import type { Html5QrcodeScanner as Html5QrcodeScannerType } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { X, QrCode } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (playerId: string) => void;
}

// Extract app path from various URL formats
function extractAppPath(url: string): string | null {
  // Handle iiscshuttlers:// scheme
  if (url.startsWith("iiscshuttlers://")) {
    const path = url.slice("iiscshuttlers://".length);
    return "/" + path;
  }

  // Handle GitHub Pages URLs
  if (url.includes("iiscbadmintonclub.github.io")) {
    const match = url.match(/iiscbadmintonclub\.github\.io\/iiscshuttlers(\/[^?]*)?/);
    if (match) {
      return match[1] || "/";
    }
  }

  return null;
}

export function QRCodeScannerModal({ isOpen, onClose, onScan }: QRCodeScannerModalProps) {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const scannerRef = useRef<Html5QrcodeScannerType | null>(null);

  const requestCameraPermission = async () => {
    setRequestingPermission(true);
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      // Permission granted, now initialize scanner
      initializeScanner();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Camera permission denied. Please enable camera access in settings.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else if (err.name === "NotReadableError") {
        setError("Camera is busy. Close other camera apps and try again.");
      } else {
        setError("Unable to access camera. Please try again.");
      }
    } finally {
      setRequestingPermission(false);
    }
  };

  const initializeScanner = async () => {
    if (scannerRef.current) return;

    try {
      const { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      const scanner = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        },
        false
      );

      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          // Check if this is a website URL that should open in app
          if (decodedText.includes("iiscbadmintonclub.github.io") || decodedText.startsWith("iiscshuttlers://")) {
            scanner.clear().catch(console.error);
            setScanResult(decodedText);

            if (Capacitor.isNativePlatform()) {
              // On native app, show prompt to open scanned link in app
              setTimeout(() => {
                const appPath = extractAppPath(decodedText);
                if (appPath) {
                  // Navigate within app by reopening the modal with the path
                  onClose();
                  window.history.pushState(null, "", appPath);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                  toast.success("Navigating in app...");
                }
              }, 600);
            } else {
              // On web, just navigate normally
              setTimeout(() => {
                window.location.href = decodedText;
              }, 600);
            }
            return;
          }

          // Assume decodedText is the player_id or the full player profile URL
          let playerId = decodedText;
          if (decodedText.includes("/player/")) {
            playerId = decodedText.split("/player/")[1].split("?")[0].replace(/\/$/, "");
          }

          if (playerId && playerId.length > 1 && !scanResult) {
            setScanResult(playerId);
            scanner.clear().catch(console.error);

            // Small delay for user to see success UI
            setTimeout(() => {
              onClose();
              onScan(playerId);
            }, 600);
          }
        },
        (error) => {
          // Ignore normal scanning errors
        }
      );
    } catch (err) {
      console.error("Failed to load scanner", err);
      setError("Failed to load scanner module.");
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      setError(null);
      setScanResult(null);
      return;
    }

    // Try to initialize scanner immediately
    requestCameraPermission();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  // Reset scanResult when closed
  useEffect(() => {
    if (!isOpen) setScanResult(null);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-[101] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" /> Scan QR Code
              </h2>
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 flex flex-col items-center justify-center min-h-[300px] relative">
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 z-10 rounded-2xl p-4">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <p className="text-red-600 dark:text-red-400 font-bold text-center mb-4">{error}</p>
                  <button
                    onClick={requestCameraPermission}
                    disabled={requestingPermission}
                    className="bg-primary hover:bg-primary disabled:bg-slate-400 text-white font-bold px-6 py-2 rounded-xl transition-colors"
                  >
                    {requestingPermission ? "Requesting..." : "Try Again"}
                  </button>
                </div>
              )}

              {scanResult ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/10 z-10">
                  <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mb-4">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <p className="text-primary dark:text-primary font-bold text-lg">Player Found!</p>
                </div>
              ) : null}

              <div id="reader" className="w-full overflow-hidden rounded-2xl [&_button]:bg-primary [&_button]:text-white [&_button]:px-4 [&_button]:py-2 [&_button]:rounded-xl [&_button]:font-bold [&_button]:mt-4 [&_select]:mt-4 [&_select]:p-2 [&_select]:rounded-lg [&_select]:bg-slate-100 dark:[&_select]:bg-slate-800 dark:[&_select]:text-white"></div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
              Scan a player's profile QR code to quickly log a match with them.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
