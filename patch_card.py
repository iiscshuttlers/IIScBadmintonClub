import re

with open("client/src/components/players-directory/PlayerCard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Ensure framer-motion is imported
if "from \"framer-motion\"" not in content:
    content = content.replace("import { Link } from \"wouter\";", "import { Link } from \"wouter\";\nimport { motion } from \"framer-motion\";")

# Extract handlePing
handlePing_text = """
  const handlePing = () => {
    if (isOwn) return;
    if (isPinged) {
      setIsPinged(false);
      toast.success(`Ping to ${player.full_name} cancelled.`, {
        icon: <BellOff className="w-4 h-4 text-slate-500" />
      });
    } else {
      setIsPinged(true);
      toast.success(`Ping sent to ${player.full_name}! They will be notified.`, {
        icon: <BellRing className="w-4 h-4 text-emerald-500" />
      });
    }
  };
"""

content = content.replace("const handleShare = async (e: React.MouseEvent) => {", handlePing_text + "\n  const handleShare = async (e: React.MouseEvent) => {")

# Replace onClick inside Ping Button
ping_onclick_pattern = r"onClick=\{\(e\) => \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*if \(isPinged\) \{\s*setIsPinged\(false\);\s*toast\.success\([^}]*\}\);\s*\} else \{\s*setIsPinged\(true\);\s*toast\.success\([^}]*\}\);\s*\}\s*\}\}"
content = re.sub(ping_onclick_pattern, "onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePing(); }}", content, flags=re.DOTALL)

# Wrap Card in motion.div
card_pattern = r"(<Card\s+className={`h-full.*?)(?=\s*\{/\* Admin Controls \*/\})"
# Wait, replacing the wrapper might be tricky. Let's just wrap the return statement.
# The return statement is: return (\n    <Card ... \n ... \n    </Card>\n  );
# We can replace `return (` with `return ( <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.x > 80) handlePing(); }} className="h-full">` and `</Card>\n  );` with `</Card>\n    </motion.div>\n  );`

content = content.replace("return (\n    <Card", """return (
    <motion.div 
      drag="x" 
      dragConstraints={{ left: 0, right: 0 }} 
      dragElastic={0.2} 
      onDragEnd={(e, info) => { if (info.offset.x > 80) handlePing(); }}
      className="h-full"
    >
      <Card""")

content = content.replace("</Card>\n  );", "</Card>\n    </motion.div>\n  );")

with open("client/src/components/players-directory/PlayerCard.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayerCard.tsx patched successfully!")
