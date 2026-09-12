import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./pwa";
import packageJson from "../../package.json";

Sentry.init(
  {
    dsn: import.meta.env.VITE_SENTRY_DSN || "",
    enabled: !!import.meta.env.VITE_SENTRY_DSN,
    release: `shuttlers.iisc.com@${packageJson.version}`,
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
