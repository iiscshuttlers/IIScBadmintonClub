import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./pwa";
import { installNavHistory } from "./lib/navHistory";
import { installAvatarFallback } from "./lib/avatarFallback";

// Before the router renders, so every history entry knows whether an earlier
// screen of the app sits behind it (Back controls depend on it).
installNavHistory();

// A player photo that fails to load shows initials, never a broken-image icon.
installAvatarFallback();

// Dev servers, `vite preview` and e2e runs are served from localhost:<port>.
// The Android app is https://localhost with no port, so it still reports.
const isLocalRun =
  import.meta.env.DEV ||
  (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) && window.location.port !== "");

Sentry.init(
  {
    dsn: import.meta.env.VITE_SENTRY_DSN || "",
    // Local runs used to report as "production" and filled Sentry with
    // hot-reload and half-edited-code errors no user ever saw.
    enabled: !!import.meta.env.VITE_SENTRY_DSN && !isLocalRun,
    environment: isLocalRun ? "development" : "production",
    release: `shuttlers.iisc.com@${import.meta.env.VITE_APP_VERSION_NAME}`,
    integrations: [
      SentryReact.browserTracingIntegration(),
    ],
    tracesSampleRate: 1.0,
  },
  SentryReact.init as any
);

createRoot(document.getElementById("root")!).render(
  <SentryReact.ErrorBoundary fallback={<p>An error has occurred</p>}>
    <App />
  </SentryReact.ErrorBoundary>
);
