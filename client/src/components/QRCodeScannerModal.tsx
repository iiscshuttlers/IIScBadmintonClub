import { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { X, QrCode } from "lucide-react";

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (playerId: string) => void;
}

export function QRCodeScannerModal({ isOpen, onClose, onScan }: QRCodeScannerModalProps) {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      return;
    }

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
        // ignore errors (mostly "no code found" frame by frame)
      }
    );

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
                <QrCode className="w-5 h-5 text-emerald-500" /> Scan QR Code
              </h2>
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 flex flex-col items-center justify-center min-h-[300px] relative">
              {scanResult ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/10 z-10">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-4">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">Player Found!</p>
                </div>
              ) : null}
              
              <div id="reader" className="w-full overflow-hidden rounded-2xl [&_button]:bg-emerald-500 [&_button]:text-white [&_button]:px-4 [&_button]:py-2 [&_button]:rounded-xl [&_button]:font-bold [&_button]:mt-4 [&_select]:mt-4 [&_select]:p-2 [&_select]:rounded-lg [&_select]:bg-slate-100 dark:[&_select]:bg-slate-800 dark:[&_select]:text-white"></div>
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
