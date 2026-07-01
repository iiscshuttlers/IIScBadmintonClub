import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";
import type { AppUpdateInfo } from "@/hooks/useAppUpdate";

export function UpdateDialog({
  info,
  onDismiss,
}: {
  info: AppUpdateInfo;
  onDismiss: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadAndInstall = async () => {
    if (info.downloadUrl.includes("play.google.com") || info.downloadUrl.startsWith("market://")) {
      window.open(info.downloadUrl, "_system");
      onDismiss();
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      window.open(info.downloadUrl, "_blank");
      return;
    }

    try {
      setDownloading(true);
      const fileName = `IIScShuttlers_${info.versionName}.apk`;

      const downloadResult = await Filesystem.downloadFile({
        url: info.downloadUrl,
        path: fileName,
        directory: Directory.Cache,
      });

      if (downloadResult.path) {
        await FileOpener.open({
          filePath: downloadResult.path,
          contentType: "application/vnd.android.package-archive",
        });
      }
    } catch (error) {
      console.error("Download failed", error);
      window.open(info.downloadUrl, "_system");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-7 space-y-5">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-2">🏸</div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Update Available
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Version {info.versionName} is ready
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleDownloadAndInstall}
            disabled={downloading}
            className={`w-full ${downloading ? "bg-primary" : "bg-primary hover:bg-primary"} text-white font-bold py-3 rounded-xl text-center transition-colors`}
          >
            {downloading ? "Downloading..." : "Download Update"}
          </button>
          <button
            onClick={onDismiss}
            className="w-full text-slate-500 dark:text-slate-400 font-medium py-2 text-sm hover:text-slate-700 transition-colors"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
