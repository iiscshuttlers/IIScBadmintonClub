import re

with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# I will find the exact string `return (\n    <div` to ` className="min-h-screen">`
# and fix it.

content = content.replace("return (\n    <div", "return (\n    <>")
content = content.replace("      )}\n className=\"min-h-screen\">", "      )}\n    <div className=\"min-h-screen\">")

# Add missing fragment closing at the end of the component
# I'll just find the last `</div>\n  );\n}` and replace with `</div>\n    </>\n  );\n}`

content = re.sub(r"</div>\n\s*\);\n\}", "</div>\n    </>\n  );\n}", content)

with open("client/src/pages/Home.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Home.tsx syntax fixed.")
