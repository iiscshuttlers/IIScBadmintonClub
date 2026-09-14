import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X } from "lucide-react";
import type { AppUpdateInfo } from "@/hooks/useAppUpdate";

export function UpdateDialog({
  info,
  onDismiss,
  onSkip,
}: {
  info: AppUpdateInfo;
  onDismiss: () => void;
  onSkip: () => void;
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
    <Dialog open={true}>
      <DialogContent className="max-w-[280px] border-0 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-2xl [&>button]:hidden">
        <button 
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4 text-slate-500" />
          <span className="sr-only">Close</span>
        </button>

        <DialogTitle className="sr-only">Update Available</DialogTitle>
        <DialogDescription className="sr-only">Download version {info.versionName}</DialogDescription>
        
        <div className="flex items-center gap-3 mb-1">
          <div className="text-2xl bg-slate-100 dark:bg-slate-800/50 p-2 rounded-xl flex items-center justify-center h-10 w-10">🏸</div>
          <div>
            <h2 className="text-base font-bold text-foreground dark:text-foreground leading-tight">
              Update Available
            </h2>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
              Version {info.versionName} is ready
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-3">
          <button
            onClick={handleDownloadAndInstall}
            disabled={downloading}
            className={`w-full ${downloading ? "bg-primary/70" : "bg-primary hover:bg-primary/90"} text-primary-foreground font-bold py-2 rounded-lg text-sm transition-colors shadow-sm`}
          >
            {downloading ? "Downloading..." : "Download Update"}
          </button>
          
          <div className="flex gap-1.5">
            <button
              onClick={onDismiss}
              className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold py-1.5 rounded-lg text-xs transition-colors"
            >
              Later
            </button>
            <button
              onClick={onSkip}
              className="flex-1 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold py-1.5 rounded-lg text-xs transition-colors"
            >
              Don't remind me
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
