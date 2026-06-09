import re

with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("    </div>\n  );\n}\n\n//", "    </div>\n    </>\n  );\n}\n\n//")

with open("client/src/pages/Home.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Home.tsx fragment closed.")
