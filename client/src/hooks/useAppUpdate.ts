import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export type AppUpdateInfo = {
  versionName: string;
  changelog: string;
  downloadUrl: string;
};

export function useAppUpdate() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        const remoteVersionUrl =
          "https://iiscshuttlers.github.io/iiscshuttlers/data/app-version.json";
        const [info, res] = await Promise.all([
          CapApp.getInfo(),
          fetch(`${remoteVersionUrl}?v=${Date.now()}`),
        ]);
        const latest = await res.json();

        if (Number.parseInt(info.build, 10) < latest.versionCode) {
          setUpdateInfo({
            versionName: latest.versionName,
            changelog: latest.changelog,
            downloadUrl: latest.downloadUrl ?? "https://play.google.com/store/apps/details?id=com.iiscshuttlers.app",
          });
        }
      } catch {
        // Update checks should never block the app.
      }
    })();
  }, []);

  return { updateInfo, dismissUpdate: () => setUpdateInfo(null) };
}
