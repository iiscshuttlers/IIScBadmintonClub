import re

with open("client/src/components/LogMatchFab.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Make sure useState, useEffect, supabase are imported
if "useEffect" not in content or "useState" not in content:
    content = re.sub(r"import\s*\{\s*useState\s*\}\s*from\s*['\"]react['\"];", "import { useState, useEffect } from \"react\";", content)

if "supabase" not in content:
    content = "import { supabase } from \"../lib/supabase\";\n" + content

with open("client/src/components/LogMatchFab.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("LogMatchFab.tsx imports fixed.")
