import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./pwa";

Sentry.init(
  {
    dsn: import.meta.env.VITE_SENTRY_DSN || "",
    enabled: !!import.meta.env.VITE_SENTRY_DSN,
    release: "shuttlers.iisc.com@3.66.0", // matches package.json
  },
  SentryReact.init as any
);

createRoot(document.getElementById("root")!).render(<App />);
