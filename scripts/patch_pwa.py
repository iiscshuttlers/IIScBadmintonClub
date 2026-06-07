import re

# 1. Update vite.config.ts
with open('vite.config.ts', 'r', encoding='utf8') as f:
    vite_content = f.read()

vite_import = "import { VitePWA } from 'vite-plugin-pwa';\n"
if "vite-plugin-pwa" not in vite_content:
    vite_content = vite_content.replace('import { defineConfig, type Plugin, type ViteDevServer } from "vite";', 
                                        'import { defineConfig, type Plugin, type ViteDevServer } from "vite";\n' + vite_import)

pwa_plugin_config = """    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 5000000
      },
      manifest: {
        name: 'IISc Shuttlers',
        short_name: 'Shuttlers',
        description: 'IISc Badminton Club Application',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),"""

# Replace `// VitePWA removed` inside plugins array with the actual plugin
vite_content = vite_content.replace('// VitePWA removed', pwa_plugin_config)

with open('vite.config.ts', 'w', encoding='utf8') as f:
    f.write(vite_content)


# 2. Update client/src/App.tsx
with open('client/src/App.tsx', 'r', encoding='utf8') as f:
    app_content = f.read()

# Add imports
app_import = "import { PwaInstallPrompt } from './components/pwa/PwaInstallPrompt';\nimport { PwaUpdatePrompt } from './components/pwa/PwaUpdatePrompt';\n"
app_content = app_content.replace("import Navigation from './components/Navigation';", 
                                  app_import + "import Navigation from './components/Navigation';")

# Add components
# I want to put PwaInstallPrompt above Navigation (or below StatusBanner)
# and PwaUpdatePrompt before Toaster.
app_content = app_content.replace("<Navigation />", "<PwaInstallPrompt />\n                <Navigation />")
app_content = app_content.replace("<Toaster />", "<Toaster />\n            <PwaUpdatePrompt />")

with open('client/src/App.tsx', 'w', encoding='utf8') as f:
    f.write(app_content)

print("Patched vite.config.ts and App.tsx")
