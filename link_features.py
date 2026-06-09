import re

with open("client/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add import
if "Features" not in content:
    content = content.replace("import Events from './pages/Events';", "import Events from './pages/Events';\nimport Features from './pages/Features';")

    # Add Route
    content = content.replace("<Route path=\"/events\" component={Events} />", "<Route path=\"/events\" component={Events} />\n        <Route path=\"/features\" component={Features} />")

with open("client/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

with open("client/src/components/Footer.tsx", "r", encoding="utf-8") as f:
    footer = f.read()

if "/features" not in footer:
    footer = footer.replace("<li><Link href=\"/directory\">Directory</Link></li>", "<li><Link href=\"/directory\">Directory</Link></li>\n              <li><Link href=\"/features\" className=\"text-indigo-400 font-bold flex items-center gap-1 hover:text-indigo-300\">Platform Features <Sparkles className=\"w-3 h-3\"/></Link></li>")
    footer = footer.replace("import { Link } from \"wouter\";", "import { Link } from \"wouter\";\nimport { Sparkles } from \"lucide-react\";")

with open("client/src/components/Footer.tsx", "w", encoding="utf-8") as f:
    f.write(footer)

print("Router and Footer updated.")
