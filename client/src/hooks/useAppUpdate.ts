import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export type AppUpdateInfo = {
  versionName: string;
  changelog: string;
  downloadUrl: string;
};

type AppUpdateContextValue = {
  /** The available update, or null when the app is up to date. */
  updateInfo: AppUpdateInfo | null;
  /** Whether the update dialog should currently be shown. */
  isDialogOpen: boolean;
  /** Manually open the update dialog (e.g. from the Menu). */
  openUpdateDialog: () => void;
  /** Dismiss / close the update dialog. */
  dismissUpdate: () => void;
};

const AppUpdateContext = createContext<AppUpdateContextValue>({
  updateInfo: null,
  isDialogOpen: false,
  openUpdateDialog: () => {},
  dismissUpdate: () => {},
});

// Marks that the auto-prompt has already been shown for a given build during
// this app launch. sessionStorage survives an in-app reload (pull-to-refresh)
// but is cleared when the app is fully closed and reopened — so the user is
// auto-prompted only once per app open, not on every refresh.
const AUTO_PROMPT_KEY = "iisc_update_prompt_shown";

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
            downloadUrl:
              latest.downloadUrl ??
              "https://play.google.com/store/apps/details?id=com.iiscshuttlers.app",
          });

          // Auto-show the prompt only once per app launch.
          const shownFor = sessionStorage.getItem(AUTO_PROMPT_KEY);
          if (shownFor !== String(latest.versionCode)) {
            sessionStorage.setItem(AUTO_PROMPT_KEY, String(latest.versionCode));
            setIsDialogOpen(true);
          }
        }
      } catch {
        // Update checks should never block the app.
      }
    })();
  }, []);

  const openUpdateDialog = useCallback(() => setIsDialogOpen(true), []);
  const dismissUpdate = useCallback(() => setIsDialogOpen(false), []);

  return createElement(
    AppUpdateContext.Provider,
    { value: { updateInfo, isDialogOpen, openUpdateDialog, dismissUpdate } },
    children,
  );
}

export function useAppUpdate() {
  return useContext(AppUpdateContext);
}
