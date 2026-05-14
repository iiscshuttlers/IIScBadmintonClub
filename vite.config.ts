import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

/* ===================== Debug + Storage Plugins (unchanged) ===================== */

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) return;

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > TRIM_TARGET_BYTES) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {}
}

function writeToLogFile(source: string, entries: unknown[]) {
  if (entries.length === 0) return;
  ensureLogDir();

  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map(
    (entry) => `[${new Date().toISOString()}] ${JSON.stringify(entry)}`
  );

  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") return html;
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: { src: "/__manus__/debug-collector.js", defer: true },
            injectTo: "head",
          },
        ],
      };
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk) => (body += chunk.toString()));
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            if (payload.consoleLogs) writeToLogFile("browserConsole", payload.consoleLogs);
            if (payload.networkRequests) writeToLogFile("networkRequests", payload.networkRequests);
            if (payload.sessionEvents) writeToLogFile("sessionReplay", payload.sessionEvents);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch {
            res.writeHead(400);
            res.end();
          }
        });
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/manus-storage", async (req, res) => {
        const key = req.url?.replace(/^\//, "");
        if (!key) return res.end("Missing key");

        const base = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

        if (!base || !apiKey) return res.end("Not configured");

        try {
          const url = new URL("v1/storage/presign/get", base + "/");
          url.searchParams.set("path", key);

          const r = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });

          const data = await r.json();
          res.writeHead(307, { Location: data.url });
          res.end();
        } catch {
          res.end("Error");
        }
      });
    },
  };
}

/* ===================== MAIN CONFIG ===================== */

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    vitePluginManusRuntime(),
    vitePluginManusDebugCollector(),
    vitePluginStorageProxy(),

    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Serve offline.html when navigation requests fail offline
        navigateFallback: "offline.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: "IISc Badminton Club",
        short_name: "IISc Badminton",
        description: "Official IISc Badminton Club App",
        theme_color: "#0f172a",
        background_color: "#ffffff",
        display: "standalone",

        // 🔥 IMPORTANT (matches GitHub Pages or root for Capacitor)
        start_url: process.env.CAPACITOR === "true" ? "/" : "/iiscshuttlers/",
        scope: process.env.CAPACITOR === "true" ? "/" : "/iiscshuttlers/",

        icons: [
          {
            src: "/iiscshuttlers/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/iiscshuttlers/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],

  // 🔥 CRITICAL FIX
  // For Capacitor, we want relative base './'. For github pages we want '/iiscshuttlers/'.
  // Otherwise use '/'
  base: process.env.CAPACITOR === "true" ? "./" : process.env.GITHUB_PAGES === "true" ? "/iiscshuttlers/" : "/",

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },

  envDir: path.resolve(import.meta.dirname),

  root: path.resolve(import.meta.dirname, "client"),

  // 🔥 FIXED OUTPUT (THIS WAS YOUR BUG)
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },

  server: {
    port: 3000,
    host: true,
  },
});
