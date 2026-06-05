import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export type AppUpdateInfo = {
  versionName: string;
  downloadUrl: string;
  changelog: string;
};

export function useAppUpdate() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        const [info, res] = await Promise.all([
          CapApp.getInfo(),
          fetch(`${import.meta.env.BASE_URL}data/app-version.json?v=${Date.now()}`),
        ]);
        const latest = await res.json();

        if (Number.parseInt(info.build, 10) < latest.versionCode) {
          setUpdateInfo({
            versionName: latest.versionName,
            downloadUrl: latest.downloadUrl,
            changelog: latest.changelog,
          });
        }
      } catch {
        // Update checks should never block the app.
      }
    })();
  }, []);

  return { updateInfo, dismissUpdate: () => setUpdateInfo(null) };
}
