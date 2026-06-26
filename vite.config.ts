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
    (entry) => `[${new Date().toISOString()}] ${JSON.stringify(entry)}`,
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
            if (payload.consoleLogs)
              writeToLogFile("browserConsole", payload.consoleLogs);
            if (payload.networkRequests)
              writeToLogFile("networkRequests", payload.networkRequests);
            if (payload.sessionEvents)
              writeToLogFile("sessionReplay", payload.sessionEvents);

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

        const base = (process.env.BUILT_IN_FORGE_API_URL || "").replace(
          /\/+$/,
          "",
        );
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
const pkgPath = path.resolve(PROJECT_ROOT, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

export default defineConfig(() => {
  // 🔥 CRITICAL FIX
  // For Capacitor, we want relative base './'. For github pages we want '/iiscshuttlers/'.
  // Otherwise use '/'
  const isCapacitor = process.env.CAPACITOR === "true";
  const isGithubPages = process.env.GITHUB_PAGES === "true";
  const basePath = isCapacitor ? "./" : isGithubPages ? "/iiscshuttlers/" : "/";
  const manifestIconPath = (name: string) => isGithubPages ? `/iiscshuttlers/${name}` : `/${name}`;

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      tailwindcss(),
      vitePluginManusRuntime(),
      vitePluginManusDebugCollector(),
      vitePluginStorageProxy(),

      VitePWA({
        registerType: "prompt",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,json,webp,woff2}"],
          globIgnores: ["**/profile_banner*.png"],
          maximumFileSizeToCacheInBytes: 5000000,
          skipWaiting: true,
          clientsClaim: true,
        },
        manifest: {
          name: "IISc Shuttlers",
          short_name: "Shuttlers",
          description: "IISc Badminton Club Application",
          theme_color: "#10b981",
          background_color: "#ffffff",
          display: "standalone",
          // gcm_sender_id is required for legacy FCM web push but is not in the ManifestOptions type
          // @ts-expect-error -- valid manifest field, missing from vite-plugin-pwa typings
          gcm_sender_id: "103953800507",
          icons: [
            {
              src: manifestIconPath("icon-192.png"),
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: manifestIconPath("icon-512.png"),
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
      }),
    ],

    base: basePath,

    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },

    envDir: path.resolve(import.meta.dirname),

    root: path.resolve(import.meta.dirname, "client"),

    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        external: ["capacitor-native-biometric"],
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "wouter"],
            motion: ["framer-motion"],
            icons: ["lucide-react"],
            ui: ["@radix-ui/react-dialog"],
            supabase: ["@supabase/supabase-js"],
            firebase: ["firebase/app", "firebase/messaging"],
          },
        },
      },
    },

    server: {
      port: 3000,
      host: true,
    },
  };
});
