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
import { fetchSiteData } from "@/lib/siteData";

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

    const check = async () => {
      try {
        const [info, latest] = await Promise.all([
          CapApp.getInfo(),
          fetchSiteData<any>("app_version", "app-version.json")
        ]);

        const installed = Number.parseInt(info.build, 10);
        const required = Number(latest?.versionCode);
        if (!Number.isFinite(installed) || !Number.isFinite(required)) return;

        if (installed < required) {
          setUpdateInfo({
            versionName: latest.versionName,
            changelog: latest.changelog,
            downloadUrl:
              latest.downloadUrl ??
              "https://play.google.com/store/apps/details?id=shuttlers.iisc.com",
          });

          // Re-prompt when the admin forces again, even at the same version:
          // `forcedAt` changes on every force, so a user who dismissed once is
          // asked again. Without it, keying on versionCode alone meant a repeat
          // force was silently swallowed.
          const promptToken = `${required}:${latest?.forcedAt ?? ""}`;
          if (sessionStorage.getItem(AUTO_PROMPT_KEY) !== promptToken) {
            sessionStorage.setItem(AUTO_PROMPT_KEY, promptToken);
            setIsDialogOpen(true);
          }
        } else {
          setUpdateInfo(null);
        }
      } catch {
        // Update checks should never block the app.
      }
    };

    check();

    // Android resumes the app rather than cold-starting it, so a mount-only
    // check could go days without running — an admin forcing an update saw
    // nothing happen. Re-check whenever the app comes back to the foreground.
    const listener = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) check();
    });

    return () => { listener.then((l) => l.remove()).catch(() => {}); };
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
